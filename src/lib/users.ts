/**
 * Current-user profile via the backend `/v1/users/me`.
 *
 * Canonical profile fields (display name, photo, country, age) live
 * on the backend. Client-only preferences (theme prefs) sit in
 * localStorage now that Supabase auth has been decommissioned.
 */
import { api } from "@/lib/api";

export type UserMe = {
  id: string;
  email: string;
  display_name: string;
  photo_url: string | null;
  country: string | null;
  age_verified: boolean;
  created_at: string;
};

export type UserUpdate = {
  display_name?: string;
  photo_url?: string | null;
  country?: string | null;
  date_of_birth?: string | null;
};

export function getMe(): Promise<UserMe> {
  return api.get<UserMe>("/v1/users/me");
}

export function updateMe(patch: UserUpdate): Promise<UserMe> {
  return api.patch<UserMe>("/v1/users/me", patch);
}
