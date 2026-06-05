/**
 * Rooms API — the backend `/v1/rooms…` surface that replaces the old
 * `invites` / `room_state` tables. Shapes mirror the FastAPI Pydantic models
 * in `backend/app/schemas/room.py`.
 */
import { api } from "@/lib/api";

export type RoomPersistence = "session" | "persistent";
export type RoomPackage = "single_pass" | "subscription";
export type RoomStateName =
  | "created"
  | "waiting"
  | "live"
  | "ended"
  | "grace"
  | "active"
  | "sub_lapsed"
  | "purged";

export type Room = {
  id: string;
  code: string;
  pin: string;
  persistence: RoomPersistence;
  state: RoomStateName;
  host_id: string;
  connection_id: string | null;
  livekit_room_name: string;
  package: RoomPackage;
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
  grace_expires_at: string | null;
  greeting_headline: string | null;
  greeting_subtext: string | null;
  theme_color: string | null;
  background_id: string | null;
  created_at: string;
  /** Signed JWT — URL-bearer recap access. Embed in share URLs as
   *  `#k=<token>`. See backend services/rooms/invites.py. */
  recap_invite_token: string | null;
};

export type ParticipantInfo = {
  /** Row id needed to address the participant via DELETE
   *  /rooms/{room_id}/participants/{participant_id}. Backend always
   *  populates this; signed-in and anonymous participants both have one. */
  participant_id: string;
  user_id: string | null;
  display_name: string;
  photo_url: string | null;
  slot: string;
};

/** Public lobby preview returned by GET /v1/rooms/by-code/{code}. No PIN. */
export type InviteCard = {
  id: string;
  code: string;
  host_display_name: string;
  host_photo_url: string | null;
  scheduled_for: string | null;
  expires_at: string | null;
  state: RoomStateName;
  greeting_headline: string | null;
  greeting_subtext: string | null;
  persistence: RoomPersistence;
  participants: ParticipantInfo[];
  theme_color: string | null;
  background_id: string | null;
  /** Same URL-bearer recap-invite as Room.recap_invite_token; lets
   *  the lobby render a recap deep link with the token already
   *  attached. */
  recap_invite_token: string | null;
};

/** POST /v1/rooms/{id}/claim. */
export function claimRoom(roomId: string, inviteToken: string): Promise<{
  participant_id: string;
  slot: string;
  already_member: boolean;
}> {
  return api.post(`/v1/rooms/${roomId}/claim`, { invite_token: inviteToken });
}

export type CreateRoomRequest = {
  persistence: RoomPersistence;
  package: RoomPackage;
  scheduled_for?: string | null;
  connection_id?: string | null;
  greeting_headline?: string | null;
  greeting_subtext?: string | null;
};

export type JoinRoomRequest = {
  display_name: string;
  photo_url?: string | null;
  pin: string;
};

export type JoinRoomResponse = {
  room_id: string;
  room_code: string;
  participant_id: string;
  slot: string;
  livekit_room_name: string;
  expires_at: string | null;
};

export type LiveKitToken = {
  token: string;
  url: string;
  room_name: string;
  identity: string;
};

export function createRoom(body: CreateRoomRequest): Promise<Room> {
  return api.post<Room>("/v1/rooms", body);
}

/** Server-authoritative list of the caller's rooms (host or participant). */
export function listMyRooms(): Promise<Room[]> {
  return api.get<Room[]>("/v1/rooms");
}

/** Public — no auth required. */
export function getRoomByCode(code: string): Promise<InviteCard> {
  return api.get<InviteCard>(`/v1/rooms/by-code/${encodeURIComponent(code)}`, { auth: false });
}

export function joinRoom(roomId: string, body: JoinRoomRequest): Promise<JoinRoomResponse> {
  return api.post<JoinRoomResponse>(`/v1/rooms/${roomId}/join`, body);
}

export function startRoom(roomId: string): Promise<Room> {
  return api.post<Room>(`/v1/rooms/${roomId}/start`);
}

export function endRoom(roomId: string): Promise<Room> {
  return api.post<Room>(`/v1/rooms/${roomId}/end`);
}

export function leaveRoom(roomId: string): Promise<void> {
  return api.post<void>(`/v1/rooms/${roomId}/leave`);
}

export function promoteRoom(roomId: string): Promise<Room> {
  return api.post<Room>(`/v1/rooms/${roomId}/promote`);
}

export function deleteRoom(roomId: string): Promise<void> {
  return api.delete<void>(`/v1/rooms/${roomId}`);
}

/** Host-only — rotate the room PIN. Returns the updated room (so the
 * caller's share UI immediately reflects the new value). */
export function rotateRoomPin(roomId: string): Promise<Room> {
  return api.post<Room>(`/v1/rooms/${roomId}/rotate-pin`);
}

/** Host-only — eject a participant. */
export function kickParticipant(roomId: string, participantId: string): Promise<void> {
  return api.delete<void>(`/v1/rooms/${roomId}/participants/${participantId}`);
}

export function updateRoom(
  roomId: string,
  patch: { theme_color?: string | null; background_id?: string | null },
): Promise<Room> {
  return api.patch<Room>(`/v1/rooms/${roomId}`, patch);
}

/** Guests pass the participant_id they got from join; signed-in users omit it. */
export function livekitToken(roomId: string, participantId?: string): Promise<LiveKitToken> {
  return api.post<LiveKitToken>(`/v1/rooms/${roomId}/livekit-token`, {
    participant_id: participantId ?? null,
  });
}
