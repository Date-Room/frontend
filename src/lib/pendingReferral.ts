/**
 * Holds a referral code captured from a `dateroom.io/r/{code}` landing
 * page until the visitor reaches the /auth flow that can attribute it.
 *
 * Persistence: localStorage (the code isn't secret — it's the inviter's
 * public referral handle). Survives reloads and tab restarts so a
 * visitor who lands on /r/CODE, gets distracted, and comes back later
 * still gets attributed correctly.
 *
 * Lifecycle:
 *   • Captured: ReferralLanding writes when the route mounts.
 *   • Read: Auth.tsx pulls on requestOtp/verifyOtp and passes through.
 *   • Cleared: explicitly after a successful sign-in so a later,
 *     unrelated visit on the same browser isn't mis-attributed.
 */
const KEY = "pending_referral_code";

export function setPendingReferral(code: string): void {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;
  try {
    localStorage.setItem(KEY, trimmed);
  } catch {
    /* private mode / storage disabled — referral attribution is best-effort */
  }
}

export function getPendingReferral(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferral(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
