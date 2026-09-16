/**
 * The partner's name from room presence, for game copy ("Kiki's order",
 * "You think Kiki cut…"). Presence arrives in two schemas — web-legacy
 * (sender_id / name) and mobile-canonical (user_id / display_name) — and a
 * mobile partner sends only the canonical one, so both must be read or the
 * games call a present partner "Them" (live-tested).
 */
import { useMemo } from "react";
import { useRoomSession } from "@/context/RoomSessionContext";

type PresenceEntry = Record<string, unknown>;

function presenceId(p: PresenceEntry): string {
  return (
    (typeof p.sender_id === "string" && p.sender_id) ||
    (typeof p.user_id === "string" && p.user_id) ||
    ""
  );
}

function presenceName(p: PresenceEntry): string {
  const raw =
    (typeof p.name === "string" && p.name) ||
    (typeof p.display_name === "string" && p.display_name) ||
    "";
  return raw.trim();
}

/** The first OTHER person in presence, or null when you're alone. */
export function partnerFromPresence(
  presence: PresenceEntry[],
  senderId: string,
): { first: string | null; full: string | null; photoUrl: string | null } {
  const entry = presence.find((p) => {
    const id = presenceId(p);
    return Boolean(id) && id !== senderId;
  });
  if (!entry) return { first: null, full: null, photoUrl: null };
  const full = presenceName(entry) || null;
  const first = full ? (full.split(/\s+/)[0] ?? "").slice(0, 12) || null : null;
  const photoUrl = (typeof entry.photo_url === "string" && entry.photo_url) || null;
  return { first, full, photoUrl };
}

export function usePartnerName(): string {
  const room = useRoomSession();
  return useMemo(
    () => partnerFromPresence(room.presence, room.senderId).first ?? "Them",
    [room.presence, room.senderId],
  );
}
