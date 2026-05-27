/** Stable id for migration / installs that lack a scoped session row. */
export const LEGACY_SHARED_ROOM_ID = "11111111-1111-1111-1111-111111111111";

/** @deprecated Prefer {@link LEGACY_SHARED_ROOM_ID} or {@link useRoomScopeId}. */
export const ROOM_ID = LEGACY_SHARED_ROOM_ID;

/** Session storage key synced from lobby / room URL so scope survives soft reloads after query cleanup. */
export const ROOM_SCOPE_STORAGE_KEY = "date-room-session-scope-id";

const LEGACY_ROOM_SCOPE_STORAGE_KEY = "cozy-date-session-scope-id";

/** LiveKit rooms are shared per scoped date session (UUID-derived name). */
export function liveKitRoomForScope(scopeId: string): string {
  const safe = scopeId.replace(/-/g, "");
  return `dateroom-${safe.slice(0, 48)}`;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLikelyUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/** Persist scope for reloads before React reads the URL segment again. */
export function setStoredRoomScopeId(id: string) {
  try {
    sessionStorage.setItem(ROOM_SCOPE_STORAGE_KEY, id);
    sessionStorage.removeItem(LEGACY_ROOM_SCOPE_STORAGE_KEY);
  } catch {
    /* ignore quota / SSR */
  }
}

export function readStoredRoomScopeId(): string | null {
  try {
    let id = sessionStorage.getItem(ROOM_SCOPE_STORAGE_KEY);
    if (!id) {
      id = sessionStorage.getItem(LEGACY_ROOM_SCOPE_STORAGE_KEY);
      if (id) {
        sessionStorage.setItem(ROOM_SCOPE_STORAGE_KEY, id);
        sessionStorage.removeItem(LEGACY_ROOM_SCOPE_STORAGE_KEY);
      }
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Room route param comes from `/room/:id`. Prefer a real UUID; fall back to
 * session storage (set in lobby); then the legacy singleton.
 */
export function resolveRoomScopeFromRoute(routeSegment: string | undefined): string {
  if (isLikelyUuid(routeSegment)) return routeSegment;
  const stored = readStoredRoomScopeId();
  if (stored && isLikelyUuid(stored)) return stored;
  return LEGACY_SHARED_ROOM_ID;
}

export const DAILY_ROOM_URL =
  (import.meta.env.VITE_DAILY_ROOM_URL as string) ||
  "https://mwaniki.daily.co/datenight";
export const DATE_NAME = "Our Room";

const USER_ID_KEY = "date-room-user-id";
const USER_NAME_KEY = "date-room-user-name";
const DAILY_TOKEN_KEY = "date-room-daily-token";

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function setUserId(id: string) {
  localStorage.setItem(USER_ID_KEY, id);
}

export function getUserName(): string | null {
  return localStorage.getItem(USER_NAME_KEY);
}

export function setUserName(name: string) {
  localStorage.setItem(USER_NAME_KEY, name);
}

export function getDailyToken(): string | null {
  return localStorage.getItem(DAILY_TOKEN_KEY);
}

function decodeDailyToken(): Record<string, unknown> | null {
  const token = getDailyToken();
  const payload = token?.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getInviteSlot(): "a" | "b" | null {
  const payload = decodeDailyToken();
  const properties = payload?.properties as Record<string, unknown> | undefined;
  const isOwner = payload?.is_owner ?? payload?.isOwner ?? payload?.o ?? properties?.is_owner ?? properties?.isOwner;

  if (isOwner === true) return "a";
  if (isOwner === false) return "b";
  return null;
}

export function setDailyToken(token: string) {
  localStorage.setItem(DAILY_TOKEN_KEY, token);
}

export function clearInvite() {
  localStorage.removeItem(DAILY_TOKEN_KEY);
}
