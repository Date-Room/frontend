/**
 * Pure helpers for the squad room between nights (/squad/room/:id): who's
 * here now, when a night may start, planned times in everyone's own clock,
 * and the nights log.
 */
import type { PresenceState } from "@/lib/realtime/roomChannel";
import type { SquadMember, SquadNight, SquadNights, SquadPlanView } from "@/lib/squad";

/** A night starts once this many of the squad are in the room. */
export const START_MIN_PRESENT = 2;

/**
 * Pure: why "Start a night" is dead, or null when it is live.
 *
 * A disabled button that says nothing is worse than no button at all.
 * The out-of-nights case had no line under it — the only clue the room
 * was empty was "No nights left" set in 11px beside the seat count at
 * the top of the page, and an "Add nights" card three sections down.
 * Everyone who hit it read the button as broken, which is exactly what
 * it looks like.
 *
 * The order matters: an empty room is still empty when you are alone in
 * it, and topping up is the thing to do about it either way, so the
 * balance is reported before the headcount.
 */
export function startBlockedReason(nights: SquadNights, presentCount: number): string | null {
  // A night is at least two seats, so one spare seat still cannot start one.
  if (nights.seat_nights < 2) {
    return nights.seat_nights === 1
      ? "One spare seat in the room — a night needs two. Add nights below."
      : "This room is out of nights. Add nights below to start one.";
  }
  if (presentCount < START_MIN_PRESENT) {
    return "Waiting for one more. Send the link or say hi in the chat.";
  }
  return null;
}

/** The planned time starts the night for up to this long after it. */
export const PLANNED_WINDOW_MS = 3 * 60 * 60 * 1000;

export type HereNow = { userId: string; name: string; member: SquadMember | null };

/** Pure: everyone on the room's channel right now, one entry per person,
 *  named from the squad list where we know them. */
export function hereNow(presence: PresenceState[], members: SquadMember[]): HereNow[] {
  const byUser = new Map(members.filter((m) => m.user_id).map((m) => [m.user_id as string, m]));
  const seen = new Set<string>();
  const out: HereNow[] = [];
  for (const p of presence) {
    const userId = String(p.user_id ?? p.sender_id ?? "");
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    const member = byUser.get(userId) ?? null;
    const name = member?.display_name || String(p.display_name ?? p.name ?? "Someone");
    out.push({ userId, name, member });
  }
  return out;
}

/** Pure: "Wanjiru and Amaka are here" / "Just you" / "Nobody's here yet". */
export function hereLine(people: HereNow[], selfId: string): string {
  const others = people.filter((p) => p.userId !== selfId).map((p) => p.name);
  const hasSelf = people.some((p) => p.userId === selfId);
  if (others.length === 0) return hasSelf ? "Just you for now" : "Nobody's here yet";
  const names = hasSelf ? ["You", ...others] : others;
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? "is" : "are"} here`;
}

/** Pure: is the planned time now (from the time itself to 3 hours after)? */
export function plannedStartDue(nextNightAt: string | null, now: number): boolean {
  if (!nextNightAt) return false;
  const at = new Date(nextNightAt).getTime();
  return now >= at && now <= at + PLANNED_WINDOW_MS;
}

/** Pure: which one of the people here starts a planned night, so two
 *  browsers don't race: the lowest user id. */
export function isAutoStarter(people: HereNow[], selfId: string): boolean {
  const ids = people.map((p) => p.userId).sort();
  return ids[0] === selfId;
}

/** Pure: "Fri 3 Oct, 8:30 PM" in a zone (the viewer's own by default). */
export function dayTime(iso: string, tz?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  };
  try {
    return new Date(iso).toLocaleString(undefined, tz ? { ...opts, timeZone: tz } : opts);
  } catch {
    return new Date(iso).toLocaleString(undefined, opts);
  }
}

/** Pure: "6:30 PM" in a zone. */
export function clockIn(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz });
  } catch {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
}

/** Pure: the same moment on the squad's other clocks, one line per zone:
 *  "Amaka 6:30 PM Lagos". People in my own zone are left out. */
export function otherClocks(
  iso: string,
  people: SquadPlanView["members"],
  myTz: string | null,
  selfParticipantId?: string | null,
): string[] {
  const byZone = new Map<string, { names: string[]; city: string | null }>();
  for (const p of people) {
    if (!p.tz || p.tz === myTz || p.participant_id === selfParticipantId) continue;
    const z = byZone.get(p.tz) ?? { names: [], city: p.city };
    z.names.push(p.display_name);
    z.city = z.city ?? p.city;
    byZone.set(p.tz, z);
  }
  return [...byZone.entries()].map(([tz, z]) => {
    const place = z.city || tz.split("/").pop()?.replace(/_/g, " ") || tz;
    return `${z.names.join(" & ")} ${clockIn(iso, tz)} ${place}`;
  });
}

/** Pure: a datetime-local input value for a date in the viewer's clock. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Pure: a suggested first time: the next 8 PM at least an hour away. */
export function suggestedTime(now: Date): Date {
  const d = new Date(now);
  d.setHours(20, 0, 0, 0);
  if (d.getTime() - now.getTime() < 60 * 60 * 1000) d.setDate(d.getDate() + 1);
  return d;
}

/** Pure: one line in "Our nights". */
export function nightLine(n: SquadNight): string {
  const day = new Date(n.started_at).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (n.refunded) return `${day} · didn't count (everyone left early)`;
  const extra = n.extended_minutes ? ` + ${n.extended_minutes} min` : "";
  const how = n.rate === "free" ? " · free night" : "";
  return `${day} · ${n.seats} seats · 2h${extra}${how}`;
}
