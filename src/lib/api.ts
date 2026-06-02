/**
 * Typed fetch wrapper for the deployed FastAPI backend (`/v1/…`).
 *
 * - Base URL comes from VITE_API_BASE_URL (the Railway origin, no trailing slash).
 *   Callers pass the full path including `/v1`, e.g. `api.post("/v1/rooms", …)`.
 *   Non-`/v1` routes (`/i/{code}`, `/auth/callback`) also live under this origin.
 * - Attaches the backend-issued access token as `Authorization: Bearer …`.
 * - On a 401 we transparently refresh once and retry; a second 401 propagates
 *   so the caller (and AuthGuard) can land the user back on /auth.
 */
import { authClient } from "@/lib/authClient";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function apiConfigured(): boolean {
  return Boolean(API_BASE);
}

function authHeader(): Record<string, string> {
  const token = authClient.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Options = Omit<RequestInit, "body"> & {
  /** JSON-serialised unless it's FormData. */
  body?: unknown;
  /** Attach the bearer token (default true). Set false for public endpoints. */
  auth?: boolean;
};

/** Pull a human-readable message out of a FastAPI error body. */
function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object" && "msg" in detail[0]) {
      return String((detail[0] as { msg: unknown }).msg);
    }
  }
  return fallback;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const bodyToSend =
    body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body);

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { ...(headers as Record<string, string> | undefined) };
    if (body !== undefined && !isForm) h["Content-Type"] = "application/json";
    if (auth) Object.assign(h, authHeader());
    return h;
  }

  async function send(): Promise<Response> {
    return fetch(`${API_BASE}${path}`, { ...rest, headers: buildHeaders(), body: bodyToSend });
  }

  let res = await send();

  // A 401 most often means the access token just expired. Refresh once
  // (single-flight inside authClient) and retry. A second 401 propagates
  // so the caller / AuthGuard land the user back on /auth.
  if (res.status === 401 && auth) {
    const refreshed = await authClient.refresh();
    if (refreshed) res = await send();
  }

  if (res.status === 401) {
    // Hard force-logout: token expired AND refresh failed (or was
    // never possible because there was no auth on this call). Clear
    // the session client-side so React Query / AuthGuard see the
    // signed-out state, then hard-redirect to /auth from wherever
    // the user is. Mobile auth never reaches this branch (10y
    // tokens + permanent refresh); web policy is rotation-driven
    // and we *want* to nudge the user back through sign-in cleanly.
    if (auth) {
      try {
        await authClient.signOut();
      } catch {
        /* swallow — local clear-out already happened in refresh() */
      }
      // Stash the post-auth destination so the user lands back where
      // they were after re-signing-in. Same key AuthCallback reads.
      try {
        const here = window.location.pathname + window.location.search;
        if (here && here !== "/auth") {
          sessionStorage.setItem("post_auth_redirect", here);
        }
      } catch {
        /* sessionStorage can be unavailable in private modes */
      }
      window.location.assign("/auth");
    }
    throw new ApiError(401, "Not authenticated", null);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(data, res.statusText), data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Options) => apiFetch<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Options) =>
    apiFetch<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: Options) =>
    apiFetch<T>(path, { ...opts, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, opts?: Options) =>
    apiFetch<T>(path, { ...opts, method: "PUT", body }),
  delete: <T>(path: string, opts?: Options) => apiFetch<T>(path, { ...opts, method: "DELETE" }),
};
