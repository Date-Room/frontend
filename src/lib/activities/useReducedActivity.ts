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
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";

type ReducerEvent = { type: string; payload: Record<string, unknown>; userId: string };

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
  }, [session, room.canPersist, reduce, room.senderId]);

  const emit = useCallback(
    (type: string, payload: Record<string, unknown> = {}, recap?: EmitRecap) => {
      nextRecap.current = recap ?? null;
      void session?.sendEvent(type, payload);
    },
    [session],
  );

  return { state, emit, senderId: room.senderId };
}
