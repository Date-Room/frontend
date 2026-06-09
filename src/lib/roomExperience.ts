/**
 * Date experience curation — which activities the host wants available
 * during the date. Tiers gate *what can be chosen*:
 *
 *  • Try (free, 20 min / `single_pass`): Watch party, Music (DJ) and
 *    21 Questions only.
 *  • Date Pack / Long Pack / Together: the full activity library.
 *
 * See docs/date-room-plans-and-billing.md. The selection is persisted
 * per-room in localStorage (same pattern as `invitedGuest.ts`) and read
 * back by the live room to filter the activity tray + quick-launch.
 */
import type { RoomPackage } from "@/lib/rooms";

export type CuratableActivityId =
  | "questions"
  | "this_or_that"
  | "the_36"
  | "2_truths"
  | "truth_or_dare"
  | "watch"
  | "dj";

export type ActivityCategory = "games" | "watch" | "music";

export type CuratableActivityMeta = {
  id: CuratableActivityId;
  label: string;
  tagline: string;
  emoji: string;
  category: ActivityCategory;
};

/** The curatable date activities. `chat` and room management are always
 *  available and intentionally excluded here. */
export const CURATABLE_ACTIVITIES: CuratableActivityMeta[] = [
  { id: "watch", label: "Watch party", tagline: "Sync up a video and watch together.", emoji: "🎬", category: "watch" },
  { id: "dj", label: "Music / DJ", tagline: "Take turns picking the soundtrack.", emoji: "🎧", category: "music" },
  { id: "questions", label: "21 Questions", tagline: "Pick a deck, swap, take turns.", emoji: "💬", category: "games" },
  { id: "this_or_that", label: "This or That", tagline: "Pick blind, reveal together.", emoji: "⚖️", category: "games" },
  { id: "the_36", label: "The 36", tagline: "Three sets of twelve. Get closer.", emoji: "🫶", category: "games" },
  { id: "2_truths", label: "2 Truths and a Lie", tagline: "Spot the lie. Swap roles.", emoji: "🎭", category: "games" },
  { id: "truth_or_dare", label: "Truth or Dare", tagline: "Three cards each. Two skips.", emoji: "🔥", category: "games" },
];

/** Free Try tier: only these three are available. */
export const TRY_ACTIVITY_IDS: CuratableActivityId[] = ["watch", "dj", "questions"];

const ALL_ACTIVITY_IDS = CURATABLE_ACTIVITIES.map((a) => a.id);

export function isTryPackage(pkg: RoomPackage): boolean {
  return pkg === "single_pass";
}

/** Activity ids the host is *allowed* to pick for a given package. */
export function availableActivityIdsForPackage(pkg: RoomPackage): CuratableActivityId[] {
  return isTryPackage(pkg) ? [...TRY_ACTIVITY_IDS] : [...ALL_ACTIVITY_IDS];
}

/** Default curation when a host first lands on the package — everything
 *  they're entitled to is pre-selected. */
export function defaultCuratedForPackage(pkg: RoomPackage): CuratableActivityId[] {
  return availableActivityIdsForPackage(pkg);
}

export function activityMeta(id: CuratableActivityId): CuratableActivityMeta {
  return CURATABLE_ACTIVITIES.find((a) => a.id === id) ?? CURATABLE_ACTIVITIES[0];
}

/* ───────────────────────── Persistence ───────────────────────── */

const PREFIX = "dr_room_experience:";

export function saveRoomExperience(roomId: string, ids: CuratableActivityId[]): void {
  try {
    localStorage.setItem(PREFIX + roomId, JSON.stringify(ids));
  } catch {
    /* private mode / storage disabled — curation is best-effort */
  }
}

export function getRoomExperience(roomId: string): CuratableActivityId[] | null {
  try {
    const raw = localStorage.getItem(PREFIX + roomId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (x): x is CuratableActivityId =>
        typeof x === "string" && ALL_ACTIVITY_IDS.includes(x as CuratableActivityId),
    );
    return valid.length ? valid : null;
  } catch {
    return null;
  }
}

/** Activity ids that are never curated away (base comms + host tools). */
export const ALWAYS_ON_ACTIVITY_IDS = new Set<string>(["chat", "room_details"]);

/**
 * Whether a tray/quick-launch activity should be shown. `curated` is the
 * host's saved selection (null = none stored, so we don't hide anything —
 * legacy rooms and cross-device guests fall back to showing all).
 */
export function isActivityEnabled(
  activityId: string,
  curated: CuratableActivityId[] | null,
): boolean {
  if (ALWAYS_ON_ACTIVITY_IDS.has(activityId)) return true;
  if (!curated) return true;
  return curated.includes(activityId as CuratableActivityId);
}
