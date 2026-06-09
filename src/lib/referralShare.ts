/** Canonical marketing origin for friend invites (`/r/{code}`). */
export const REFERRAL_SITE_ORIGIN =
  (import.meta.env.VITE_REFERRAL_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://dateroom.io";

export function buildReferralShareUrl(code: string): string {
  const normalized = code.trim().toUpperCase();
  return `${REFERRAL_SITE_ORIGIN}/r/${normalized}`;
}

export function buildReferralShareMessage(shareUrl: string, inviterName?: string): string {
  const who = inviterName?.trim();
  const lead = who ? `${who} invited you to DateRoom` : "Join me on DateRoom";
  return `${lead} — virtual dates for two.\n\n${shareUrl}`;
}
