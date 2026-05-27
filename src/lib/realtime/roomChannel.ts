/**
 * One Supabase Realtime channel per room, named `room:<roomId>` — the exact
 * topic and wire format the mobile app uses (see
 * `mobile/packages/realtime/lib/src/supabase_realtime_client.dart`), so web and
 * mobile clients in the same room interoperate.
 *
 * Carries three things:
 *  - broadcast: a single envelope event `"event"` with payload `{ kind, data }`.
 *    Supabase overwrites the top-level `type`, so the app-level tag rides in
 *    `kind` and the caller's payload in `data`.
 *  - presence: who's connected (via `track`).
 *  - postgres_changes: durable activity state on `public.room_activity_states`
 *    filtered by `room_id`, re-emitted per `activity_id`.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const BROADCAST_ENVELOPE = "event";

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

export class RoomChannel {
  readonly roomId: string;
  private channel: RealtimeChannel;
  private readonly broadcastListeners = new Set<BroadcastListener>();
  private readonly durableListeners = new Set<DurableListener>();
  private readonly presenceListeners = new Set<PresenceListener>();
  private subscribed = false;
  status = "idle";

  constructor(roomId: string) {
    this.roomId = roomId;
    this.channel = supabase.channel(`room:${roomId}`, {
      // self:true so the sender also receives its own broadcast — lets the
      // local client render its own reaction/event through the same path.
      config: { broadcast: { self: true } },
    });
  }

  /** Subscribe; resolves once the channel reaches SUBSCRIBED. */
  open(): Promise<void> {
    this.channel
      .on("broadcast", { event: BROADCAST_ENVELOPE }, (msg) =>
        this.handleBroadcast(msg.payload as Record<string, unknown>),
      )
      .on("presence", { event: "sync" }, () => this.emitPresence())
      .on("presence", { event: "join" }, () => this.emitPresence())
      .on("presence", { event: "leave" }, () => this.emitPresence())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_activity_states", filter: `room_id=eq.${this.roomId}` },
        (payload) => this.handleDurable(payload),
      );

    return new Promise((resolve, reject) => {
      this.channel.subscribe((s, err) => {
        this.status = err ? `${s}:${err.message}` : s;
        if (s === "SUBSCRIBED") {
          this.subscribed = true;
          resolve();
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          reject(new Error(this.status));
        }
      });
    });
  }

  get isSubscribed(): boolean {
    return this.subscribed;
  }

  // ── broadcast ──────────────────────────────────────────────────────────
  broadcast(kind: string, data: Record<string, unknown>): Promise<unknown> {
    return this.channel.send({
      type: "broadcast",
      event: BROADCAST_ENVELOPE,
      payload: { kind, data },
    });
  }

  onBroadcast(fn: BroadcastListener): () => void {
    this.broadcastListeners.add(fn);
    return () => this.broadcastListeners.delete(fn);
  }

  private handleBroadcast(raw: Record<string, unknown>) {
    const kind = typeof raw?.kind === "string" ? raw.kind : "unknown";
    const data = (raw?.data && typeof raw.data === "object" ? raw.data : {}) as Record<string, unknown>;
    const event: BroadcastEvent = { kind, payload: data, receivedAt: Date.now() };
    for (const fn of this.broadcastListeners) fn(event);
  }

  // ── durable (postgres_changes) ─────────────────────────────────────────
  onDurable(fn: DurableListener): () => void {
    this.durableListeners.add(fn);
    return () => this.durableListeners.delete(fn);
  }

  private handleDurable(payload: {
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  }) {
    const newRow = payload.new;
    const activityId = typeof newRow?.activity_id === "string" ? newRow.activity_id : undefined;
    if (!newRow || !activityId) return;
    const update: DurableUpdate = {
      activityId,
      newRow,
      oldRow: payload.old && Object.keys(payload.old).length > 0 ? payload.old : null,
      receivedAt: Date.now(),
    };
    for (const fn of this.durableListeners) fn(update);
  }

  // ── presence ───────────────────────────────────────────────────────────
  track(state: PresenceState): Promise<unknown> {
    return Promise.resolve(this.channel.track(state));
  }

  onPresence(fn: PresenceListener): () => void {
    this.presenceListeners.add(fn);
    return () => this.presenceListeners.delete(fn);
  }

  private emitPresence() {
    const list: PresenceState[] = [];
    const state = this.channel.presenceState<PresenceState>();
    for (const key of Object.keys(state)) {
      for (const p of state[key]) list.push(p);
    }
    for (const fn of this.presenceListeners) fn(list);
  }

  async dispose(): Promise<void> {
    this.broadcastListeners.clear();
    this.durableListeners.clear();
    this.presenceListeners.clear();
    this.subscribed = false;
    await supabase.removeChannel(this.channel);
    // Brief settle: re-creating a channel with the same topic immediately after
    // removeChannel can return a zombie that never reaches SUBSCRIBED. Matches
    // the mobile client's teardown delay.
    await new Promise((r) => setTimeout(r, 250));
  }
}
