/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the deployed FastAPI backend, no trailing slash (e.g. https://backend-…up.railway.app). */
  readonly VITE_API_BASE_URL?: string;
  /** Supabase project URL — same project the backend validates JWTs against. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Optional LiveKit ws URL fallback; normally the backend returns it with the token. */
  readonly VITE_LIVEKIT_URL?: string;
  /** Numeric App Store id for the iOS Smart App Banner on invite/lobby pages.
   *  Unset until the app is live in the store — the banner renders nothing. */
  readonly VITE_APPSTORE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
