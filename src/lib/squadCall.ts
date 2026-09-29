/**
 * Pure helpers for the squad call (GroupStage): everyone's own clock,
 * the night's time left, who gets live video on a weak phone, and the
 * grid shape. Kept out of the component so they're tested on their own.
 */

/** "8:30 PM" in a member's zone, or null when we don't know their zone. */
export function localClock(tz: string | null | undefined, now: Date = new Date()): string | null {
  if (!tz) return null;
  try {
    return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  } catch {
    return null;
  }
}

/** "Nairobi · 8:30 PM", "Nairobi", "8:30 PM" or "" for a face's label. */
export function placeLine(city: string | null | undefined, tz: string | null | undefined, now?: Date): string {
  return [city?.trim() || null, localClock(tz, now)].filter(Boolean).join(" · ");
}

/** "1h 24m left", "12m left", "Time's up". */
export function timeLeft(endsAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!endsAt) return null;
  const mins = Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 60000);
  if (mins <= 0) return "Time's up";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m left` : `${m}m left`;
}

/** Ten minutes or less: time to offer "extend the night". */
export function nearTheEnd(endsAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!endsAt) return false;
  const ms = new Date(endsAt).getTime() - now.getTime();
  return ms > 0 && ms <= 10 * 60000;
}

/**
 * Who gets live video. Laptops: everyone. Weak phones: only the person
 * talking and yourself; everyone else shows as a photo bubble that lights
 * up when they speak. Keeps a 5-person night about as light as a date.
 */
export function liveVideoFor(
  identities: string[],
  opts: { speaker: string | null; self: string | null; lowPower: boolean },
): Set<string> {
  if (!opts.lowPower) return new Set(identities);
  return new Set(identities.filter((id) => id === opts.speaker || id === opts.self));
}

/**
 * Grid: yourself first, then everyone in joining order. Focus (one big
 * face): whoever is talking, else a friend, and yourself last, so a phone
 * never fills the screen with your own face while others are there.
 */
export function speakerFirst(
  identities: string[],
  speaker: string | null,
  self: string | null,
  focus = false,
): string[] {
  const rank = (id: string) =>
    focus
      ? id === speaker && id !== self
        ? 0
        : id === self
          ? 2
          : 1
      : id === self
        ? 0
        : 1;
  return [...identities].sort((a, b) => rank(a) - rank(b));
}

/** Grid columns for n tiles (faces plus free seats). */
export function gridColumns(n: number): number {
  if (n <= 1) return 1;
  if (n <= 4) return 2;
  return 3;
}
