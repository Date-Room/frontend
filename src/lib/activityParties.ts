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
import { SOMEONE, peopleAre } from "@/lib/people";

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
    displayName: str(p.display_name) || str(p.name) || SOMEONE,
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

/**
 * Every activity anybody has open right now, me included.
 *
 * Deliberately not `partiesFrom`: that answers "where is everyone
 * ELSE", drops a party that is only me, and is the right input for a
 * list of things to join. It is the wrong input for "is this running",
 * which is what decides whether an activity is NEW.
 *
 * Conflating the two is what made the room re-announce a game. The
 * announced set was keyed on what was joinable *for me*, so it was
 * cleared the moment an activity stopped being joinable — which
 * happens when the last other person steps out for a second, and also
 * when **I** join, and also when I leave again. Each of those re-armed
 * the notice for a game that had been running the whole time.
 *
 * A fresh activity is one that nobody had open and now somebody does.
 * That is this set going from without to with.
 */
export function activeActivityIds(presence: PresenceState[]): Set<string> {
  const out = new Set<string>();
  for (const p of presence) {
    const id = str(p.activity_id);
    if (id) out.add(id);
  }
  return out;
}

/**
 * Am I in this one? Drives "Join in" vs "You're in", and suppresses the
 * notice for something I am already doing.
 *
 * `openHere` is what THIS client has open, which it knows before the
 * room does. Presence is a round trip: publish, server, fan-out, back.
 * In the window between opening something and seeing my own echo, a
 * presence update from somebody else in the same activity arrives and
 * the answer here was "no, you are not in it" — so the room offered to
 * take me somewhere I was already standing. Local truth about myself
 * beats a stale echo of myself.
 */
export function amIn(
  presence: PresenceState[],
  activityId: string,
  me: string | null,
  openHere?: string | null,
): boolean {
  if (openHere && openHere === activityId) return true;
  if (!me) return false;
  return presence.some(
    (p) => (str(p.user_id) || str(p.sender_id)) === me && str(p.activity_id) === activityId,
  );
}

/**
 * "Jun is in here" / "Ama, Jun and Tee are in here".
 *
 * The phrase and its verb agreement come from `peopleAre`, shared with
 * every other line that names people, so "Jun are in here" cannot come
 * back by being fixed in only one of them.
 */
export function partyLine(party: ActivityParty): string {
  const { subject, verb } = peopleAre(party.people.map((p) => p.displayName));
  return `${subject} ${verb} in here`;
}
