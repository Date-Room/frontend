/**
 * Typed fetch wrapper for the deployed FastAPI backend (`/v1/…`).
 *
 * - Base URL comes from VITE_API_BASE_URL (the Railway origin, no trailing slash).
 *   Callers pass the full path including `/v1`, e.g. `api.post("/v1/rooms", …)`.
 *   Non-`/v1` routes (`/i/{code}`, `/auth/callback`) also live under this origin.
 * - Attaches the Supabase access token as `Authorization: Bearer …` by default.
 * - A 401 means the token was rejected/expired → we sign out so the app re-auths.
 */
import { supabase } from "@/lib/supabaseClient";

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

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
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
  const h: Record<string, string> = { ...(headers as Record<string, string> | undefined) };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) h["Content-Type"] = "application/json";
  if (auth) Object.assign(h, await authHeader());

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: h,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  // A 401 means this request's token was rejected — surface it to the caller.
  // We deliberately do NOT sign the user out here: a transient backend 401
  // (e.g. a JWKS hiccup) must not nuke a valid session and bounce the app.
  if (res.status === 401) {
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
