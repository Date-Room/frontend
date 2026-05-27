/**
 * Shared event-sourced wiring for reducer-based activities (the_36, 2_truths,
 * truth_or_dare, questions). Every broadcast event (own echo included) runs
 * through the activity's reducer; members persist the result for late-join;
 * initial state seeds from the durable snapshot.
 *
 * `initial`, `fromJson`, and `reduce` must be stable (module-level) functions.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";

type ReducerEvent = { type: string; payload: Record<string, unknown>; userId: string };

export function useReducedActivity<S>(
  activityId: string,
  initial: () => S,
  fromJson: (j: Record<string, unknown>) => S,
  reduce: (state: S, event: ReducerEvent) => S,
): { state: S; emit: (type: string, payload?: Record<string, unknown>) => void; senderId: string } {
  const room = useRoomSession();
  const { session, state: durable } = useActivitySession(activityId);
  const [state, setState] = useState<S>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const seeded = useRef(false);

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
      if (room.canPersist) void session.persist(next as unknown as Record<string, unknown>);
    });
  }, [session, room.canPersist, reduce]);

  const emit = useCallback(
    (type: string, payload: Record<string, unknown> = {}) => {
      void session?.sendEvent(type, payload);
    },
    [session],
  );

  return { state, emit, senderId: room.senderId };
}
