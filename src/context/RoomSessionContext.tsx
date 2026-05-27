/**
 * Live-room session context — the single source of truth for "who am I in this
 * room and how do I talk to it." Replaces the old monolithic `RoomScopeContext`
 * + `useRoomState`/`usePlayerSlot` model.
 *
 * Owns one {@link RoomChannel} (Supabase Realtime) for the room and exposes the
 * caller's identity: signed-in member vs. anonymous guest, slot from the join
 * response, and whether they may persist durable state.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RoomChannel, type PresenceState } from "@/lib/realtime/roomChannel";

export type RoomIdentity = {
  /** Stable id used as the sender on broadcasts: user id, or `guest-<participantId>`. */
  senderId: string;
  /** Seat in the room, "a" | "b". */
  slot: string;
  /** Present for anonymous guests (from the join response). */
  participantId?: string;
  /** The room host (creator). */
  isHost: boolean;
  /** Only signed-in members may PUT durable activity state. */
  canPersist: boolean;
  displayName: string;
};

export type RoomSession = RoomIdentity & {
  roomId: string;
  channel: RoomChannel;
  presence: PresenceState[];
  /** Channel subscription status, for debug surfaces. */
  status: string;
};

const Ctx = createContext<RoomSession | null>(null);

export function useRoomSession(): RoomSession {
  const s = useContext(Ctx);
  if (!s) throw new Error("useRoomSession must be used within a RoomSessionProvider");
  return s;
}

export function RoomSessionProvider({
  roomId,
  identity,
  children,
}: {
  roomId: string;
  identity: RoomIdentity;
  children: React.ReactNode;
}) {
  const channelRef = useRef<RoomChannel | null>(null);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [status, setStatus] = useState("connecting");

  // One channel per room id. Identity changes don't recreate the socket.
  if (!channelRef.current) channelRef.current = new RoomChannel(roomId);
  const channel = channelRef.current;

  useEffect(() => {
    let disposed = false;
    const offPresence = channel.onPresence((p) => setPresence(p));
    void channel
      .open()
      .then(() => {
        if (disposed) return;
        setStatus("connected");
        void channel.track({
          sender_id: identity.senderId,
          slot: identity.slot,
          name: identity.displayName,
          is_host: identity.isHost,
        });
      })
      .catch(() => {
        if (!disposed) setStatus(channel.status);
      });

    return () => {
      disposed = true;
      offPresence();
      void channel.dispose();
      channelRef.current = null;
    };
    // Re-open only when the room changes; identity is read fresh inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const value = useMemo<RoomSession>(
    () => ({ roomId, channel, presence, status, ...identity }),
    [roomId, channel, presence, status, identity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
