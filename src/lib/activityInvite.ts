/**
 * "JJ started Guacamole Panic. Join them?"
 *
 * Which activity each person has open is local state (each browses on their
 * own). This module turns the partner's stage into an invite you can act on,
 * so nobody has to hunt through the dock to find where their date went.
 *
 * Inputs (all from the room channel):
 *  - `stage` broadcasts: `{ activity_id | null, from, name, at }`, sent by web
 *    clients whenever the staged activity changes (null = left / on a wall).
 *  - `activity` events: the fallback for partners that don't send `stage`
 *    (mobile). Any real action inside an invitable activity counts as "they
 *    are in there".
 *
 * Rules:
 *  - never for my own opens, never for the activity I'm already on;
 *  - one invite at a time, the newest partner stage wins;
 *  - "Not now" mutes that activity until the partner opens something else;
 *  - the invite goes away by itself when the partner leaves that activity.
 */

/** Activities worth being invited into, with the verb the card uses. Walls
 *  (vision board, notes, shelf) and chat are passive and have their own
 *  signals, so they are deliberately not here. */
export const INVITABLE: Record<string, { verb: string }> = {
  questions: { verb: "started" },
  this_or_that: { verb: "started" },
  the_36: { verb: "started" },
  "2_truths": { verb: "started" },
  truth_or_dare: { verb: "started" },
  one_has_to_go: { verb: "started" },
  pick_a_door: { verb: "started" },
  rank_it: { verb: "started" },
  guacamole: { verb: "fired up" },
  watch: { verb: "opened" },
  dj: { verb: "opened" },
};

export function isInvitable(id: string | null | undefined): id is string {
  return Boolean(id) && Object.prototype.hasOwnProperty.call(INVITABLE, id as string);
}

/** Sync events that happen without a person doing anything. */
export const PASSIVE_EVENT_TYPES = new Set(["tick", "seek", "cursor", "typing", "presence", "pause", "state", "sync", "sync_request", "snapshot"]);

export type PartnerStage = { id: string; at: number };

export type InviteState = {
  /** Where the partner is, as far as we know. */
  partnerStage: PartnerStage | null;
  /** Activity the viewer said "Not now" to; cleared when the partner moves. */
  declinedId: string | null;
};

export const INITIAL_INVITE_STATE: InviteState = { partnerStage: null, declinedId: null };

export type InviteAction =
  | { type: "stage"; id: string | null; at: number }
  | { type: "activity"; id: string; eventType?: string; at: number }
  | { type: "decline" }
  | { type: "partner_left" };

export function inviteReducer(state: InviteState, action: InviteAction): InviteState {
  switch (action.type) {
    case "stage": {
      if (!isInvitable(action.id)) {
        return state.partnerStage ? { partnerStage: null, declinedId: null } : state;
      }
      if (state.partnerStage?.id === action.id) return state;
      return { partnerStage: { id: action.id, at: action.at }, declinedId: null };
    }
    case "activity": {
      if (!isInvitable(action.id)) return state;
      if (action.eventType && PASSIVE_EVENT_TYPES.has(action.eventType)) return state;
      if (state.partnerStage?.id === action.id) return state;
      return { partnerStage: { id: action.id, at: action.at }, declinedId: null };
    }
    case "decline":
      return state.partnerStage ? { ...state, declinedId: state.partnerStage.id } : state;
    case "partner_left":
      return state.partnerStage || state.declinedId ? INITIAL_INVITE_STATE : state;
    default:
      return state;
  }
}

/** The activity to invite the viewer into right now, or null. */
export function pendingInvite(state: InviteState, myStaged: string | null): string | null {
  const p = state.partnerStage;
  if (!p) return null;
  if (p.id === myStaged) return null;
  if (p.id === state.declinedId) return null;
  return p.id;
}

/** "JJ fired up Guacamole Panic" */
export function inviteHeadline(partnerName: string, activityId: string, activityTitle: string): string {
  const verb = INVITABLE[activityId]?.verb ?? "started";
  return `${partnerName} ${verb} ${activityTitle}`;
}

/** Starter-side status for the activity I have open. */
export type StarterStatus = "inviting" | "together" | null;

export function starterStatus(
  state: InviteState,
  myStaged: string | null,
  partnerPresent: boolean,
  now: number,
  invitingWindowMs = 45_000,
  openedAt: number | null = null,
): StarterStatus {
  if (!isInvitable(myStaged) || !partnerPresent) return null;
  if (state.partnerStage?.id === myStaged) return "together";
  if (openedAt != null && now - openedAt <= invitingWindowMs) return "inviting";
  return null;
}
