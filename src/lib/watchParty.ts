/**
 * Watch Party — group viewing for the Crew tier (up to 5 people).
 * Together is a couples product (2). Capacity is server-authoritative:
 * pass the room's `max_participants` and these helpers reflect it.
 */
export const CREW_CAPACITY = 5;
export const COUPLE_CAPACITY = 2;

export function isWatchPartyRoom(maxParticipants?: number | null): boolean {
  // Any room seating more than a couple is a group / watch-party room.
  // Legacy rooms with a larger stored cap still qualify.
  return (maxParticipants ?? COUPLE_CAPACITY) > COUPLE_CAPACITY;
}

export function watchPartyLabel(maxParticipants?: number | null): string {
  if (!isWatchPartyRoom(maxParticipants)) return "";
  return `Watch party · up to ${maxParticipants ?? CREW_CAPACITY} people`;
}

export function tierSupportsWatchParty(tier: string | null | undefined): boolean {
  return tier === "together" || tier === "crew";
}
