/**
 * Room channel — backed by the FastAPI WebSocket realtime layer
 * (`/v1/rooms/{roomId}/ws`). Public API is unchanged from the previous
 * Supabase-backed implementation so every activity using it keeps
 * working without per-activity changes.
 *
 * The wire format (defined in `backend/app/realtime/protocol.py`):
 * - inbound  → `broadcast` / `presence.update` / `ping`
 * - outbound → `ready` / `broadcast` / `presence.{sync,join,leave}` /
 *              `durable.update` / `pong` / `error`
 *
 * Reconnect: on socket close we re-open with exponential backoff
 * capped at ~30s. Pending broadcasts queued while disconnected are
 * flushed in order after `ready`. Presence is re-tracked from the
 * last `track(state)` call so peers re-see us after a flap.
 */
import { authClient } from "@/lib/authClient";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const WS_BASE = API_BASE.replace(/^http/, "ws");

export type BroadcastEvent = {
  /** Application-level tag, e.g. "activity" or "reaction". */
  kind: string;
  payload: Record<string, unknown>;
  receivedAt: number;
};

export type DurableUpdate = {
  activityId: string;
  newRow: Record<string, unknown>;
  oldRow: Record<string, unknown> | null;
  receivedAt: number;
};

export type PresenceState = Record<string, unknown>;

type BroadcastListener = (e: BroadcastEvent) => void;
type DurableListener = (u: DurableUpdate) => void;
type PresenceListener = (states: PresenceState[]) => void;
type StatusListener = (status: string) => void;
type ReconnectListener = () => void;

type Outbound =
  | { type: "broadcast"; event: string; payload: Record<string, unknown> }
  | { type: "presence.update"; state: PresenceState }
  | { type: "ping" };

type Inbound =
  | { type: "ready"; self: string; presence: Record<string, PresenceState> }
  | { type: "broadcast"; event: string; payload: Record<string, unknown>; from: string }
  | { type: "presence.sync"; state: Record<string, PresenceState> }
  | { type: "presence.join"; id: string; state: PresenceState }
  | { type: "presence.leave"; id: string }
  | { type: "durable.update"; activity_id: string; row: Record<string, unknown> }
  | { type: "pong" }
  | { type: "error"; code: string; message: string };

const MAX_BACKOFF_MS = 30_000;
// Liveness. A flaky link often leaves the socket half-open: the browser
// still reports OPEN, sends vanish, and no `close` ever fires — so nothing
// would reconnect and nothing would re-sync (live-tested: a game stayed
// dead for its whole length). Every inbound message counts as liveness;
// if a ping goes unanswered past the grace, we declare the socket a zombie,
// tear it down ourselves and reconnect. Worst-case detection ≈ 23s.
const PING_INTERVAL_MS = 15_000;
const PONG_GRACE_MS = 8_000;

export class RoomChannel {
  readonly roomId: string;
  private readonly participantId: string | undefined;

  private socket: WebSocket | null = null;
  private subscribed = false;
  status = "idle";

  private readonly broadcastListeners = new Set<BroadcastListener>();
  private readonly durableListeners = new Set<DurableListener>();
  private readonly presenceListeners = new Set<PresenceListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly reconnectListeners = new Set<ReconnectListener>();
  /** How many `ready`s we've seen — the second and later are reconnects. */
  private readyCount = 0;

  /** Subscriber-id → state. Rebuilt from presence.sync/join/leave. */
  private presence: Record<string, PresenceState> = {};
  /** Last `track(...)` value — re-applied on reconnect. */
  private lastPresence: PresenceState | null = null;
  /** Queued sends while we're not OPEN; drained after `ready`. */
  private outbox: Outbound[] = [];
  private backoff = 500;
  private reconnectTimer: number | null = null;
  /** When we last heard ANYTHING from the server (pong or otherwise). */
  private lastInbound = 0;
  private pingTimer: number | null = null;
  private disposed = false;
  private openResolver: (() => void) | null = null;
  private openRejecter: ((err: Error) => void) | null = null;

  constructor(roomId: string, options?: { participantId?: string }) {
    this.roomId = roomId;
    this.participantId = options?.participantId;
  }

