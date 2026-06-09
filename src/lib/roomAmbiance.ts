import {
  isAmbiancePresetId,
  resolveAmbiancePreset,
  type AmbiancePresetId,
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
