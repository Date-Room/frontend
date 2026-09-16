/**
 * Shared event-sourced wiring for reducer-based activities (the_36, 2_truths,
 * truth_or_dare, questions). Every broadcast event (own echo included) runs
 * through the activity's reducer; members persist the result for late-join;
 * initial state seeds from the durable snapshot.
 *
 * Recap events: callers can pass a `recap` field to `emit()` and it travels
 * on the next persist call — only for OUR moves (not partner echoes), so
 * the timeline doesn't double-log.
 *
 * `initial`, `fromJson`, and `reduce` must be stable (module-level) functions.
 *
 * Reconnect re-sync: the server keeps no replay buffer, so a dropped socket
 * loses every broadcast sent while it was down — the partner's moves AND
 * our own echoes — and the durable snapshot seeds only once. A flaky
 * connection used to leave a client permanently behind ("she got the
 * results and I was stuck", live 2026-09-14). Now, on every reconnect we
 * ask peers for their live state and adopt it (they didn't drop, so theirs
 * is authoritative); if nobody answers, we fall back to the durable
 * snapshot. The two control events never reach the game reducers.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";

type ReducerEvent = { type: string; payload: Record<string, unknown>; userId: string };

const RESYNC = "__resync";
const SNAPSHOT = "__snapshot";
/** How long to wait for a peer snapshot before taking the durable one. */
const RESYNC_FALLBACK_MS = 2500;

export type EmitRecap = {
  event_type: string;
  payload?: Record<string, unknown>;
};

export function useReducedActivity<S>(
  activityId: string,
  initial: () => S,
  fromJson: (j: Record<string, unknown>) => S,
  reduce: (state: S, event: ReducerEvent) => S,
): {
  state: S;
  emit: (type: string, payload?: Record<string, unknown>, recap?: EmitRecap) => void;
  senderId: string;
} {
  const room = useRoomSession();
  const { session, state: durable } = useActivitySession(activityId);
  const [state, setState] = useState<S>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const seeded = useRef(false);
  // One-shot stash for the next emit's recap event. Cleared inside the
  // reducer effect once consumed by a self-event's persist call.
  const nextRecap = useRef<EmitRecap | null>(null);
  // Nonce of the re-sync we're waiting on (null = not waiting).
  const resyncNonce = useRef<string | null>(null);

  const adopt = useCallback(
    (json: Record<string, unknown>, persist: boolean) => {
      const next = fromJson(json);
      stateRef.current = next;
      setState(next);
      seeded.current = true;
      if (persist && room.canPersist) {
        void session?.persist(next as unknown as Record<string, unknown>);
      }
    },
    [fromJson, room.canPersist, session],
  );

  // Seed once from the persisted snapshot (initial hydrate / late join).
  useEffect(() => {
    if (seeded.current || !durable) return;
    const init = fromJson(durable);
    stateRef.current = init;
    setState(init);
    seeded.current = true;
  }, [durable, fromJson]);

  // Drive state from every event (self-echo included) through the reducer.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      // Re-sync control traffic — answered here, never reduced.
      if (e.type === RESYNC) {
        if (e.userId === room.senderId) return;
        void session.sendEvent(SNAPSHOT, {
          nonce: e.payload.nonce,
          state: stateRef.current as unknown as Record<string, unknown>,
        });
        return;
      }
      if (e.type === SNAPSHOT) {
        if (e.userId === room.senderId) return;
        if (resyncNonce.current == null || e.payload.nonce !== resyncNonce.current) return;
        const snap = e.payload.state;
        if (!snap || typeof snap !== "object") return;
        resyncNonce.current = null;
        adopt(snap as Record<string, unknown>, true);
        return;
      }
      const next = reduce(stateRef.current, { type: e.type, payload: e.payload, userId: e.userId });
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      if (room.canPersist) {
        const recap = e.userId === room.senderId ? nextRecap.current ?? undefined : undefined;
        if (recap) nextRecap.current = null;
        void session.persist(next as unknown as Record<string, unknown>, recap);
      }
    });
  }, [session, room.canPersist, reduce, room.senderId, adopt]);

  // After a reconnect: ask peers for the live state; fall back to durable.
  useEffect(() => {
    if (!session) return;
    return room.channel.onReconnect(() => {
      const nonce = crypto.randomUUID();
      resyncNonce.current = nonce;
      void session.sendEvent(RESYNC, { nonce });
      window.setTimeout(() => {
        if (resyncNonce.current !== nonce) return; // a peer already answered
        resyncNonce.current = null;
        void session
          .hydrate()
          .then((ds) => {
            if (ds) adopt(ds.state, false);
          })
          .catch(() => null);
      }, RESYNC_FALLBACK_MS);
    });
  }, [session, room.channel, adopt]);

  const emit = useCallback(
    (type: string, payload: Record<string, unknown> = {}, recap?: EmitRecap) => {
      nextRecap.current = recap ?? null;
      void session?.sendEvent(type, payload);
    },
    [session],
  );

  return { state, emit, senderId: room.senderId };
}
