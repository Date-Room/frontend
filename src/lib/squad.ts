/**
 * Squad beta, the requester's side. Squad (friend nights for 2 to 6 people)
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

export const SQUAD_GROUP_SIZES = [2, 3, 4, 5, 6] as const;

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

// Up to 6 on a call (three either side of the game card), once the server
// allows it (SQUAD_MAX_PER_CALL); until then 6 gets a clear "up to 5" answer.
export const SQUAD_SEATS = [2, 3, 4, 5, 6] as const;

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
  /** The room's night size. */
  seats: number;
  seat_nights: number;
  nights_left: number;
  /** Seats left after the whole nights (missing on older servers). */
  spare_seats?: number;
  /** The balance as nights + spare at each night size the host could pick. */
  by_size?: { seats: number; nights: number; spare: number }[];
  /** People on the call right now; 0 between nights. */
  on_call?: number;
  /** The latest nights bought or gifted into the room. */
  last_top_up?: { by: string; nights: number; source: "purchase" | "admin"; at: string } | null;
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
  /** My "email me about nights" switch (missing on older servers: on). */
  my_night_emails?: boolean;
  /** "Everyone in the squad can manage it" (owner's choice). */
  members_manage?: boolean;
  /** "Anyone with the link joins" instead of new people needing approval. */
  open_join?: boolean;
  /** New people need approval right now (approval is on and the room isn't open). */
  approval_needed?: boolean;
};

/** Pure: may I run the squad (lend seats, change the night size, let
 *  people in)? The owner and co-hosts, or everyone when the room says so. */
export function canRunSquad(m: SquadMembers | undefined): boolean {
  if (!m) return false;
  return m.my_role === "owner" || m.my_role === "cohost" || Boolean(m.members_manage);
}

/** The owner's choices: who manages the squad, and whether new people need approval. */
export function setSquadSettings(roomId: string, body: { members_manage?: boolean; open_join?: boolean }) {
  return api.patch<SquadMembers>(`/v1/rooms/${roomId}/squad/settings`, body);
}

/** How many seats a night books from now on (tonight keeps its seats). */
export function setSquadNightSize(roomId: string, seats: number) {
  return api.patch<SquadNights>(`/v1/rooms/${roomId}/squad/night-size`, { seats });
}

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

/** Start a night; `seats` for fewer (or more) than the room's night size. */
export function startSquadNight(roomId: string, seats?: number) {
  return api.post<SquadNights>(`/v1/rooms/${roomId}/nights`, seats ? { seats } : {});
}

/** Pure: the night sizes a night can start at (2 up to the squad limit),
 *  from the server's by_size; falls back to the room's size alone. */
export function nightSizes(n: SquadNights): number[] {
  const sizes = (n.by_size ?? []).map((b) => b.seats);
  return sizes.length ? sizes : [n.seats];
}

/** Pure: "3 nights + 1 spare seat" for a balance at a night size. */
export function nightsAndSpare(seatNights: number, size: number): string {
  const nights = size > 0 ? Math.floor(seatNights / size) : 0;
  const spare = size > 0 ? seatNights % size : 0;
  const n = nights === 1 ? "1 night" : `${nights} nights`;
  return spare ? `${n} + ${spare} spare seat${spare === 1 ? "" : "s"}` : n;
}

/** One more seat for tonight from the room's nights (any member can). 402 when the room has none left. */
export function addSquadSeat(roomId: string) {
  return api.post<{ seats: number; ends_at: string }>(`/v1/rooms/${roomId}/nights/current/seats`, {});
}

/** What the server says when tonight's seats are all taken (409 on the video token). */
export type NightFull = { seats: number; can_add_seat: boolean; product: string | null };

