/**
 * Live-room session context — the single source of truth for "who am I in this
 * room and how do I talk to it." Replaces the old monolithic `RoomScopeContext`
 * + `useRoomState`/`usePlayerSlot` model.
 *
 * Owns one {@link RoomChannel} (backend WebSocket) for the room and exposes the
 * caller's identity: signed-in member vs. anonymous guest, slot from the join
 * response, and whether they may persist durable state.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RoomChannel, type PresenceState } from "@/lib/realtime/roomChannel";
import type { RoomPackage } from "@/lib/rooms";
import type { CuratableActivityId } from "@/lib/roomExperience";

export type RoomIdentity = {
  /** Stable id used as the sender on broadcasts: user id, or `guest-<participantId>`. */
  senderId: string;
  /** Seat in the room — host is "a"; watch parties use a–l. */
  slot: string;
  /** Present for anonymous guests (from the join response). */
  participantId?: string;
  /** The room host (creator). */
  isHost: boolean;
  /** Only signed-in members may PUT durable activity state. */
  canPersist: boolean;
  displayName: string;
  /** Broadcast on presence so the partner can render an avatar when
   *  cameras are off (matches mobile's PresenceState.photoUrl). */
  photoUrl?: string | null;
};

export type RoomSession = RoomIdentity & {
  roomId: string;
  channel: RoomChannel;
  presence: PresenceState[];
  /** Channel subscription status, for debug surfaces. */
  status: string;
  roomPackage: RoomPackage | null;
  curatedActivityIds: CuratableActivityId[];
  /** Max people allowed in the room (2 for dates, 12 for watch parties). */
  maxParticipants: number;
};

const Ctx = createContext<RoomSession | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider; extracting it would ripple imports for a dev-only Fast Refresh hint
export function useRoomSession(): RoomSession {
  const s = useContext(Ctx);
  if (!s) throw new Error("useRoomSession must be used within a RoomSessionProvider");
  return s;
}

export function RoomSessionProvider({
  roomId,
  identity,
  roomPackage = null,
  curatedActivityIds = [],
  maxParticipants = 2,
  children,
}: {
  roomId: string;
  identity: RoomIdentity;
  roomPackage?: RoomPackage | null;
  curatedActivityIds?: CuratableActivityId[];
  maxParticipants?: number;
  children: React.ReactNode;
}) {
  const channelRef = useRef<RoomChannel | null>(null);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [status, setStatus] = useState("connecting");

  // One channel per room id. Identity changes don't recreate the socket.
  if (!channelRef.current) {
    channelRef.current = new RoomChannel(roomId, { participantId: identity.participantId });
  }
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
          // Web-legacy fields — kept for web code that still reads
          // sender_id / name / is_host.
          sender_id: identity.senderId,
          slot: identity.slot,
          name: identity.displayName,
          is_host: identity.isHost,
          // Canonical PresenceState fields — what the mobile client
          // reads off the wire. Without these, mobile's
          // PresenceState.fromJson failed on web-sent presence and
          // mobile saw no partner (capture footer rendered just the
          // self name). Sending both lets either client find the
          // other regardless of which schema it knows.
          user_id: identity.senderId,
          display_name: identity.displayName,
          photo_url: identity.photoUrl ?? null,
          // Mirror the mobile flags so cross-platform code paths
          // (typing dots, in-call halo) see consistent state.
          is_ready: true,
          is_typing: false,
          is_in_call: false,
          last_seen: new Date().toISOString(),
          // Surfaces a stable handle to kick by; only guests have one
          // (signed-in partners don't need it for DELETE /participants).
          participant_id: identity.participantId ?? null,
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
    () => ({
      roomId,
      channel,
      presence,
      status,
      roomPackage,
      curatedActivityIds,
      maxParticipants,
      ...identity,
    }),
    [roomId, channel, presence, status, roomPackage, curatedActivityIds, maxParticipants, identity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
