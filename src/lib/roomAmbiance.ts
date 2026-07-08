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

/** RGB (0–255) → HSL, hue in deg, sat/lum in %. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

/** CSS-var overrides that tint the room's palette to match the chosen
 *  background's signature colour — the accent AND `--primary`/`--ring`, so
 *  every control (menu tiles, buttons, rings) follows the background. Returns
 *  `{}` for plain (no background) so the room keeps its brand amber. Spread
 *  after `roomAccentStyle`. */
export function ambianceAccentStyle(mood: LobbyMood): Record<string, string> {
  if (mood === PLAIN_MOOD) return {};
  const [r, g, b] = LOBBY_PREVIEW_SCENES[resolveAmbiancePreset(mood)].accentRgb;
  const [h, s, l] = rgbToHsl(r, g, b);
  // Normalise into a control-friendly band so any scene colour reads as a
  // vivid, legible button/fill (dark text sits on it).
  const S = Math.min(92, Math.max(58, s));
  const L = Math.min(66, Math.max(52, l));
  const primary = `${Math.round(h)} ${Math.round(S)}% ${Math.round(L)}%`;
  return {
    "--primary": primary,
    "--ring": primary,
    "--primary-foreground": "24 30% 10%",
    // Retint the `amber` token too, so activity chrome (which uses amber, not
    // primary) follows the background as well.
    "--amber": primary,
    "--room-accent": `rgb(${r}, ${g}, ${b})`,
    "--room-accent-soft": `rgba(${r}, ${g}, ${b}, 0.14)`,
  };
}
