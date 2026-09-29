/**
 * Squad beta, the requester's side. Squad (friend nights for 2 to 5 people)
 * opens to a few groups first: the public slot says "Request access", a
 * signed-in person answers a few short questions, and the team lets groups
 * in from the admin queue. Mirrors backend `api/v1/squad.py`.
 */
import { api } from "@/lib/api";

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
