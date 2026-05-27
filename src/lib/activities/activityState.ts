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

export type RoomRecapResponse = {
  room_id: string;
  activities: ActivityStateResponse[];
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
  body: { state: Record<string, unknown>; schema_version?: number; if_match_version?: number | null },
): Promise<ActivityStateResponse> {
  return api.put<ActivityStateResponse>(
    `/v1/rooms/${roomId}/activities/${encodeURIComponent(activityId)}/state`,
    {
      state: body.state,
      schema_version: body.schema_version ?? 1,
      if_match_version: body.if_match_version ?? null,
    },
  );
}

export function getRoomRecap(roomId: string, participantId?: string): Promise<RoomRecapResponse> {
  const base = `/v1/rooms/${roomId}/recap`;
  const path = participantId ? `${base}?participant_id=${encodeURIComponent(participantId)}` : base;
  return api.get<RoomRecapResponse>(path);
}
