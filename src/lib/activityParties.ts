/**
 * Who is doing what, derived from presence.
 *
 * The twin of mobile's `features/live_room/activity_presence.dart` —
 * same grouping, same ordering, same exclusions — because the two
 * clients are looking at the same room and disagreeing about who is in
 * a game is worse than either answer.
 *
 * Derived rather than broadcast on purpose: someone who walks in late
 * gets the whole picture from the presence snapshot, which no stream of
 * "X opened Y" events could ever give them.
 */
import type { PresenceState } from "@/lib/realtime/roomChannel";

export type PartyPerson = {
  userId: string;
  displayName: string;
  photoUrl: string | null;
};

export type ActivityParty = {
  activityId: string;
  /** In the order they joined, so the first face started it. */
  people: PartyPerson[];
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Presence entries carry two schemas; read both. */
function personOf(p: PresenceState): PartyPerson | null {
  const userId = str(p.user_id) || str(p.sender_id);
  if (!userId) return null;
  return {
    userId,
    displayName: str(p.display_name) || str(p.name) || "Someone",
    photoUrl: typeof p.photo_url === "string" && p.photo_url ? p.photo_url : null,
  };
}

function joinedAt(p: PresenceState): number {
  const t = Date.parse(str(p.last_seen));
  return Number.isFinite(t) ? t : 0;
}

/**
 * Everything going on in the room right now, busiest first.
 *
 * `me` is dropped from each party: this exists to say where everyone
 * ELSE is, and a party of one that is only you is not something to be
 * invited to. A party you are in still shows, so you can see who came.
 */
export function partiesFrom(presence: PresenceState[], me: string | null): ActivityParty[] {
  const byActivity = new Map<string, { person: PartyPerson; at: number }[]>();
  const seen = new Set<string>();

  for (const p of presence) {
    const activityId = str(p.activity_id);
    if (!activityId) continue;
    const person = personOf(p);
    if (!person) continue;
    // One person, not one connection: the same account on a phone and
    // a laptop is one face in the room, not two.
    const key = `${person.userId}|${activityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byActivity.get(activityId) ?? [];
    list.push({ person, at: joinedAt(p) });
    byActivity.set(activityId, list);
  }

  const parties: ActivityParty[] = [];
  for (const [activityId, entries] of byActivity) {
    entries.sort((a, b) => a.at - b.at);
    const people = entries.map((e) => e.person).filter((x) => x.userId !== me);
    if (people.length === 0) continue; // only me in there
    parties.push({ activityId, people });
  }

  // Busiest first, then by id so the order never jitters between two
  // parties of the same size.
  parties.sort((a, b) =>
    b.people.length - a.people.length || a.activityId.localeCompare(b.activityId),
  );
  return parties;
}

/** Am I in this one? Drives "Join in" vs "You're in". */
export function amIn(presence: PresenceState[], activityId: string, me: string | null): boolean {
  if (!me) return false;
  return presence.some(
    (p) => (str(p.user_id) || str(p.sender_id)) === me && str(p.activity_id) === activityId,
  );
}

/** "Jun is in here" / "Ama, Jun and Tee are in here". */
export function partyLine(party: ActivityParty): string {
  const names = party.people.map((p) => p.displayName).filter(Boolean);
  if (names.length === 0) return "Someone is in here";
  if (names.length === 1) return `${names[0]} is in here`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are in here`;
}