  /** Connect; resolves once the server's `ready` lands. */
  open(): Promise<void> {
    if (this.subscribed) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this.openResolver = resolve;
      this.openRejecter = reject;
      this.connect();
    });
  }

  get isSubscribed(): boolean {
    return this.subscribed;
  }

  // ── broadcast ──────────────────────────────────────────────────────────
  broadcast(kind: string, data: Record<string, unknown>): Promise<unknown> {
    return Promise.resolve(this.send({ type: "broadcast", event: kind, payload: data }));
  }

  onBroadcast(fn: BroadcastListener): () => void {
    this.broadcastListeners.add(fn);
    return () => {
      this.broadcastListeners.delete(fn);
    };
  }

  // ── durable updates ────────────────────────────────────────────────────
  onDurable(fn: DurableListener): () => void {
    this.durableListeners.add(fn);
    return () => {
      this.durableListeners.delete(fn);
    };
  }

  // ── presence ───────────────────────────────────────────────────────────
  track(state: PresenceState): Promise<unknown> {
    this.lastPresence = state;
    return Promise.resolve(this.send({ type: "presence.update", state }));
  }

  onPresence(fn: PresenceListener): () => void {
    this.presenceListeners.add(fn);
    return () => {
      this.presenceListeners.delete(fn);
    };
  }

  // ── connection state ──────────────────────────────────────────────────
  /** Every status transition (connecting / open / subscribed / error /
   *  closed:<code>). The room shows "Reconnecting…" off this so a player
   *  knows their taps aren't landing instead of mashing a button. */
  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  /** Fires after a RE-connect's `ready` — never the first — once presence
   *  is re-tracked and the outbox has been flushed, so anything a listener
   *  sends is ordered AFTER the moves that were queued during the drop.
   *  Activities re-sync here: the server keeps no replay buffer, so every
   *  broadcast sent while we were down (our own echoes included) is gone. */
  onReconnect(fn: ReconnectListener): () => void {
    this.reconnectListeners.add(fn);
    return () => {
      this.reconnectListeners.delete(fn);
    };
  }

  private setStatus(status: string) {
    if (this.status === status) return;
    this.status = status;
    for (const fn of this.statusListeners) fn(status);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.broadcastListeners.clear();
    this.durableListeners.clear();
    this.presenceListeners.clear();
    this.statusListeners.clear();
    this.reconnectListeners.clear();
    this.subscribed = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    const sock = this.socket;
    if (sock) {
      try {
        sock.close(1000);
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
  }

  // ── internals ──────────────────────────────────────────────────────────

  private buildUrl(): string {
    const params = new URLSearchParams();
    const token = authClient.getAccessToken();
    if (token) params.set("token", token);
    if (this.participantId) params.set("participant_id", this.participantId);
    return `${WS_BASE}/v1/rooms/${encodeURIComponent(this.roomId)}/ws?${params}`;
  }

  private connect() {
    if (this.disposed) return;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;

    const url = this.buildUrl();
    this.setStatus("connecting");
    const sock = new WebSocket(url);
    this.socket = sock;

    sock.onopen = () => {
      this.setStatus("open");
      // `ready` from server confirms we're truly joined — wait for it
      // before resolving open() and flushing the outbox.
    };

    sock.onmessage = (ev) => this.handle(JSON.parse(ev.data as string) as Inbound);

    sock.onerror = () => {
      this.setStatus("error");
    };

    sock.onclose = (ev) => {
      this.subscribed = false;
      this.setStatus(`closed:${ev.code}`);
      this.socket = null;
      this.presence = {};
      // 4401 = bad token (server-side close), don't retry on it.
      if (this.disposed || ev.code === 4401) {
        if (this.openRejecter) {
          this.openRejecter(new Error(`WS closed ${ev.code}`));
          this.openRejecter = null;
          this.openResolver = null;
        }
        return;
      }
      this.scheduleReconnect();
    };

    if (this.pingTimer === null) {
      this.pingTimer = window.setInterval(() => {
        if (this.subscribed && Date.now() - this.lastInbound > PING_INTERVAL_MS + PONG_GRACE_MS) {
          this.declareZombie();
          return;
        }
        // Cheap keepalive so intermediaries don't reap the socket on idle —
        // and the pong it earns is what the watchdog above listens for.
        this.send({ type: "ping" });
      }, PING_INTERVAL_MS);
    }
  }

  /** Half-open socket: nothing heard back for too long. The browser won't
   *  close it for us (that can take minutes), so we do — detaching the old
   *  handlers first so a late `close` can't schedule a second reconnect. */
  private declareZombie() {
    const sock = this.socket;
    if (!sock) return;
    sock.onopen = null;
    sock.onmessage = null;
    sock.onerror = null;
    sock.onclose = null;
    try {
      sock.close();
    } catch {
      /* already gone */
    }
    this.socket = null;
    this.subscribed = false;
    this.presence = {};
    this.setStatus("closed:zombie");
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.disposed) return;
    const delay = Math.min(this.backoff, MAX_BACKOFF_MS);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(message: Outbound): boolean {
    const sock = this.socket;
    if (this.subscribed && sock && sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify(message));
      return true;
    }
    // Not ready yet — queue. Bounded so a buggy caller can't OOM us.
    if (this.outbox.length < 256) this.outbox.push(message);
    return false;
  }

  private flushOutbox() {
    const queued = this.outbox;
    this.outbox = [];
    for (const message of queued) this.send(message);
  }

  private handle(message: Inbound) {
    this.lastInbound = Date.now();
    switch (message.type) {
      case "ready": {
        this.lastInbound = Date.now();
        this.subscribed = true;
        this.setStatus("subscribed");
        this.backoff = 500;
        this.presence = { ...message.presence };
        this.emitPresence();
        // Re-track presence on reconnect so peers see us again.
        if (this.lastPresence) {
          this.send({ type: "presence.update", state: this.lastPresence });
        }
        this.flushOutbox();
        if (this.openResolver) {
          this.openResolver();
          this.openResolver = null;
          this.openRejecter = null;
        }
        this.readyCount += 1;
        if (this.readyCount > 1) {
          for (const fn of this.reconnectListeners) fn();
        }
        return;
      }
      case "broadcast": {
        const event: BroadcastEvent = {
          kind: message.event,
          payload: message.payload ?? {},
          receivedAt: Date.now(),
        };
        for (const fn of this.broadcastListeners) fn(event);
        return;
      }
      case "presence.sync": {
        this.presence = { ...message.state };
        this.emitPresence();
        return;
      }
      case "presence.join": {
        this.presence[message.id] = message.state;
        this.emitPresence();
        return;
      }
      case "presence.leave": {
        delete this.presence[message.id];
        this.emitPresence();
        return;
      }
      case "durable.update": {
        const update: DurableUpdate = {
          activityId: message.activity_id,
          newRow: message.row,
          oldRow: null, // backend hook fires post-write; old row not carried
          receivedAt: Date.now(),
        };
        for (const fn of this.durableListeners) fn(update);
        return;
      }
      case "pong":
        return;
      case "error":
        // Surface for debug; don't tear down the socket on a single error frame.
        console.warn("[realtime] server error", message.code, message.message);
        return;
    }
  }

  private emitPresence() {
    const list = Object.values(this.presence);
    for (const fn of this.presenceListeners) fn(list);
  }
}
