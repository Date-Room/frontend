/**
 * Room customization context — keeps the room's chosen theme + background
 * accessible to every component inside the LiveRoom subtree (and PreRoom,
 * if we ever want to preview from there).
 *
 * Source of truth: `GET /v1/rooms/by-code/{code}` (the InviteCard, which
 * returns `theme_color` + `background_id`). We fetch via React Query so
 * cache invalidation is the trigger to re-render — exactly mirrors mobile's
 * `ref.invalidate(roomCustomizationProvider(roomId))` semantic.
 *
 * Live updates: the channel sends a "customize" broadcast after a PATCH
 * lands, and the listener invalidates the InviteCard query so the partner's
 * open tab refetches without a full reload.
 *
 * Apply: render <RoomCustomizationStyle /> as the first child of any
 * subtree that should follow the accent. It sets a CSS variable
 * `--room-accent` (+ `--room-accent-soft` for translucent washes) on its
 * own scope so descendant components can read it via Tailwind arbitrary
 * values: `bg-[var(--room-accent)]`, `border-[var(--room-accent)]/40`,
 * etc.
 */
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRoomByCode, listMyRooms, type InviteCard } from "@/lib/rooms";
import { PLAIN_MOOD, type LobbyMood } from "@/lib/ambiance";
import { resolveMoodFromBackgroundId } from "@/lib/roomAmbiance";
import { themeForId, type RoomThemePalette } from "@/lib/roomTheme";
import { useRoomSession } from "@/context/RoomSessionContext";

export type RoomCustomization = {
  /** Resolved theme palette — never null; falls back to the default. */
  theme: RoomThemePalette;
  /** Near-black shell behind photo backdrops. */
  backgroundCss: string;
  /** Raw stored slug — null when nothing's picked. */
  themeId: string | null;
  backgroundId: string | null;
  /** Lobby / live-room mood from the create wizard (photo + CSS wash, or plain). */
  ambiancePreset: LobbyMood;
};

/** Default DateRoom theme — returned when a component reads the hook
 *  outside the provider (so reads never throw or render undefined). */
const DEFAULT_CUSTOMIZATION: RoomCustomization = {
  theme: themeForId(null),
  backgroundCss: "#0a0508",
  themeId: null,
  backgroundId: null,
  ambiancePreset: "candlelit",
};

const Ctx = createContext<RoomCustomization>(DEFAULT_CUSTOMIZATION);

// eslint-disable-next-line react-refresh/only-export-components -- hook + provider co-located
export function useRoomCustomization(): RoomCustomization {
  return useContext(Ctx);
}

/**
 * Wraps `useRoomSession()` to derive the active room's theme/background
 * from the InviteCard. The `roomId` we need comes from the session
 * context; the room code we need to fetch the InviteCard comes from the
 * server-authoritative `listMyRooms` query (already cached by PreRoom in
 * the common host flow).
 *
 * Anonymous guests don't have access to `listMyRooms` (no auth token).
 * In that case we still try to look the room up by id by listening on the
 * shared cache for an InviteCard the host already populated — if nothing's
 * there, we silently fall back to the default theme.
 */
export function RoomCustomizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useRoomSession();
  const queryClient = useQueryClient();

  // Find the room code for this id. We piggyback on `my-rooms` for
  // signed-in users (cheap, cached, host always has it). Guests don't
  // have it — the value just stays undefined and we fall back to scanning
  // the existing query cache for an InviteCard that happens to be there.
  // Timestamp this room entry. We only trust customization data fetched
  // *after* this — never the stale cache — so a background changed before
  // rejoining can't flash the old scene.
  const enteredAt = useRef(Date.now());

  const { data: rooms, dataUpdatedAt: roomsUpdatedAt } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 0,
    refetchOnMount: "always",
    enabled: session.canPersist,
    retry: false,
  });

  const roomCode = useMemo(() => {
    const fromList = rooms?.find((r) => r.id === session.roomId)?.code;
    if (fromList) return fromList;
    // Anonymous-guest path — scan any cached InviteCard for our room id.
    const cached = queryClient.getQueriesData<InviteCard>({ queryKey: ["invite-card"] });
    for (const [, card] of cached) {
      if (card && card.id === session.roomId) return card.code;
    }
    return undefined;
  }, [rooms, session.roomId, queryClient]);

  const { data: card, dataUpdatedAt: cardUpdatedAt } = useQuery({
    queryKey: ["invite-card", roomCode],
    queryFn: () => (roomCode ? getRoomByCode(roomCode) : Promise.reject("no code")),
    enabled: !!roomCode,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // Listen for the host's "customize" broadcast — invalidate the
  // InviteCard query so this client refetches and re-derives. Replaces
  // the need to broadcast the full payload (the client just refetches
  // the canonical state).
  useEffect(() => {
    const off = session.channel.onBroadcast((e) => {
      if (e.kind !== "customize") return;
      if (!roomCode) return;
      void queryClient.invalidateQueries({ queryKey: ["invite-card", roomCode] });
    });
    return () => off();
  }, [session.channel, roomCode, queryClient]);

  const roomRow = useMemo(
    () => rooms?.find((r) => r.id === session.roomId),
    [rooms, session.roomId],
  );

  const themeId = card?.theme_color ?? roomRow?.theme_color ?? null;
  const backgroundId = card?.background_id ?? roomRow?.background_id ?? null;

  // Only reveal a background once we have data that landed *this* entry.
  // Until then (and if nothing has refetched yet) stay plain, so the room
  // opens with no background and eases the correct one in once it arrives.
  const freshUpdatedAt = Math.max(
    card ? cardUpdatedAt : 0,
    roomRow ? roomsUpdatedAt : 0,
  );
  const bgReady = freshUpdatedAt >= enteredAt.current;
  const ambiancePreset = bgReady ? resolveMoodFromBackgroundId(backgroundId) : PLAIN_MOOD;

  const value = useMemo<RoomCustomization>(() => {
    return {
      theme: themeForId(themeId),
      backgroundCss: "#0a0508",
      themeId,
      backgroundId,
      ambiancePreset,
    };
  }, [themeId, backgroundId, ambiancePreset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Inline style block — drops the resolved accent into a CSS variable on
 * its parent scope. Pair with a `style={{ ... }}` on the LiveRoom shell
 * for the background gradient. Components inside the scope read
 * `var(--room-accent)` via Tailwind arbitrary values.
 */
export function roomAccentStyle(theme: RoomThemePalette): React.CSSProperties {
  return {
    // Hex accent for solid fills/text/borders.
    ["--room-accent" as string]: theme.accent,
    // 12% rgba wash for halos/soft backgrounds.
    ["--room-accent-soft" as string]: theme.halo,
  };
}
