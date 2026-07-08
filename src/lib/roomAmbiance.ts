import {
  isAmbiancePresetId,
  PLAIN_MOOD,
  resolveAmbiancePreset,
  type AmbiancePresetId,
  type LobbyMood,
} from "@/lib/ambiance";
import { LOBBY_PREVIEW_SCENES } from "@/lib/lobbyPreviewScenes";

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

/** Resolves to a room mood. A room defaults to **no background** (plain) when
 *  nothing is set — only an explicit ambiance preset lights one up. Legacy /
 *  unknown slugs also fall back to plain. */
export function resolveMoodFromBackgroundId(
  id: string | null | undefined,
): LobbyMood {
  if (id === PLAIN_MOOD) return PLAIN_MOOD;
  return ambianceFromBackgroundId(id) ?? PLAIN_MOOD;
}

/** CSS-var overrides that tint the room's `--room-accent` to match the chosen
 *  background's signature colour. Returns `{}` for plain (no background), so
 *  the room keeps its theme/brand accent. Spread after `roomAccentStyle`. */
export function ambianceAccentStyle(mood: LobbyMood): Record<string, string> {
  if (mood === PLAIN_MOOD) return {};
  const [r, g, b] = LOBBY_PREVIEW_SCENES[resolveAmbiancePreset(mood)].accentRgb;
  return {
    "--room-accent": `rgb(${r}, ${g}, ${b})`,
    "--room-accent-soft": `rgba(${r}, ${g}, ${b}, 0.14)`,
  };
}
