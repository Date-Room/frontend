/**
 * Durable activity state REST — `GET/PUT /v1/rooms/{id}/activities/{activity_id}/state`
 * and the room recap. Mirrors backend `schemas/activity_state.py`.
 *
 * Reads accept an optional `participant_id` so anonymous guests can hydrate;
 * writes require a signed-in user (the backend rejects guest PUTs), matching
 * mobile where guest mutations converge via broadcast and a member persists.
 */
import { api, ApiError } from "@/lib/api";

export type ActivityStateResponse = {
  activity_id: string;
  state: Record<string, unknown>;
  version: number;
  schema_version: number;
  updated_by: string | null;
  updated_at: string;
};

/** One row of the room's chronological activity timeline. Matches
 *  the backend's ActivityEventResponse. */
export type ActivityEventResponse = {
  id: string;
  activity_id: string;
  sequence_number: number;
  event_type: string;
  actor_participant_id: string | null;
  actor_display_name: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type RoomRecapResponse = {
  room_id: string;
  /** Converged per-activity state snapshots (legacy + summary cards). */
  activities: ActivityStateResponse[];
  /** Chronological move-by-move timeline. Empty for rooms predating
   *  the events log (commit 46cfedd). */
  events: ActivityEventResponse[];
};

function statePath(roomId: string, activityId: string, participantId?: string): string {
  const base = `/v1/rooms/${roomId}/activities/${encodeURIComponent(activityId)}/state`;
  return participantId ? `${base}?participant_id=${encodeURIComponent(participantId)}` : base;
}

/** Latest durable state, or null if the activity has never been opened (404). */
export async function getActivityState(
  roomId: string,
  activityId: string,
  participantId?: string,
): Promise<ActivityStateResponse | null> {
  try {
    return await api.get<ActivityStateResponse>(statePath(roomId, activityId, participantId));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function putActivityState(
  roomId: string,
  activityId: string,
  body: {
    state: Record<string, unknown>;
    schema_version?: number;
    if_match_version?: number | null;
    /** Optional semantic move logged transactionally with the state
     *  change so Recap's timeline stays consistent. Skip for
     *  activities whose state alone tells the whole story. */
    event?: { event_type: string; payload?: Record<string, unknown> };
  },
): Promise<ActivityStateResponse> {
  return api.put<ActivityStateResponse>(
    `/v1/rooms/${roomId}/activities/${encodeURIComponent(activityId)}/state`,
    {
      state: body.state,
      schema_version: body.schema_version ?? 1,
      if_match_version: body.if_match_version ?? null,
      event: body.event ?? null,
    },
  );
}

/** Append a single move to the activity timeline without touching
 *  persisted state. Use for reactions, "started the round", etc. */
export function postActivityEvent(
  roomId: string,
  activityId: string,
  body: {
    event_type: string;
    payload?: Record<string, unknown>;
    /** Guests pass their participant_id; signed-in members omit. */
    participant_id?: string;
  },
): Promise<ActivityEventResponse> {
  return api.post<ActivityEventResponse>(
    `/v1/rooms/${roomId}/activities/${encodeURIComponent(activityId)}/events`,
    {
      event_type: body.event_type,
      payload: body.payload ?? null,
      participant_id: body.participant_id ?? null,
    },
  );
}

export function getRoomRecap(
  roomId: string,
  participantId?: string,
  inviteToken?: string,
): Promise<RoomRecapResponse> {
  const base = `/v1/rooms/${roomId}/recap`;
  const path = participantId ? `${base}?participant_id=${encodeURIComponent(participantId)}` : base;
  // The URL-bearer recap invite ships as a header so it stays out
  // of access logs / Referer / dev-tools URL bar. Auth header is
  // included when a session exists; backend OptionalUser accepts
  // either, and the invite token unlocks read for users without a
  // participant row.
  return api.get<RoomRecapResponse>(path, {
    headers: inviteToken ? { "X-Invite-Token": inviteToken } : undefined,
  });
}
