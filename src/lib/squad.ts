/**
 * Squad beta, the requester's side. Squad (friend nights for 2 to 5 people)
 * opens to a few groups first: the public slot says "Request access", a
 * signed-in person answers a few short questions, and the team lets groups
 * in from the admin queue. Mirrors backend `api/v1/squad.py`.
 */
import { ApiError, api } from "@/lib/api";

export type SquadBetaStatus = "none" | "pending" | "granted" | "declined";

export type SquadPlan = "films" | "games" | "catch_up" | "trip" | "other";

export type SquadBetaState = {
  status: SquadBetaStatus;
  city: string | null;
  group_size: number | null;
  plans: SquadPlan[];
  requested_at: string | null;
};

export type SquadBetaRequest = {
  city: string;
  group_size: number;
  plans: SquadPlan[];
  note: string;
};

export const SQUAD_PLAN_OPTIONS: { id: SquadPlan; label: string }[] = [
  { id: "films", label: "Films" },
  { id: "games", label: "Games" },
  { id: "catch_up", label: "Catching up" },
  { id: "trip", label: "Planning a trip" },
  { id: "other", label: "Something else" },
];

export const SQUAD_GROUP_SIZES = [2, 3, 4, 5] as const;

export function getSquadBeta() {
  return api.get<SquadBetaState>("/v1/squad/beta");
}

export function applySquadBeta(body: SquadBetaRequest) {
  return api.post<SquadBetaState>("/v1/squad/beta/apply", body);
}

/** The form can be sent once there is a city, a group size and one plan. */
export function canSendSquadRequest(form: SquadBetaRequest): boolean {
  return form.city.trim().length > 0 && form.group_size >= 2 && form.group_size <= 5 && form.plans.length > 0;
}

/** Toggle a plan chip, keeping the list in display order. */
export function toggleSquadPlan(plans: SquadPlan[], id: SquadPlan): SquadPlan[] {
  const next = plans.includes(id) ? plans.filter((p) => p !== id) : [...plans, id];
  return SQUAD_PLAN_OPTIONS.map((o) => o.id).filter((p) => next.includes(p));
}

// ── Squad rooms: create, nights, paying, members ────────────────────────
// Mirrors backend services.squad_nights / squad_members and
// api/v1/squad_billing. Nights belong to the room: anyone in the squad
// can start one or top the room up.

export const SQUAD_SEATS = [2, 3, 4, 5] as const;

export type SquadNight = {
  id: string;
  number: number;
  started_at: string;
  ends_at: string;
  seats: number;
  rate: "free" | "single" | "pack";
  refunded: boolean;
  extended_minutes?: number;
};

export type SquadNights = {
  seats: number;
  seat_nights: number;
  nights_left: number;
  free_night_expires_at: string | null;
  active_night: SquadNight | null;
  nights: SquadNight[];
};

export type SquadPrice = {
  product: string;
  nights: number;
  per_seat: number;
  amount: number;
  currency: string;
};

export type SquadPrices = {
  seats: number;
  provider: "mpesa" | "stripe" | "store";
  stk_ready: boolean;
  dev_checkout: boolean;
  products: SquadPrice[];
};

export type SquadMember = {
  participant_id: string;
  user_id: string | null;
  display_name: string;
  photo_url: string | null;
  city: string | null;
  tz: string | null;
  role: "owner" | "cohost" | "member";
  joined_at: string;
  new: boolean;
};

export type SquadMembers = {
  members: SquadMember[];
  locked_until: string | null;
  my_role: "owner" | "cohost" | "member";
};

export type CreateSquadRoom = { seats: number; name: string };

export function createSquadRoom(body: CreateSquadRoom) {
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  })();
  return api.post<import("@/lib/rooms").Room>("/v1/rooms", {
    persistence: "persistent",
    package: "squad",
    room_kind: "squad",
    seats: body.seats,
    greeting_headline: body.name.trim() || null,
    scheduled_tz: tz,
  });
}

export function getSquadNights(roomId: string) {
  return api.get<SquadNights>(`/v1/rooms/${roomId}/nights`);
}

export function startSquadNight(roomId: string) {
  return api.post<SquadNights>(`/v1/rooms/${roomId}/nights`, {});
}

