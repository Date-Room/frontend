/**
 * Mirror of mobile's `room_theme.dart`. Slugs MUST match — they're
 * stored on the backend's `theme_color` / `background_id` columns,
 * shared across platforms. Adding new entries: append only.
 */

export type RoomThemePalette = {
  id: string;
  label: string;
  /** "Hero" accent — drives the activity-tray highlight, primary buttons, etc. */
  accent: string;
  /** Soft halo used behind avatars and on tile gradients. */
  halo: string;
};

/** Theme palette. Darker, warm-but-quiet accents that hold up
 *  against the near-black room background. */
export const roomThemes: RoomThemePalette[] = [
  { id: "amber",    label: "Amber",    accent: "#E6A852", halo: "rgba(230,168,82,0.20)" },
  { id: "rose",     label: "Rose",     accent: "#D46A7E", halo: "rgba(212,106,126,0.20)" },
  { id: "sage",     label: "Sage",     accent: "#6FA887", halo: "rgba(111,168,135,0.20)" },
  { id: "plum",     label: "Plum",     accent: "#9B6FAA", halo: "rgba(155,111,170,0.20)" },
  { id: "azure",    label: "Azure",    accent: "#5F8FC4", halo: "rgba(95,143,196,0.20)" },
  { id: "ember",    label: "Ember",    accent: "#C65A3F", halo: "rgba(198,90,63,0.20)" },
  { id: "oak",      label: "Oak",      accent: "#B08660", halo: "rgba(176,134,96,0.20)" },
  { id: "forest",   label: "Forest",   accent: "#4F806D", halo: "rgba(79,128,109,0.20)" },
  { id: "midnight", label: "Midnight", accent: "#6D7DA8", halo: "rgba(109,125,168,0.20)" },
  { id: "wine",     label: "Wine",     accent: "#8C4350", halo: "rgba(140,67,80,0.20)" },
];

export const defaultTheme: RoomThemePalette = roomThemes[0];

export function themeForId(id: string | null | undefined): RoomThemePalette {
  if (!id) return defaultTheme;
  return roomThemes.find((t) => t.id === id) ?? defaultTheme;
}

export type RoomBackgroundPreset = {
  id: string;
  label: string;
  stops: [string, string];
  /** CSS linear-gradient angle (deg). 135 = topLeft → bottomRight. */
  angle?: number;
};

/** Curated background presets. Darker, candle-lit tones. */
export const roomBackgrounds: RoomBackgroundPreset[] = [
  { id: "gradient-dusk",     label: "Dusk",     stops: ["#1E2A48", "#6B3A52"] },
  { id: "gradient-noir",     label: "Noir",     stops: ["#0E0E10", "#2A2530"] },
  { id: "gradient-velvet",   label: "Velvet",   stops: ["#1A0E14", "#4D1F2C"] },
  { id: "gradient-mint",     label: "Mint",     stops: ["#13302C", "#3B6957"] },
  { id: "gradient-ember",    label: "Ember",    stops: ["#2C140C", "#8C3F1C"] },
  { id: "gradient-twilight", label: "Twilight", stops: ["#0F1424", "#35395C"] },
  { id: "gradient-cocoa",    label: "Cocoa",    stops: ["#1F1410", "#4A2E22"] },
  { id: "gradient-forest",   label: "Forest",   stops: ["#0E1C16", "#2B4838"] },
];

export function backgroundForId(id: string | null | undefined): RoomBackgroundPreset | null {
  if (!id) return null;
  return roomBackgrounds.find((b) => b.id === id) ?? null;
}

/** CSS linear-gradient string for a preset, or the default room
 *  gradient when given null. The default mirrors mobile's 'Original'
 *  preview — dark amber-tinted gradient, NEVER transparent. */
export function backgroundGradient(id: string | null | undefined): string {
  const bg = backgroundForId(id);
  const angle = bg?.angle ?? 135;
  if (bg) {
    return `linear-gradient(${angle}deg, ${bg.stops[0]}, ${bg.stops[1]})`;
  }
  // Default DateRoom gradient — same warm dark slate the app shell uses.
  return `linear-gradient(${angle}deg, #2A1F18, #1A1410)`;
}
