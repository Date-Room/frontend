/**
 * How the Rooms list is filtered and ordered.
 *
 * Pure so it can be tested without rendering Home: the ordering rule in
 * particular is easy to get subtly wrong, and it decides what people see
 * first every time they open the app.
 *
 * Mirrors mobile (`MyRoomTile.byRecency` / `_RoomFilter`) so the two
 * clients present the same list in the same order.
 */
import type { Room } from "@/lib/rooms";

export type RoomKind = "all" | "dates" | "squads";

export const ROOM_KINDS: RoomKind[] = ["all", "dates", "squads"];

/** "Dates"/"Squads" rather than "Daterooms"/"Squadrooms": inside DateRoom
 *  every row is already a room, so the word earns nothing and makes both
 *  chips long enough to crowd the row. */
export const ROOM_KIND_CHIPS: Record<RoomKind, string> = {
  all: "All",
  dates: "Dates",
  squads: "Squads",
};

/** The list heading, so a filtered list says what it is rather than
 *  looking mysteriously short. */
export const ROOM_KIND_HEADINGS: Record<RoomKind, string> = {
  all: "Rooms",
  dates: "Dates",
  squads: "Squads",
};

export function isSquadRoom(room: Pick<Room, "room_kind">): boolean {
  return room.room_kind === "squad";
}

export function matchesKind(room: Pick<Room, "room_kind">, kind: RoomKind): boolean {
  if (kind === "all") return true;
  return kind === "squads" ? isSquadRoom(room) : !isSquadRoom(room);
}

/* ─────────────────── Last visited ─────────────────── */

const VISITS_KEY = "dr_room_visits";

/** roomId → ISO timestamp of the last time this browser entered it.
 *  Per-browser, like mobile's per-device stamp: there is no server field
 *  for "when did I last enter", so a room opened elsewhere has none here
 *  and simply falls back to its creation date. */
export function loadRoomVisits(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VISITS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === "string" && !Number.isNaN(Date.parse(at))) out[id] = at;
    }
    return out;
  } catch {
    // Private mode / disabled storage — the list just falls back to
    // creation order rather than failing to render.
    return {};
  }
}

export function markRoomVisited(roomId: string, now = new Date()): void {
  try {
    const visits = loadRoomVisits();
    visits[roomId] = now.toISOString();
    localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
  } catch {
    /* best-effort */
  }
}

/** ms since epoch, or null when this browser has never entered the room. */
export function lastVisitedAt(
  roomId: string,
  visits: Record<string, string>,
): number | null {
  const raw = visits[roomId];
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/**
 * Rooms you have entered first, most recent visit on top; then rooms you
 * haven't, newest-created first.
 *
 * Two tiers rather than one blended key: "where was I last" and "what is
 * newest" are different questions, and mixing them pushes rooms you
 * actually use below ones you have never opened.
 */
export function compareByLastVisited(
  a: Room,
  b: Room,
  visits: Record<string, string>,
): number {
  const av = lastVisitedAt(a.id, visits);
  const bv = lastVisitedAt(b.id, visits);
  if (av != null && bv != null) return bv - av;
  // Entered beats never-entered, whatever the dates.
  if (av != null) return -1;
  if (bv != null) return 1;
  return Date.parse(b.created_at) - Date.parse(a.created_at);
}

/** "just now" / "14m ago" / "3h ago" / "2d ago" / "a week ago". */
export function lastVisitedLabel(at: number, now = Date.now()): string {
  const ms = now - at;
  // A clock that has gone backwards must not render as a negative age.
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return w === 1 ? "a week ago" : `${w}w ago`;
}