export function getSquadPrices(roomId: string) {
  return api.get<SquadPrices>(`/v1/rooms/${roomId}/squad/prices`);
}

export function squadCardCheckout(roomId: string, product: string) {
  return api.post<{ url: string }>(`/v1/rooms/${roomId}/squad/checkout`, { product });
}

export function squadStkPush(roomId: string, product: string, phone: string) {
  return api.post<{ transaction_id: string }>(`/v1/rooms/${roomId}/squad/stk-push`, {
    product,
    phone,
  });
}

export function squadDevPurchase(roomId: string, product: string) {
  return api.post<void>(`/v1/rooms/${roomId}/squad/dev-purchase`, { product });
}

export function getSquadMembers(roomId: string) {
  return api.get<SquadMembers>(`/v1/rooms/${roomId}/members`);
}

/** "KES 960" / "USD 15.84" / "NGN 8,800", whole units where the currency
 *  has no useful cents. */
export function formatSquadMoney(amount: number, currency: string): string {
  const whole = currency === "KES" || currency === "NGN" || Number.isInteger(amount);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    })
      .format(amount)
      .replace(/\u00a0/g, " ");
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Nights left in words, for the room header. */
export function nightsLeftLabel(n: SquadNights): string {
  if (n.nights_left === 0) return "No nights left";
  return n.nights_left === 1 ? "1 night left" : `${n.nights_left} nights left`;
}

/** The share link for a room (same shape as every invite: /i/CODE/PIN). */
export function squadInviteUrl(code: string, pin: string, origin = window.location.origin): string {
  return `${origin}/i/${code}/${pin}`;
}

/** Tell the squad where I am (city optional, zone from the browser). */
export function setSquadWhere(roomId: string, body: { city?: string | null; tz?: string | null }) {
  return api.patch<SquadMember>(`/v1/rooms/${roomId}/members/me`, body);
}

export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// ── Between nights: members, planning, league (F2c) ─────────────────────

export function setSquadCohost(roomId: string, participantId: string, on: boolean) {
  return api.post<SquadMembers>(`/v1/rooms/${roomId}/members/${participantId}/cohost`, { on });
}

/** Owner or co-host: take someone out of the squad (they can't rejoin). */
export function removeSquadMember(roomId: string, participantId: string) {
  return api.delete<void>(`/v1/rooms/${roomId}/members/${participantId}`);
}

export function leaveSquad(roomId: string) {
  return api.post<{ new_owner_user_id: string | null }>(`/v1/rooms/${roomId}/leave-squad`, {});
}

/** Anyone: stop new people joining (until the night ends, or 12 hours). */
export function lockSquad(roomId: string, locked: boolean) {
  return api.post<SquadMembers>(`/v1/rooms/${roomId}/lock`, { locked });
}

export type SquadPlanOption = { id: string; starts_at: string; ticked_by: string[] };

export type SquadPlanPoll = {
  id: string;
  status: "open" | "locked" | "no_time";
  locks_at: string;
  chosen_at: string | null;
  options: SquadPlanOption[];
  answered: string[];
  my_option_ids: string[];
};

export type SquadPlanView = {
  next_night_at: string | null;
  members: { participant_id: string; display_name: string; city: string | null; tz: string | null }[];
  plan: SquadPlanPoll | null;
};

export function getSquadPlan(roomId: string) {
  return api.get<SquadPlanView>(`/v1/rooms/${roomId}/plans/current`);
}

export function proposeSquadPlan(roomId: string, times: string[]) {
  return api.post<SquadPlanView>(`/v1/rooms/${roomId}/plans`, { times, tz: browserTimeZone() });
}

export function answerSquadPlan(roomId: string, optionIds: string[]) {
  return api.put<SquadPlanView>(`/v1/rooms/${roomId}/plans/current/response`, { option_ids: optionIds });
}

export type SquadLeagueEntry = {
  user_id: string;
  display_name: string;
  points: number;
  by_game: Record<string, number>;
};

export function getSquadLeague(roomId: string) {
  return api.get<SquadLeagueEntry[]>(`/v1/rooms/${roomId}/games/league`);
}

/** The server's own words for a refused squad action, else a fallback. */
export function squadErrorText(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const detail = (e.body as { detail?: unknown } | undefined)?.detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message: unknown }).message);
    }
  }
  return fallback;
}
