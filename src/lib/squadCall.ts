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
  // Three is one row of three big tiles, not two over one with a gap.
  if (n === 3) return 3;
  if (n <= 4) return 2;
  return 3;
}

/** "Amaka", "Amaka and Salma", "Amaka, Salma and Nia". */
export function joinNames(names: string[]): string {
  const n = names.filter(Boolean);
  if (n.length <= 1) return n[0] ?? "";
  return `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

/** The squad's line in the room's top bar: who's here, or who we're waiting for. */
export function squadHereLine(names: string[]): string {
  if (names.length === 0) return "Waiting for the squad…";
  return `${joinNames(names)} ${names.length === 1 ? "is" : "are"} here`;
}

/**
 * The friends' grid during a squad game. You sit small beside the question,
 * so the grid only ever holds friends, at most four: one fills it, two
 * stack (side by side on wider screens), three are two plus one wide, four
 * are two by two.
 */
export function friendGridClass(friends: number): string {
  if (friends <= 1) return "grid-cols-1 grid-rows-1";
  if (friends === 2) return "grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1";
  if (friends === 3) return "grid-cols-2 grid-rows-2 [&>*:nth-child(3)]:col-span-2";
  return "grid-cols-2 grid-rows-2";
}

/* ───────────────── The table (laptops, during a squad game) ───────────────── */

/** The game sits in a middle column this wide; seats fill both sides. */
export const TABLE_CENTRE = 460;
export const TABLE_CENTRE_BIG = 520;
/** Big screens get the wider middle. */
export const TABLE_BIG_QUERY = "(min-width: 1800px)";
/** Below this the side seats get too small: keep the split layout. */
export const TABLE_QUERY = "(min-width: 1200px)";
export const TABLE_GAP = 16;
const SEAT_GAP = 12;

/** A seat is a call identity, or null for the space a full squad leaves
 *  free (it shows the squad's scores). */
export type Seat = string | null;

/**
 * Pure: who sits where. Friends fill the left from the top, then the right;
 * you sit under them on the right. Both sides always match (decided
 * 2026-10-08, a lopsided 2/1 or 3/2 looked wrong): three on the call is
 * two a side, five is three a side, with the spare space showing the
 * squad's scores; six is three a side. A saved arrangement (this device's
 * own) wins for everyone still on the call; newcomers join at the end.
 */
export function tableSeats(
  present: string[],
  self: string,
  saved: string[] | null,
): { left: Seat[]; right: Seat[] } {
  const friends = present.filter((id) => id !== self);
  const base = present.includes(self) ? [...friends, self] : friends;
  const order = saved
    ? [...saved.filter((id) => base.includes(id)), ...base.filter((id) => !saved.includes(id))]
    : base;
  const n = order.length;
  // Odd counts above one take the bigger half on the left; the scores
  // fill the right's spare space so the sides match.
  const leftCount = n > 1 ? Math.ceil(n / 2) : 0;
  const left: Seat[] = order.slice(0, leftCount);
  const right: Seat[] = order.slice(leftCount);
  if (n > 1 && n % 2 === 1) right.push(null);
  return { left, right };
}

/** Pure: one seat's size, the camera's shape (16:9), as big as the side
 *  column and the rows allow. */
export function tableTile(sideWidth: number, height: number, rows: number): { w: number; h: number } {
  const r = Math.max(1, rows);
  const h = Math.max(0, Math.min((sideWidth * 9) / 16, (height - (r - 1) * SEAT_GAP) / r));
  return { w: Math.floor((h * 16) / 9), h: Math.floor(h) };
}

/** Pure: how much of the middle column's height a face takes, top down.
 *  A reveal puts the winner there; Clue Me In puts the guesser there. */
export function tableFaceShare(mode: string | null | undefined, hasFocus: boolean): number {
  if (!hasFocus) return 0;
  if (mode === "spotlight") return 0.58;
  if (mode === "hero") return 0.5;
  return 0;
}

/** Pure: an arrangement with two seats swapped. */
export function swapSeats(order: string[], a: string, b: string): string[] {
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  if (i < 0 || j < 0 || i === j) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** This device's seating for a room (call identities, in seat order). */
const SEATS_KEY = (roomId: string) => `dr_squad_seats:${roomId}`;

export function readSeats(roomId: string): string[] | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SEATS_KEY(roomId)) ?? "null");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export function saveSeats(roomId: string, order: string[] | null): void {
  try {
    if (order) localStorage.setItem(SEATS_KEY(roomId), JSON.stringify(order));
    else localStorage.removeItem(SEATS_KEY(roomId));
  } catch {
    /* storage off: the seats reset next time */
  }
}
