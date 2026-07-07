import {
  isAmbiancePresetId,
  resolveAmbiancePreset,
  resolveLobbyMood,
  type AmbiancePresetId,
  type LobbyMood,
} from "@/lib/ambiance";

/** Create-room / lobby moods are stored in `background_id` when the
 *  slug matches an ambiance preset (candlelit, ember, …). Legacy
 *  gradient slugs (gradient-dusk, …) fall back to the default mood. */
export function ambianceFromBackgroundId(id: string | null | undefined): AmbiancePresetId | null {
  return isAmbiancePresetId(id) ? id : null;
}

/** Always resolves to a photo-backed mood — default candlelit when unset
 *  or when `background_id` is a legacy gradient slug. */
export function resolveAmbianceFromBackgroundId(
  id: string | null | undefined,
): AmbiancePresetId {
  return resolveAmbiancePreset(ambianceFromBackgroundId(id));
}

/** Resolves to a room mood, preserving an explicit "plain" (no background)
 *  choice; legacy/unknown slugs fall back to candlelit. */
export function resolveMoodFromBackgroundId(
  id: string | null | undefined,
): LobbyMood {
  return resolveLobbyMood(id);
}
