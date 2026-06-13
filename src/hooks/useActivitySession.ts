/**
 * Binds an activity to the room's shared channel. Returns a live
 * {@link RoomActivitySession} plus the latest durable state and version, kept
 * current via hydrate → postgres_changes. Activity reducers layer on top:
 * apply broadcast events optimistically, then `persist()` the result.
 */
import { useEffect, useRef, useState } from "react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { RoomActivitySession } from "@/lib/activitySession";

export type UseActivitySession = {
  session: RoomActivitySession | null;
  /** Latest durable state blob (null until first hydrate/postgres event). */
  state: Record<string, unknown> | null;
  version: number;
  /** True once the initial hydrate call has resolved. */
  ready: boolean;
};

export function useActivitySession(activityId: string): UseActivitySession {
  const room = useRoomSession();
  const sessionRef = useRef<RoomActivitySession | null>(null);
  const [session, setSession] = useState<RoomActivitySession | null>(null);
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    setState(null);
    setVersion(0);
    setSession(null);

    const session = new RoomActivitySession(room.channel, {
      roomId: room.roomId,
      activityId,
      senderId: room.senderId,
      participantId: room.participantId,
      canPersist: room.canPersist,
    });
    sessionRef.current = session;
    setSession(session);

    const offState = session.onState((s) => {
      setState(s.state);
      setVersion(s.version);
    });

    let cancelled = false;
    void session
      .hydrate()
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      offState();
      session.dispose();
      sessionRef.current = null;
      setSession(null);
    };
  }, [room.channel, room.roomId, room.senderId, room.participantId, room.canPersist, activityId]);

  return { session, state, version, ready };
}
