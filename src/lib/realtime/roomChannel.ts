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
const PING_INTERVAL_MS = 25_000;

export class RoomChannel {
  readonly roomId: string;
  private readonly participantId: string | undefined;

  private socket: WebSocket | null = null;
  private subscribed = false;
  status = "idle";

  private readonly broadcastListeners = new Set<BroadcastListener>();
  private readonly durableListeners = new Set<DurableListener>();
  private readonly presenceListeners = new Set<PresenceListener>();

  /** Subscriber-id → state. Rebuilt from presence.sync/join/leave. */
  private presence: Record<string, PresenceState> = {};
  /** Last `track(...)` value — re-applied on reconnect. */
  private lastPresence: PresenceState | null = null;
  /** Queued sends while we're not OPEN; drained after `ready`. */
  private outbox: Outbound[] = [];
  private backoff = 500;
  private reconnectTimer: number | null = null;
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

  async dispose(): Promise<void> {
    this.disposed = true;
    this.broadcastListeners.clear();
    this.durableListeners.clear();
    this.presenceListeners.clear();
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
    this.status = "connecting";
    const sock = new WebSocket(url);
    this.socket = sock;

    sock.onopen = () => {
      this.status = "open";
      // `ready` from server confirms we're truly joined — wait for it
      // before resolving open() and flushing the outbox.
    };

    sock.onmessage = (ev) => this.handle(JSON.parse(ev.data as string) as Inbound);

    sock.onerror = () => {
      this.status = "error";
    };

    sock.onclose = (ev) => {
      this.subscribed = false;
      this.status = `closed:${ev.code}`;
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
        // Cheap keepalive so intermediaries don't reap the socket on idle.
        this.send({ type: "ping" });
      }, PING_INTERVAL_MS);
    }
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
    switch (message.type) {
      case "ready": {
        this.subscribed = true;
        this.status = "subscribed";
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
