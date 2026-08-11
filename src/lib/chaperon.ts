/**
 * Chaperon (AI call observer) — client types, API, display catalog, and the
 * pure whisper-gate that enforces the spec's frequency caps.
 *
 * The whisper is the product: how the Guardian/Wing observations reach the
 * user mid-call. This module owns the *policy* (one visible at a time,
 * per-category cooldown, coach rate cap, alerts preempt) as pure functions so
 * it's unit-testable; `useChaperon` wires it to the mic + server cadence.
 *
 * v1 = local Web Speech transcript only (server STT is out of scope). Nothing
 * here renders unless the room experience advertises `chaperon_enabled`.
 */
import { api } from "@/lib/api";

// guardian = Protect (free baseline); coached = Protect + Coaching (paid beta).
// "wing" (coaching-only) is legacy and no longer offered by the UI.
export type ChaperonMode = "guardian" | "wing" | "coached";
export type ChaperonSeverity = "info" | "note" | "warn" | "alert";
export type ChaperonDataTier = "none" | "shadow" | "beta_labeled";

export type ChaperonSignal = {
  /** null in `none` data tier (nothing logged → not rateable). */
  event_id: string | null;
  check_id: string;
  severity: ChaperonSeverity;
  whisper: string;
  confidence: number;
};

export type ChaperonSession = {
  id: string;
  room_id: string;
  mode: ChaperonMode;
  checks: string[];
  announce_presence: boolean;
  data_tier: ChaperonDataTier;
  started_at: string;
  ended_at: string | null;
};

export type ChaperonTranscriptTurn = { speaker: "local" | "remote"; text: string; at: number };

export type ChaperonEvaluateResponse = {
  signals: ChaperonSignal[];
  next_eval_ms: number;
  healthy: boolean;
};

// --- API -------------------------------------------------------------------

/** End-of-date summary the judge writes once per session (recap page). */
export type ChaperonDebrief = {
  headline: string;
  moments: string[];
  tip: string;
  safety: "all_clear" | "flagged";
};

export type ChaperonDebriefResponse = {
  session_id: string;
  mode: ChaperonMode;
  data_tier: ChaperonDataTier;
  started_at: string;
  ended_at: string | null;
  // null while the session is active, or on the `none` (no-retention) tier.
  debrief: ChaperonDebrief | null;
};

/** 404s when the caller never ran a chaperon in this room. */
export function getChaperonDebrief(roomId: string): Promise<ChaperonDebriefResponse> {
  return api.get<ChaperonDebriefResponse>(`/v1/chaperon/rooms/${roomId}/debrief`);
}

export function createChaperonSession(body: {
  room_id: string;
  mode: ChaperonMode;
  checks: string[];
  announce_presence: boolean;
  data_tier: ChaperonDataTier;
}): Promise<ChaperonSession> {
  return api.post<ChaperonSession>("/v1/chaperon/sessions", body);
}

export function evaluateChaperon(
  sessionId: string,
  body: { transcript_window: ChaperonTranscriptTurn[]; elapsed_sec: number },
): Promise<ChaperonEvaluateResponse> {
  return api.post<ChaperonEvaluateResponse>(
    `/v1/chaperon/sessions/${sessionId}/evaluate`,
    body,
  );
}

export function sendChaperonFeedback(
  sessionId: string,
  body: { event_id: string; helpful: boolean },
): Promise<void> {
  return api.post<void>(`/v1/chaperon/sessions/${sessionId}/feedback`, body);
}

export function endChaperonSession(sessionId: string): Promise<ChaperonSession> {
  return api.post<ChaperonSession>(`/v1/chaperon/sessions/${sessionId}/end`);
}

// --- Coach beta (gated premium) --------------------------------------------

export type CoachBetaStatus = {
  calls_remaining: number;
  // null | pending | granted | declined
  application_status: string | null;
};

export function getCoachBetaStatus(): Promise<CoachBetaStatus> {
  return api.get<CoachBetaStatus>("/v1/chaperon/coach-beta");
}

export function applyCoachBeta(reason: string): Promise<CoachBetaStatus> {
  return api.post<CoachBetaStatus>("/v1/chaperon/coach-beta/apply", { reason });
}

/** What Coach will cost once it leaves beta — shown to prime willingness to
 *  pay while it's free-in-beta. */
export const COACH_PRICE_BLURB =
  "Will be part of the Chaperoned Datepack ($7.99) or Guardian ($12.99/mo). Free while in beta.";

// --- Whisper gate (pure policy) --------------------------------------------

export type GateConfig = {
  /** How long a whisper stays on screen. */
  displayMs: number;
  /** Same category suppressed for this long (alerts are exempt). */
  categoryCooldownMs: number;
  /** Coach (info/note) rate caps — spec §4.2: 1 per 2 min, 3 per 10 min. */
  coachShortWindowMs: number;
  coachShortMax: number;
  coachLongWindowMs: number;
  coachLongMax: number;
};

export const DEFAULT_GATE_CONFIG: GateConfig = {
  displayMs: 6_000,
  categoryCooldownMs: 20_000,
  coachShortWindowMs: 120_000,
  coachShortMax: 1,
  coachLongWindowMs: 600_000,
  coachLongMax: 3,
};

export type GateState = {
  current: ChaperonSignal | null;
  lastByCategory: Record<string, number>;
  /** Timestamps of shown coach whispers (for the rate cap). */
  coachShownAt: number[];
};

export function initGate(): GateState {
  return { current: null, lastByCategory: {}, coachShownAt: [] };
}

function isCoach(sev: ChaperonSeverity): boolean {
  return sev === "info" || sev === "note";
}

/**
 * Decide whether an incoming signal becomes the visible whisper. Alerts always
 * preempt (safety's sharp end). Otherwise: one visible at a time, per-category
 * cooldown, and the coach rate cap. Returns the (possibly unchanged) state and
 * the signal to show, or null when suppressed.
 */
export function admitSignal(
  state: GateState,
  signal: ChaperonSignal,
  now: number,
  cfg: GateConfig = DEFAULT_GATE_CONFIG,
): { state: GateState; show: ChaperonSignal | null } {
  if (signal.severity === "alert") {
    return {
      state: {
        ...state,
        current: signal,
        lastByCategory: { ...state.lastByCategory, [signal.check_id]: now },
      },
      show: signal,
    };
  }

  if (state.current) return { state, show: null }; // one at a time

  const last = state.lastByCategory[signal.check_id];
  if (last != null && now - last < cfg.categoryCooldownMs) return { state, show: null };

  const coach = isCoach(signal.severity);
  const recentCoach = state.coachShownAt.filter((t) => now - t < cfg.coachLongWindowMs);
  if (coach) {
    const inShort = recentCoach.filter((t) => now - t < cfg.coachShortWindowMs).length;
    if (inShort >= cfg.coachShortMax || recentCoach.length >= cfg.coachLongMax) {
      return { state, show: null };
    }
  }

  return {
    state: {
      current: signal,
      lastByCategory: { ...state.lastByCategory, [signal.check_id]: now },
      coachShownAt: coach ? [...recentCoach, now] : recentCoach,
    },
    show: signal,
  };
}

export function dismissCurrent(state: GateState): GateState {
  return { ...state, current: null };
}
