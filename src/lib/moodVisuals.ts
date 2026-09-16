import { AMBIANCE_PRESETS, PLAIN_MOOD, type AmbiancePresetId, type LobbyMood } from "@/lib/ambiance";
import { LOBBY_PREVIEW_SCENES } from "@/lib/lobbyPreviewScenes";

/** CSS gradient swatch for mood cards when images are still loading. */
export function moodSwatchGradient(id: LobbyMood): string {
  if (id === PLAIN_MOOD) {
    return "linear-gradient(145deg, #1a1418 0%, #0e0c10 48%, #080608 100%)";
  }
  const [r, g, b] = LOBBY_PREVIEW_SCENES[id].accentRgb;
  return `radial-gradient(120% 90% at 50% 100%, rgba(${r},${g},${b},0.55) 0%, transparent 58%), linear-gradient(180deg, rgba(8,6,10,0.15) 0%, rgba(8,6,10,0.92) 100%)`;
}

export function moodAccentColor(id: LobbyMood): string {
  if (id === PLAIN_MOOD) return "rgb(232, 166, 83)";
  const [r, g, b] = LOBBY_PREVIEW_SCENES[id as AmbiancePresetId].accentRgb;
  return `rgb(${r}, ${g}, ${b})`;
}

export const MOOD_PICKER_OPTIONS: {
  id: LobbyMood;
  emoji: string;
  label: string;
  hint: string;
  previewSrc?: string;
}[] = [
  ...AMBIANCE_PRESETS.map((p) => ({
    id: p.id as LobbyMood,
    emoji: p.emoji,
    label: p.label,
    hint: p.hint,
    previewSrc: LOBBY_PREVIEW_SCENES[p.id].src,
  })),
  {
    id: PLAIN_MOOD,
    emoji: "⬜",
    label: "Plain",
    hint: "Clean dark room — no photo backdrop",
  },
];
