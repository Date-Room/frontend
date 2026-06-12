/**
 * Watch Party — group viewing for Together + Crew tiers (10+ people).
 */
export const WATCH_PARTY_CAPACITY = 12;
export const COUPLE_CAPACITY = 2;

export function isWatchPartyRoom(maxParticipants?: number | null): boolean {
  return (maxParticipants ?? COUPLE_CAPACITY) >= WATCH_PARTY_CAPACITY;
}

export function watchPartyLabel(maxParticipants?: number | null): string {
  if (!isWatchPartyRoom(maxParticipants)) return "";
  return `Watch party · up to ${maxParticipants ?? WATCH_PARTY_CAPACITY} people`;
}

export function tierSupportsWatchParty(tier: string | null | undefined): boolean {
  return tier === "together" || tier === "crew";
}
