/**
 * Backend-owned auth client.
 *
 * Phase 1 of the Supabase-auth migration. Replaces `supabase.auth.*` for
 * sign-in, sign-out, session, and refresh. Supabase Realtime (separate
 * module: `supabaseClient.ts`) is kept around until Phase 2.
 *
 * Persists the refresh + access tokens (and a cached user snapshot) in
 * localStorage so signed-in state survives a reload. Refresh is
 * single-flight: `api.ts` calls `authClient.refresh()` on a 401 and the
 * first caller does the network round-trip; concurrent callers wait on
 * the same promise.
 */

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  photo_url: string | null;
  country: string | null;
  profile_complete: boolean;
  email_verified_at: string | null;
  provider: string | null;
};

export type Session = {
  access_token: string;
  refresh_token: string;
  /** Wall-clock ms when the access token expires. */
  expires_at: number;
  user: AuthUser;
};

const STORAGE_KEY = "dr_auth_v1";
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

/** Build a same-origin `next` path to round-trip through OAuth so the
 * user lands back where they started.
 * - /auth and /auth/callback aren't useful return targets — prefer
 *   their own `?next=` param if present, otherwise `/`.
 * - Anywhere else: round-trip the current path (incl. search + hash). */
function currentNext(): string {
  if (typeof window === "undefined") return "/";
  const { pathname, search, hash } = window.location;
  if (pathname === "/auth" || pathname === "/auth/callback") {
    const inner = new URLSearchParams(search).get("next");
    return inner && inner.startsWith("/") && !inner.startsWith("//") ? inner : "/";
  }
  return `${pathname}${search}${hash}` || "/";
}

type Listener = (s: Session | null) => void;

class AuthClient {
  private session: Session | null = null;
  private listeners = new Set<Listener>();
  private refreshing: Promise<Session | null> | null = null;

  constructor() {
    this.load();
  }

  // -- persistence ---------------------------------------------------------

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.session = JSON.parse(raw) as Session;
    } catch {
      this.session = null;
    }
  }

  private save() {
    try {
      if (this.session) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private browsing — degrade gracefully */
    }
  }

  private set(next: Session | null) {
    this.session = next;
    this.save();
    for (const listener of this.listeners) listener(next);
  }

  // -- public surface ------------------------------------------------------

  getSession(): Session | null {
    return this.session;
  }

  getAccessToken(): string | null {
    return this.session?.access_token ?? null;
  }

  /** Subscribe to session changes. Returns an unsubscribe function. */
  onAuthStateChange(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async requestOtp(email: string): Promise<void> {
    const response = await fetch(`${API_BASE}/v1/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, client: "web" }),
      credentials: "include", // browser-bound magic-link cookie
    });
    if (!response.ok) throw await asError(response, "Could not send the sign-in code.");
  }

  async verifyOtp(email: string, code: string): Promise<Session> {
    const response = await fetch(`${API_BASE}/v1/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `device_label: "web"` keeps the refresh token on the rolling
      // TTL — shared browsers shouldn't keep their session forever.
      body: JSON.stringify({ email, code, device_label: "web" }),
    });
    if (!response.ok) throw await asError(response, "Could not verify the code.");
    return this.finalizeSignIn(await response.json());
  }

  async verifyLink(token: string): Promise<Session> {
    const response = await fetch(`${API_BASE}/v1/auth/verify-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, device_label: "web" }),
      credentials: "include", // matches the browser cookie set on request-otp
    });
    if (!response.ok) throw await asError(response, "This sign-in link no longer works.");
    return this.finalizeSignIn(await response.json());
  }

  /** Kick off Google sign-in. Full-page redirect; the backend redirects
   * to Google, Google back to the backend, and the backend lands the
   * user at `/auth/callback?next=…#at=…&rt=…` — handled by ingestFragment.
   * `next` carries the path the user was on so we can return them there
   * after the round-trip. */
  signInWithGoogle(): void {
    window.location.href = `${API_BASE}/v1/auth/google/start?next=${encodeURIComponent(
      currentNext(),
    )}`;
  }

  /** Kick off Apple sign-in. Same redirect shape as Google. */
  signInWithApple(): void {
    window.location.href = `${API_BASE}/v1/auth/apple/start?next=${encodeURIComponent(
      currentNext(),
    )}`;
  }

  /** Consume tokens that landed in the URL hash from an OAuth callback.
   * The OAuth endpoints don't return the user inline (would force a
   * giant URL); we set the tokens, then call /v1/auth/session to fetch
   * the user, then re-broadcast SIGNED_IN with the real user. */
  async ingestFragment(rawHash: string): Promise<Session | null> {
    const params = new URLSearchParams(rawHash.startsWith("#") ? rawHash.slice(1) : rawHash);
    const access = params.get("at");
    const refresh = params.get("rt");
    const expiresInRaw = params.get("expires_in");
    if (!access || !refresh || !expiresInRaw) return null;
    const expiresIn = Number(expiresInRaw);
    if (!Number.isFinite(expiresIn)) return null;

    // Temporary stub user so subsequent calls authenticate; replaced
    // once /session returns the real row.
    const stub: AuthUser = {
      id: "",
      email: "",
      display_name: "",
      photo_url: null,
      country: null,
      profile_complete: false,
      email_verified_at: null,
      provider: null,
    };
    this.set({
      access_token: access,
      refresh_token: refresh,
      expires_at: Date.now() + expiresIn * 1000,
      user: stub,
    });

    try {
      const response = await fetch(`${API_BASE}/v1/auth/session`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (!response.ok) throw new Error("Could not load session.");
      const data = (await response.json()) as { user: AuthUser };
      const current = this.session;
      if (!current) return null;
      const next: Session = { ...current, user: data.user };
      this.set(next);
      return next;
    } catch (err) {
      this.set(null);
      throw err;
    }
  }

  async signOut(): Promise<void> {
    const refresh = this.session?.refresh_token;
    this.set(null);
    if (refresh) {
      // Fire-and-forget revoke — UX shouldn't block on a network round-trip.
      void fetch(`${API_BASE}/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => undefined);
    }
  }

  /**
   * Rotate the refresh token. Single-flight: concurrent callers share the
   * same in-flight promise. `api.ts` calls this on a 401 and retries the
   * original request once. Returns the new session, or null if the
   * refresh failed (in which case the local session is already cleared).
   */
  async refresh(): Promise<Session | null> {
    if (this.refreshing) return this.refreshing;
    const current = this.session;
    if (!current) return null;
    this.refreshing = (async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refresh_token: current.refresh_token,
            device_label: "web",
          }),
        });
        if (!response.ok) {
          this.set(null);
          return null;
        }
        const data = (await response.json()) as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
        };
        const next: Session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + data.expires_in * 1000,
          user: current.user,
        };
        this.set(next);
        return next;
      } catch {
        // Network error etc. — leave the session in place; the next
        // request gets another shot. Do NOT clear here, that would
        // bounce a working app on a transient hiccup.
        return null;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  // -- private -------------------------------------------------------------

  private finalizeSignIn(data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: AuthUser;
  }): Session {
    const session: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      user: data.user,
    };
    this.set(session);
    return session;
  }
}

async function asError(response: Response, fallback: string): Promise<Error> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* not JSON — fall through to the fallback message */
  }
  const detail =
    body && typeof body === "object" && "detail" in body
      ? (body as { detail: unknown }).detail
      : null;
  const message = typeof detail === "string" ? detail : fallback;
  return new Error(message);
}

export const authClient = new AuthClient();

/** True when the API base URL is configured and we can call /v1/auth. */
export function authConfigured(): boolean {
  return Boolean(API_BASE);
}