/** Pure: the night_full refusal from a video-token error, or null for anything else. */
export function nightFullFrom(e: unknown): NightFull | null {
  if (!(e instanceof ApiError) || e.status !== 409) return null;
  const detail = (e.body as { detail?: unknown } | undefined)?.detail as Record<string, unknown> | undefined;
  if (!detail || typeof detail !== "object" || detail.error !== "night_full") return null;
  return {
    seats: Number(detail.seats) || 0,
    can_add_seat: detail.can_add_seat !== false,
    product: typeof detail.product === "string" ? detail.product : null,
  };
}

/** Pure: what the person left off the call can do. */
export function seatChoice(full: NightFull, seatNights: number | null): "maxed" | "use_balance" | "pay" | "loading" {
  if (!full.can_add_seat) return "maxed";
  if (seatNights == null) return "loading";
  return seatNights > 0 ? "use_balance" : "pay";
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
/** Pure: "3 of 3 seats taken" for a night that's on, or null when the
 *  server doesn't say (older servers) or nobody's on yet. */
export function seatsTakenLabel(n: SquadNights): { text: string; full: boolean } | null {
  const night = n.active_night;
  if (!night || n.on_call == null || n.on_call <= 0) return null;
  const taken = Math.min(n.on_call, night.seats);
  const full = n.on_call >= night.seats;
  return { text: `${taken} of ${night.seats} seat${night.seats === 1 ? "" : "s"} taken`, full };
}

export function nightsLeftLabel(n: SquadNights): string {
  const spare = n.spare_seats ?? 0;
  const spareText = spare ? ` + ${spare} spare seat${spare === 1 ? "" : "s"}` : "";
  if (n.nights_left === 0) return spare ? `No full nights · ${spare} spare seat${spare === 1 ? "" : "s"}` : "No nights left";
  return (n.nights_left === 1 ? "1 night left" : `${n.nights_left} nights left`) + spareText;
}

/** "Joshua added 1 night · 3 Oct" / "DateRoom gifted 3 nights · 3 Oct", or null. */
export function lastTopUpLabel(n: SquadNights): string | null {
  const t = n.last_top_up;
  if (!t) return null;
  const nights = t.nights === 1 ? "1 night" : `${t.nights} nights`;
  const when = new Date(t.at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return t.source === "admin" ? `DateRoom gifted ${nights} · ${when}` : `${t.by} added ${nights} · ${when}`;
}

/** The share link for a room (same shape as every invite: /i/CODE/PIN). */
export function squadInviteUrl(code: string, pin: string, origin = window.location.origin): string {
  return `${origin}/i/${code}/${pin}`;
}

/** Tell the squad where I am (city optional, zone from the browser). */
export function setSquadWhere(roomId: string, body: { city?: string | null; tz?: string | null }) {
  return api.patch<SquadMember>(`/v1/rooms/${roomId}/members/me`, body);
}

/** Email me about nights (plan decided, starting soon, started without me). */
export function setSquadNightEmails(roomId: string, on: boolean) {
  return api.patch<SquadMember>(`/v1/rooms/${roomId}/members/me`, { night_emails: on });
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

// ── Lending a seat (backend#114) ─────────────────────────────────────────

export type SeatRequest = {
  id: string;
  user_id: string;
  name: string;
  /** pending | lent | declined | cancelled | expired */
  status: string;
  created_at: string;
  expires_at: string;
};

/** What lending one seat leaves the squad with. */
export type SeatEffect = {
  night_size: number;
  seats_before: number;
  seats_after: number;
  nights_before: number;
  spare_before: number;
  nights_after: number;
  spare_after: number;
  can_lend: boolean;
};

export type SeatRequests = { requests: SeatRequest[]; effect: SeatEffect | null; can_lend: boolean };

/** Live events: someone asked; a manager answered. `seat_request_paid` is
 *  sent by a manager's app after paying for the seat themselves. */
export const SEAT_REQUESTED = "seat_requested";
export const SEAT_DECIDED = "seat_request_decided";
export const SEAT_PAID = "seat_request_paid";

export function askForSeat(roomId: string) {
  return api.post<SeatRequest>(`/v1/rooms/${roomId}/nights/current/seat-requests`, {});
}

export function getSeatRequests(roomId: string) {
  return api.get<SeatRequests>(`/v1/rooms/${roomId}/nights/current/seat-requests`);
}

export function lendSeat(roomId: string, requestId: string) {
  return api.post<SeatRequest>(`/v1/rooms/${roomId}/nights/current/seat-requests/${requestId}/lend`, {});
}

export function declineSeat(roomId: string, requestId: string) {
  return api.post<SeatRequest>(`/v1/rooms/${roomId}/nights/current/seat-requests/${requestId}/decline`, {});
}

export function cancelSeatRequest(roomId: string, requestId: string) {
  return api.delete<void>(`/v1/rooms/${roomId}/nights/current/seat-requests/${requestId}`);
}

/** Pure: the cost of saying yes, in the squad's own terms.
 *  "Lending a seat leaves 3 nights + 1 spare seat (was 4 nights)." */
export function seatEffectLine(e: SeatEffect): string {
  if (!e.can_lend) return "The squad has no seats left to lend.";
  const after = nightsAndSpare(e.seats_after, e.night_size);
  const before = nightsAndSpare(e.seats_before, e.night_size);
  return `Lending a seat leaves ${after} (was ${before}).`;
}

/** Pure: the squad owner's first name, for "Ask Joshua". */
export function ownerFirstName(m: SquadMembers | undefined): string {
  const owner = m?.members.find((x) => x.role === "owner");
  return (owner?.display_name || "the host").split(" ")[0];
}

/** Pure: the error code on a squad API refusal, if any. */
export function squadErrorCode(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  const detail = (e.body as { detail?: unknown } | undefined)?.detail;
  return detail && typeof detail === "object" && "error" in detail ? String((detail as { error: unknown }).error) : null;
}

// ── Letting new people in (backend#116) ──────────────────────────────────

export type JoinRequest = {
  id: string;
  user_id: string;
  display_name: string;
  photo_url: string | null;
  /** pending | approved | declined */
  status: string;
  created_at: string;
};

export type MyJoinRequest = {
  /** none | pending | approved | declined | member */
  status: string;
  approval_needed: boolean;
  request: JoinRequest | null;
};

export const JOIN_REQUESTED = "join_requested";

export function getMyJoinRequest(roomId: string) {
  return api.get<MyJoinRequest>(`/v1/rooms/${roomId}/join-request`);
}

export function getJoinRequests(roomId: string) {
  return api.get<{ requests: JoinRequest[] }>(`/v1/rooms/${roomId}/join-requests`);
}

export function approveJoin(roomId: string, requestId: string) {
  return api.post<{ requests: JoinRequest[] }>(`/v1/rooms/${roomId}/join-requests/${requestId}/approve`, {});
}

export function declineJoin(roomId: string, requestId: string) {
  return api.post<{ requests: JoinRequest[] }>(`/v1/rooms/${roomId}/join-requests/${requestId}/decline`, {});
}

export function approveAllJoins(roomId: string) {
  return api.post<{ requests: JoinRequest[] }>(`/v1/rooms/${roomId}/join-requests/approve-all`, {});
}

/** Pure: a squad join refusal that needs its own screen rather than an
 *  error toast, or null. */
export function joinGate(e: unknown): "awaiting_approval" | "declined" | "room_locked" | "removed" | null {
  const code = squadErrorCode(e);
  return code === "awaiting_approval" || code === "declined" || code === "room_locked" || code === "removed"
    ? code
    : null;
}

/** Pure: "Amina and Kev want to join" / "Amina, Kev and 2 others want to join". */
export function joinAskLine(reqs: { display_name: string }[]): string {
  const names = reqs.map((r) => (r.display_name || "Someone").split(" ")[0]);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} wants to join the squad`;
  if (names.length === 2) return `${names[0]} and ${names[1]} want to join the squad`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length === 3 ? "" : "s"} want to join the squad`;
}
