/**
 * Where a sign-up came from, held until the /auth flow can send it. Mirrors
 * pendingReferral: captured from `?src=` on any page that links to sign-in
 * (recap hook, chaperon badge), read at verify, cleared after a successful
 * sign-in. Applied server-side on FIRST creation only, so a returning user's
 * original source is never overwritten.
 */
const KEY = "dr_signup_source";
const ALLOWED = /^[a-z0-9_]{1,32}$/;

export function captureSignupSource(search: string): void {
  try {
    const src = new URLSearchParams(search).get("src")?.trim().toLowerCase() ?? "";
    if (ALLOWED.test(src)) localStorage.setItem(KEY, src);
  } catch {
    /* best-effort */
  }
}

export function getSignupSource(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && ALLOWED.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function clearSignupSource(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
