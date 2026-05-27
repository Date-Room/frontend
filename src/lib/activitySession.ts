/**
 * Per-activity session over a shared {@link RoomChannel} — the TS analog of
 * mobile's `RoomActivitySession` (`mobile/packages/activity_sdk`).
 *
 * Wire formats match mobile so web and mobile interoperate:
 *  - Activity events: broadcast `kind: "activity"`, data
 *    `{ activity_id, type, payload, user_id, timestamp, sequence_number }`.
 *  - Reactions: broadcast `kind: "reaction"`, data `{ kind, from, target?, sent_at }`.
 *  - Durable state: `GET/PUT /v1/rooms/{id}/activities/{activity_id}/state` plus
 *    postgres_changes on `room_activity_states` for cross-client convergence.
 *
 * Persisted snapshots use last-write-wins (`if_match_version: null`), matching
 * mobile: events converge state first, so the snapshot just records the result.
 */
import type { RoomChannel } from "@/lib/realtime/roomChannel";
import {
  getActivityState,
  putActivityState,
  type ActivityStateResponse,
} from "@/lib/activities/activityState";

export type ActivityEvent = {
  activityId: string;
  type: string;
  payload: Record<string, unknown>;
  userId: string;
  timestamp: string;
  sequenceNumber: number;
};

export type Reaction = {
  kind: string;
  from: string;
  target: string | null;
  sentAt: string;
};

export type DurableState = {
  state: Record<string, unknown>;
  version: number;
};

type StateListener = (s: DurableState) => void;
type EventListener = (e: ActivityEvent) => void;
type ReactionListener = (r: Reaction) => void;

export type ActivitySessionOptions = {
  roomId: string;
  activityId: string;
  /** Stable identity of this client (signed-in user id, or guest slot id). */
  senderId: string;
  /** Guests pass their participant_id so durable reads authorise. */
  participantId?: string;
  /** Only signed-in members may PUT durable state (backend rejects guest writes). */
  canPersist: boolean;
};

export class RoomActivitySession {
  readonly activityId: string;
  private readonly channel: RoomChannel;
  private readonly opts: ActivitySessionOptions;
  private serverVersion: number | null = null;
  private seq = 0;

  private readonly stateListeners = new Set<StateListener>();
  private readonly eventListeners = new Set<EventListener>();
  private readonly reactionListeners = new Set<ReactionListener>();
  private readonly unsubscribers: Array<() => void> = [];

  constructor(channel: RoomChannel, opts: ActivitySessionOptions) {
    this.channel = channel;
    this.opts = opts;
    this.activityId = opts.activityId;

    // Durable convergence: re-emit postgres_changes rows for this activity.
    this.unsubscribers.push(
      channel.onDurable((u) => {
        if (u.activityId !== this.activityId) return;
        const version = typeof u.newRow.version === "number" ? u.newRow.version : 0;
        const state = (u.newRow.state ?? {}) as Record<string, unknown>;
        if (this.serverVersion !== null && version < this.serverVersion) return;
        this.serverVersion = version;
        this.emitState({ state, version });
      }),
    );

    // Broadcast fan-out: split into activity events vs reactions.
    this.unsubscribers.push(
      channel.onBroadcast((e) => {
        if (e.kind === "activity") {
          const d = e.payload;
          if (d.activity_id !== this.activityId) return;
          this.emitEvent({
            activityId: this.activityId,
            type: String(d.type ?? ""),
            payload: (d.payload ?? {}) as Record<string, unknown>,
            userId: String(d.user_id ?? ""),
            timestamp: String(d.timestamp ?? ""),
            sequenceNumber: typeof d.sequence_number === "number" ? d.sequence_number : 0,
          });
        } else if (e.kind === "reaction") {
          const d = e.payload;
          this.emitReaction({
            kind: String(d.kind ?? ""),
            from: String(d.from ?? ""),
            target: d.target == null ? null : String(d.target),
            sentAt: String(d.sent_at ?? ""),
          });
        }
      }),
    );
  }

  /** Load the latest persisted state (or null if never opened). */
  async hydrate(): Promise<DurableState | null> {
    const row: ActivityStateResponse | null = await getActivityState(
      this.opts.roomId,
      this.activityId,
      this.opts.participantId,
    );
    if (!row) return null;
    this.serverVersion = row.version;
    const ds = { state: row.state, version: row.version };
    this.emitState(ds);
    return ds;
  }

  /** Broadcast an activity event (ephemeral, low-latency). */
  sendEvent(type: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    this.seq += 1;
    return this.channel.broadcast("activity", {
      activity_id: this.activityId,
      type,
      payload,
      user_id: this.opts.senderId,
      timestamp: new Date().toISOString(),
      sequence_number: this.seq,
    });
  }

  /** Persist a durable snapshot (members only). Updates the tracked version. */
  async persist(state: Record<string, unknown>): Promise<void> {
    if (!this.opts.canPersist) return;
    const row = await putActivityState(this.opts.roomId, this.activityId, {
      state,
      if_match_version: null, // last-write-wins; events already converged it
    });
    this.serverVersion = row.version;
  }

  sendReaction(kind: string, target: string | null = null): Promise<unknown> {
    return this.channel.broadcast("reaction", {
      kind,
      from: this.opts.senderId,
      target,
      sent_at: new Date().toISOString(),
    });
  }

  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  onEvent(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  onReaction(fn: ReactionListener): () => void {
    this.reactionListeners.add(fn);
    return () => this.reactionListeners.delete(fn);
  }

  dispose(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers.length = 0;
    this.stateListeners.clear();
    this.eventListeners.clear();
    this.reactionListeners.clear();
  }

  private emitState(s: DurableState) {
    for (const fn of this.stateListeners) fn(s);
  }
  private emitEvent(e: ActivityEvent) {
    for (const fn of this.eventListeners) fn(e);
  }
  private emitReaction(r: Reaction) {
    for (const fn of this.reactionListeners) fn(r);
  }
}
