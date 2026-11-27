/**
 * Live-room session context — the single source of truth for "who am I in this
 * room and how do I talk to it." Replaces the old monolithic `RoomScopeContext`
 * + `useRoomState`/`usePlayerSlot` model.
 *
 * Owns one {@link RoomChannel} (backend WebSocket) for the room and exposes the
 * caller's identity: signed-in member vs. anonymous guest, slot from the join
 * response, and whether they may persist durable state.
 */
import { TAB_DEVICE_ID } from "@/lib/deviceId";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RoomChannel, type PresenceState } from "@/lib/realtime/roomChannel";
import type { RoomPackage } from "@/lib/rooms";
import type { CuratableActivityId } from "@/lib/roomExperience";
import { basePresence, mergePresence, noteArrivals } from "@/lib/presencePayload";

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
  /**
   * Change some of what this tab says about itself, keeping the rest.
   *
   * Presence goes out as a whole object, so every caller of
   * `channel.track` has to send every field — and there were three,
   * each knowing its own flag and spelling out the others from
   * memory. That is how `is_in_call` and `is_typing` ended up being
   * asserted by code that had no idea whether either was true. Merge
   * here instead: a caller changes the one thing it came to change.
   */
  setPresence: (patch: Record<string, unknown>) => void;
};

const Ctx = createContext<RoomSession | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider; extracting it would ripple imports for a dev-only Fast Refresh hint
export function useRoomSession(): RoomSession {
  const s = useContext(Ctx);
  if (!s) throw new Error("useRoomSession must be used within a RoomSessionProvider");
  return s;
}

/** The room session, or null outside one (tests, previews). */
// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useMaybeRoomSession(): RoomSession | null {
  return useContext(Ctx);
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
  // What this tab is currently publishing, so a patch can be merged
  // onto it rather than every caller restating the whole thing.
  //
  // Seeded by the initial track below. It used to stay `{}` while that
  // track wrote its payload straight to the channel, and because
  // `presence.update` REPLACES the server's snapshot rather than
  // merging into it, the first patch published
  // `{ activity_id, last_seen }` and nothing else — no user_id, no
  // name, no photo, no is_in_call, no participant_id. The only caller
  // of the patch is "I opened an activity", so a web user stopped
  // being identifiable at the exact moment they became interesting to
  // everyone else: a blank avatar and a nameless face on mobile, and
  // on web `personOf()` returned null for the empty user_id, so the
  // activity was dropped from the ongoing list altogether.
  const published = useRef<Record<string, unknown>>({});
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [status, setStatus] = useState("connecting");

  // One channel per room id. Identity changes don't recreate the socket.
  if (!channelRef.current) {
    channelRef.current = new RoomChannel(roomId, { participantId: identity.participantId });
  }
  const channel = channelRef.current;

  // Read inside the long-lived presence callback, which outlives the
  // render that created it — the effect below is keyed on roomId alone,
  // so a closure over `identity` there would be the first render's.
  const identityRef = useRef(identity);
  identityRef.current = identity;

  // Connections already seen in this room. See `noteArrivals`, which
  // owns the rule.
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let disposed = false;
    const offPresence = channel.onPresence((p) => {
      setPresence(p);
      // Somebody new in the room? Say again what this tab has open, so
      // they see a game that was already running when they arrived.
      const newcomer = noteArrivals(p, seen.current, {
        senderId: identityRef.current.senderId,
        deviceId: TAB_DEVICE_ID,
      });
      if (newcomer && Object.keys(published.current).length > 0) {
        published.current = mergePresence(published.current, {});
        void channel.track(published.current);
      }
    });
    void channel
      .open()
      .then(() => {
        if (disposed) return;
        setStatus("connected");
        // Recorded as well as sent: a later patch merges onto this, and
        // the wire replaces rather than merges (see `published`).
        //
        // The base goes UNDERNEATH anything already patched, never over
        // it. `open()` is async, and the stage restores what it had
        // open from localStorage the moment it mounts — so
        // "I am in Most Likely To" routinely reaches `published`
        // BEFORE this line runs. Assigning the base outright threw
        // that away and published activity_id: null.
        //
        // Nothing then put it back: the patch only fires when the
        // staged activity CHANGES, and it had not changed — it was
        // restored. So the tab spent the whole night telling the room
        // it was in nothing, every phone that walked in was handed
        // that in its presence snapshot, and even re-announcing on
        // arrival re-sent the same wiped record. The only cure was to
        // open something else, or rejoin.
        //
        // George: "I joined the squad room later than the web on
        // mobile with my 2 phones.. They aren't even aware of the
        // ongoing Most likely game... I shouldn't have to always
        // refresh, rejoin, join at the same time to re-establish sync."
        published.current = mergePresence(
          basePresence(identity, TAB_DEVICE_ID),
          published.current,
        );
        void channel.track(published.current);
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

  const patchPresence = useCallback(
    (patch: Record<string, unknown>) => {
      published.current = mergePresence(published.current, patch);
      void channel.track(published.current);
    },
    [channel],
  );

  const value = useMemo<RoomSession>(
    () => ({
      roomId,
      channel,
      presence,
      status,
      roomPackage,
      curatedActivityIds,
      maxParticipants,
      setPresence: patchPresence,
      ...identity,
    }),
    [roomId, channel, presence, status, roomPackage, curatedActivityIds, maxParticipants, patchPresence, identity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
