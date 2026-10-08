/**
 * Squad guests (backend#117, #119): someone in for one night through a
 * guest link, not a member. Whoever runs the squad makes the link and says
 * who pays for the guest's seat: the squad, or the guest. The guest gets
 * the call and tonight's games, nothing that holds the squad's history.
 * The server answers 404 on all of this while SQUAD_GUESTS is off.
 */
import { ApiError, api } from "@/lib/api";

export type GuestPays = "squad" | "self";

export type GuestInvite = {
  id: string;
  token: string;
  pays: GuestPays;
  created_at: string;
  expires_at: string;
  used: boolean;
};

export type GuestLinkPreview = {
  room_id: string;
  squad_name: string | null;
  host_name: string;
  pays: GuestPays;
  expires_at: string;
  night_on: boolean;
  used: boolean;
};

export type GuestJoin = {
  room_id: string;
  participant_id: string;
  slot: string;
  /** "guest", or a member's own role when a member used the link. */
  role: string | null;
  guest_until: string | null;
};

export type SquadGuest = {
  participant_id: string;
  user_id: string | null;
  display_name: string;
  photo_url: string | null;
  guest_until: string | null;
  night_over: boolean;
};

export function createGuestInvite(roomId: string, pays: GuestPays) {
  return api.post<GuestInvite>(`/v1/rooms/${roomId}/guest-invites`, { pays });
}

export function listGuestInvites(roomId: string) {
  return api.get<{ invites: GuestInvite[] }>(`/v1/rooms/${roomId}/guest-invites`);
}

export function revokeGuestInvite(roomId: string, inviteId: string) {
  return api.delete<void>(`/v1/rooms/${roomId}/guest-invites/${inviteId}`);
}

export function listGuests(roomId: string) {
  return api.get<{ guests: SquadGuest[] }>(`/v1/rooms/${roomId}/guests`);
}

export function makeGuestMember(roomId: string, participantId: string) {
  return api.post<{ guests: SquadGuest[] }>(`/v1/rooms/${roomId}/guests/${participantId}/make-member`, {});
}

export function getGuestLink(token: string) {
  return api.get<GuestLinkPreview>(`/v1/squad-guest-links/${encodeURIComponent(token)}`);
}

export function joinAsGuest(token: string, displayName: string) {
  return api.post<GuestJoin>(`/v1/squad-guest-links/${encodeURIComponent(token)}/join`, {
    display_name: displayName,
  });
}

/** The link a host shares. */
export function guestLinkUrl(token: string, origin = window.location.origin): string {
  return `${origin}/g/${token}`;
}

const GUEST_KEY = (roomId: string) => `dr:squad-guest:${roomId}`;

/** Remember on this device that I'm tonight's guest in this room, so the
 *  room shows the guest view (the call and games only). */
export function markSquadGuest(roomId: string, until: string | null): void {
  try {
    localStorage.setItem(GUEST_KEY(roomId), until ?? "1");
  } catch {
    /* private mode: the server still keeps the rest out */
  }
}

export function isSquadGuest(roomId: string): boolean {
  try {
    const v = localStorage.getItem(GUEST_KEY(roomId));
    if (!v) return false;
    if (v === "1") return true;
    // A day after the night the server removes guests anyway.
    return Date.now() < new Date(v).getTime() + 24 * 3600_000;
  } catch {
    return false;
  }
}

export function forgetSquadGuest(roomId: string): void {
  try {
    localStorage.removeItem(GUEST_KEY(roomId));
  } catch {
    /* ignore */
  }
}

/** Shared activities that hold the squad's history: hidden from guests
 *  (the server refuses them too). */
export const GUEST_HIDDEN_ACTIVITIES = new Set(["chat", "fridge", "vision_board"]);

/** Pure: what the guest link says about the seat, with no comparison of
 *  how anyone else pays. */
export function guestSeatLine(p: Pick<GuestLinkPreview, "pays" | "host_name">): string {
  return p.pays === "squad"
    ? `${p.host_name}'s squad has a seat for you tonight.`
    : "You'll get your seat when you join.";
}

/** Pure: the friendly line for a guest link that can't be used. */
export function guestLinkProblem(e: unknown): string {
  const status = e instanceof ApiError ? e.status : 0;
  const code =
    e instanceof ApiError ? ((e.body as { detail?: { error?: string } } | undefined)?.detail?.error ?? null) : null;
  if (status === 410 || code === "guest_link_expired") return "This guest link has expired. Ask for a new one.";
  if (code === "guest_link_used") return "Someone else already used this link. Ask for one of your own.";
  if (code === "squad_full") return "The squad is full right now. Try again in a bit.";
  if (code === "removed") return "This squad removed you, so the link doesn't open it.";
  if (status === 404) return "This guest link doesn't work. Ask for a new one.";
  return "Couldn't open the link just now. Try again.";
}
