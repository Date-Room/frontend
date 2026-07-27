/**
 * Admin portal API client — /v1/admin/*
 */
import { api } from "@/lib/api";

export type AdminStats = {
  total_users: number;
  new_users_7d: number;
  active_subscriptions: number;
  total_pass_credits: number;
  live_rooms: number;
  persistent_rooms: number;
  promo_redemptions_30d: number;
  mpesa_success_30d: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string;
  country: string | null;
  provider: string | null;
  is_admin: boolean;
  account_tier: string;
  account_tier_label: string;
  created_at: string;
  last_login_at: string | null;
};

export type AdminUserDetail = AdminUserRow & {
  date_pack_remaining: number;
  long_pack_remaining: number;
  together_remaining: number;
  crew_remaining: number;
  has_active_subscription: boolean;
  referral_code: string;
  stripe_customer_id: string | null;
};

export type PromoCode = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  kind: "tier_grant" | "percent_off" | "fixed_off";
  tier_product: "date_pack" | "long_pack" | "together" | "crew" | null;
  percent_off: number | null;
  fixed_off_cents: number | null;
  subscription_days: number | null;
  pass_units: number | null;
  max_redemptions: number | null;
  redemption_count: number;
  max_per_user: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
};

export type AdminRoomRow = {
  id: string;
  code: string;
  state: string;
  package: string;
  persistence: string;
  host_email: string | null;
  participant_count: number;
  max_participants: number;
  created_at: string;
  expires_at: string | null;
};

export type AdminAuditRow = {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type Page<T> = { items: T[]; next_cursor: string | null };

export function getAdminMe() {
  return api.get<{ id: string; email: string; display_name: string; is_admin: boolean }>(
    "/v1/admin/me",
  );
}

export function getAdminStats() {
  return api.get<AdminStats>("/v1/admin/stats");
}

export function listAdminUsers(params?: { search?: string; cursor?: string }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.cursor) qs.set("cursor", params.cursor);
  const q = qs.toString();
  return api.get<Page<AdminUserRow>>(`/v1/admin/users${q ? `?${q}` : ""}`);
}

export function getAdminUser(id: string) {
  return api.get<AdminUserDetail>(`/v1/admin/users/${id}`);
}

export function grantUserProduct(
  id: string,
  body: { product: string; subscription_days?: number; note?: string },
) {
  return api.post<void>(`/v1/admin/users/${id}/grant`, body);
}

export function revokeUserSubscription(id: string) {
  return api.post<void>(`/v1/admin/users/${id}/revoke-subscription`);
}

export function setUserAdmin(id: string, is_admin: boolean) {
  return api.patch<void>(`/v1/admin/users/${id}/admin`, { is_admin });
}

export function listPromoCodes() {
  return api.get<Page<PromoCode>>("/v1/admin/promo-codes");
}

export function createPromoCode(body: Record<string, unknown>) {
  return api.post<PromoCode>("/v1/admin/promo-codes", body);
}

export function generatePromoCodes(body: Record<string, unknown>) {
  return api.post<{ items: PromoCode[] }>("/v1/admin/promo-codes/generate", body);
}

export function updatePromoCode(id: string, body: Record<string, unknown>) {
  return api.patch<PromoCode>(`/v1/admin/promo-codes/${id}`, body);
}

export function listAdminRooms(state?: string) {
  const q = state ? `?state=${encodeURIComponent(state)}` : "";
  return api.get<Page<AdminRoomRow>>(`/v1/admin/rooms${q}`);
}

export function listAdminAudit() {
  return api.get<Page<AdminAuditRow>>("/v1/admin/audit");
}

// --- Chaperon (AI observer) provider config -------------------------------

export type ChaperonProviderInfo = {
  id: string; // mock | anthropic | gemini | openai | openai_compat
  configured: boolean; // env keys present (never the key itself)
  default_model: string;
  models: string[]; // suggested models for the dropdown
};

export type ChaperonTestResult = {
  ok: boolean;
  error: string | null;
  latency_ms: number | null;
  signals: number;
  sample_whisper: string | null;
};

export function testChaperonProvider(body: { provider: string; model: string }) {
  return api.post<ChaperonTestResult>("/v1/admin/chaperon/test", body);
}

export type ChaperonStats = {
  sessions_today: number;
  signals_today: number;
  thumbs_up_pct: number | null;
};

export type ChaperonConfig = {
  provider: string;
  model: string;
  providers: ChaperonProviderInfo[];
  stats: ChaperonStats;
};

export function getChaperonConfig() {
  return api.get<ChaperonConfig>("/v1/admin/chaperon/config");
}

export function setChaperonConfig(body: { provider: string; model: string }) {
  return api.patch<ChaperonConfig>("/v1/admin/chaperon/config", body);
}

// --- Coach beta (gated premium) — applicant queue + grant -----------------

export type CoachBetaApplication = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  reason: string;
  status: string;
  created_at: string;
  calls_remaining: number;
};

export type CoachBetaApplicationsResponse = {
  items: CoachBetaApplication[];
  pending_count: number;
};

export function listCoachBetaApplications() {
  return api.get<CoachBetaApplicationsResponse>("/v1/admin/chaperon/coach-beta/applications");
}

export type CoachBetaGrantResult = {
  user_id: string;
  calls_remaining: number;
  calls_granted_total: number;
};

// The server clamps calls to 1..5; the UI stepper enforces the same range.
export const COACH_BETA_MAX_GRANT = 5;

export function grantCoachBeta(body: { user_id: string; calls: number }) {
  return api.post<CoachBetaGrantResult>("/v1/admin/chaperon/coach-beta/grant", body);
}

// --- Chaperon Protect entitlement (free first date, then metered) ------------

export type ProtectGrantResult = {
  user_id: string;
  credits_remaining: number;
  credits_granted_total: number;
};

// Server clamps to 1..10; the stepper enforces the same.
export const PROTECT_MAX_GRANT = 10;

export function getProtectConfig() {
  return api.get<{ metering_enabled: boolean }>("/v1/admin/chaperon/protect-config");
}

export function setProtectMetering(enabled: boolean) {
  return api.patch<{ metering_enabled: boolean }>("/v1/admin/chaperon/protect-config", {
    enabled,
  });
}

export function grantProtect(body: { user_id: string; dates: number }) {
  return api.post<ProtectGrantResult>("/v1/admin/chaperon/protect/grant", body);
}

// --- Chaperon speech-to-text (STT) provider ---------------------------------

export type SttProviderInfo = {
  id: string; // mock | deepgram | assemblyai
  configured: boolean; // env key present (never the key itself)
};

export type SttConfig = {
  provider: string;
  providers: SttProviderInfo[];
};

export type SttTestResult = {
  ok: boolean;
  error: string | null;
  latency_ms: number | null;
  sample_transcript: string | null;
};

export function getSttConfig() {
  return api.get<SttConfig>("/v1/admin/chaperon/stt-config");
}

export function setSttConfig(body: { provider: string }) {
  return api.patch<SttConfig>("/v1/admin/chaperon/stt-config", body);
}

export function testSttProvider(body: { provider: string }) {
  return api.post<SttTestResult>("/v1/admin/chaperon/stt-test", body);
}

export function getPlatformInfo() {
  return api.get<{ environment: string; paywall_enabled: boolean; admin_emails_configured: number }>(
    "/v1/admin/platform",
  );
}

export function redeemPromoCode(code: string) {
  return api.post<{ success: boolean; message: string; benefit: string }>(
    "/v1/billing/redeem-promo",
    { code },
  );
}
