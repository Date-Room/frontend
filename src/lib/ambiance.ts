/** Visual moods for the date room — keys map to `[data-live-ambiance]` in `index.css`. */
export const AMBIANCE_PRESETS = [
  { id: "candlelit", label: "Candlelit", hint: "Warm candlelit glow", emoji: "🕯️" },
  { id: "moonlit", label: "Moonlit", hint: "Cool silver & sapphire night", emoji: "🌙" },
  { id: "golden", label: "Golden hour", hint: "Honey alpine sunset", emoji: "🌇" },
  { id: "ocean", label: "Ocean hush", hint: "Deep teal & quiet tides", emoji: "🌊" },
  { id: "secret", label: "Secret lounge", hint: "Velvet club & violet glow", emoji: "🍸" },
  { id: "aurora", label: "Aurora veil", hint: "Emerald & violet sky", emoji: "🌌" },
  { id: "ember", label: "Hearth glow", hint: "Firelight & ember coals", emoji: "🔥" },
  { id: "blush", label: "Blush dusk", hint: "Rose cloud twilight", emoji: "💗" },
] as const;

export type AmbiancePresetId = (typeof AMBIANCE_PRESETS)[number]["id"];

const PRESET_IDS = new Set<string>(AMBIANCE_PRESETS.map((p) => p.id));

export function isAmbiancePresetId(value: unknown): value is AmbiancePresetId {
  return typeof value === "string" && PRESET_IDS.has(value);
}

export function resolveAmbiancePreset(value: unknown): AmbiancePresetId {
  return isAmbiancePresetId(value) ? value : "candlelit";
}

export function ambianceMeta(id: AmbiancePresetId): (typeof AMBIANCE_PRESETS)[number] {
  return AMBIANCE_PRESETS.find((p) => p.id === id) ?? AMBIANCE_PRESETS[0];
}
