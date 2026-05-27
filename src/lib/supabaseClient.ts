/**
 * The real Supabase client — auth (magic-link / OAuth) and Realtime.
 *
 * This replaces the hand-rolled shim that used to back the bundled Node server.
 * The same Supabase project must be the one the backend validates JWTs against
 * (SUPABASE_JWT_SECRET on the API). The access token from this client is sent as
 * `Authorization: Bearer …` to the FastAPI `/v1` backend (see `lib/api.ts`).
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** True when both Supabase env vars are present. UI can show a setup hint otherwise. */
export function supabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

if (!supabaseConfigured()) {
  // Don't hard-crash at import — fall back to a harmless placeholder so the app
  // still renders a "configure Supabase" hint instead of a white screen.
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — " +
      "auth and realtime are disabled until configured.",
  );
}

export const supabase = createClient(
  url || "http://localhost:54321",
  anonKey || "public-anon-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);
