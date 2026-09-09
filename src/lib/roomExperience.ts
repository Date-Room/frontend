/**
 * Date experience curation — which activities the host wants available
 * during the date. Tiers gate *what can be chosen*:
 *
 *  • Try (free, 20 min / `single_pass`): Watch party, Music (DJ) and
 *    21 Questions only.
 *  • Date Pack / Long Pack: the full activity library.
 *  • Together / Crew (subscription): wall features — vision board,
 *    fridge/bookshelf — plus watch party capacity.
 *
 * The host's selection is stored on the room row (`curated_activity_ids`)
 * so guests on any device see the same menu as the host.
 */
import type { RoomPackage } from "@/lib/rooms";
import {
  CURATABLE_ACTIVITIES,
  type ActivityCategory,
  type CuratableActivityId,
  type CuratableActivityMeta,
} from "@/lib/activityRegistry";

// The activity list itself lives in the registry; this module owns the
// package/curation gating. Re-exported so existing consumers keep working.
export { CURATABLE_ACTIVITIES };
export type { ActivityCategory, CuratableActivityId, CuratableActivityMeta };

export type RoomPlanSnapshot = {
  package: RoomPackage;
  curatedActivityIds: CuratableActivityId[];
  maxParticipants?: number;
};

/** Free Try tier: only these three are available. */
export const TRY_ACTIVITY_IDS: CuratableActivityId[] = ["watch", "dj", "questions"];

/** Together / Crew persistent rooms only. */
export const SUBSCRIPTION_WALL_ACTIVITY_IDS: CuratableActivityId[] = ["vision_board", "fridge"];

const ALL_ACTIVITY_IDS = CURATABLE_ACTIVITIES.map((a) => a.id);

export function isSubscriptionPackage(pkg: RoomPackage | null | undefined): boolean {
  return pkg === "subscription";
}

/** Activity ids the host is *allowed* to pick for a given package. */
export function availableActivityIdsForPackage(pkg: RoomPackage): CuratableActivityId[] {
  if (isTryPackage(pkg)) return [...TRY_ACTIVITY_IDS];
  if (isSubscriptionPackage(pkg)) {
    return CURATABLE_ACTIVITIES.map((a) => a.id);
  }
  return CURATABLE_ACTIVITIES.filter((a) => a.category !== "walls").map((a) => a.id);
}

export function isTryPackage(pkg: RoomPackage): boolean {
  return pkg === "single_pass";
}

/** Default curation when a host first lands on the package — everything
 *  they're entitled to is pre-selected. */
export function defaultCuratedForPackage(pkg: RoomPackage): CuratableActivityId[] {
  return availableActivityIdsForPackage(pkg);
}

export function activityMeta(id: CuratableActivityId): CuratableActivityMeta {
  return CURATABLE_ACTIVITIES.find((a) => a.id === id) ?? CURATABLE_ACTIVITIES[0];
}

/** Resolve the effective activity menu for a room — package caps what
 *  can appear; host curation picks within that cap. */
export function resolveCuratedActivities(
  pkg: RoomPackage,
  curated: CuratableActivityId[] | null | undefined,
): CuratableActivityId[] {
  const allowed = new Set(availableActivityIdsForPackage(pkg));
  if (!curated?.length) {
    return availableActivityIdsForPackage(pkg);
  }
  const filtered = curated.filter((id) => allowed.has(id));
  return filtered.length ? filtered : availableActivityIdsForPackage(pkg);
}

/* ───────────────────────── Persistence ───────────────────────── */

const PREFIX = "dr_room_experience:";
const PLAN_PREFIX = "dr_room_plan:";

/** Legacy host-only localStorage curation — superseded by server sync. */
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

/** Server-authoritative plan snapshot — shared by host + guest. */
export function saveRoomPlan(roomId: string, plan: RoomPlanSnapshot): void {
  try {
    sessionStorage.setItem(PLAN_PREFIX + roomId, JSON.stringify(plan));
  } catch {
    /* ignore */
  }
}

export function getRoomPlan(roomId: string): RoomPlanSnapshot | null {
  try {
    const raw = sessionStorage.getItem(PLAN_PREFIX + roomId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoomPlanSnapshot;
    if (!parsed?.package || !Array.isArray(parsed.curatedActivityIds)) return null;
    return {
      package: parsed.package,
      curatedActivityIds: resolveCuratedActivities(
        parsed.package,
        parsed.curatedActivityIds,
      ),
      maxParticipants: parsed.maxParticipants,
    };
  } catch {
    return null;
  }
}

export function saveRoomPlanFromServer(
  roomId: string,
  payload: { package: RoomPackage; curated_activity_ids: string[]; max_participants?: number },
): RoomPlanSnapshot {
  const plan: RoomPlanSnapshot = {
    package: payload.package,
    curatedActivityIds: resolveCuratedActivities(
      payload.package,
      payload.curated_activity_ids as CuratableActivityId[],
    ),
    maxParticipants: payload.max_participants,
  };
  saveRoomPlan(roomId, plan);
  saveRoomExperience(roomId, plan.curatedActivityIds);
  return plan;
}

/** Activity ids that are never curated away (base comms + host tools). */
export const ALWAYS_ON_ACTIVITY_IDS = new Set<string>(["chat", "room_details"]);

/**
 * Whether a tray/quick-launch activity should be shown for this room.
 * Requires the room's package so guests without host localStorage still
 * get the correct Try-tier menu.
 */
export function isActivityEnabled(
  activityId: string,
  curated: CuratableActivityId[] | null,
  roomPackage?: RoomPackage | null,
): boolean {
  if (ALWAYS_ON_ACTIVITY_IDS.has(activityId)) return true;
  if (roomPackage) {
    const effective = resolveCuratedActivities(roomPackage, curated);
    return effective.includes(activityId as CuratableActivityId);
  }
  if (curated?.length) {
    return curated.includes(activityId as CuratableActivityId);
  }
  return false;
}

export function enabledActivitiesForRoom(
  roomId: string,
  roomPackage?: RoomPackage | null,
): CuratableActivityId[] {
  const plan = getRoomPlan(roomId);
  const pkg = roomPackage ?? plan?.package ?? null;
  if (!pkg) {
    return getRoomExperience(roomId) ?? [];
  }
  const curated = plan?.curatedActivityIds ?? getRoomExperience(roomId);
  return resolveCuratedActivities(pkg, curated);
}
