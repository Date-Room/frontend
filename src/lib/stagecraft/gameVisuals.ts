/** Hero art + choice atmospheres for in-game UI (dock tiles reused as mood backdrops). */

export const GAME_HERO_IMAGES: Record<string, string> = {
  this_or_that: "/dock-tiles/this-or-that-hero.webp",
  "2_truths": "/dock-tiles/2-truths-hero.webp",
  truth_or_dare: "/dock-tiles/truth-or-dare-hero.webp",
  one_has_to_go: "/dock-tiles/one-has-to-go-hero.webp",
  pick_a_door: "/dock-tiles/pick-a-door-hero.webp",
  rank_it: "/dock-tiles/rank-it-hero.webp",
  guacamole: "/dock-tiles/guacamole-hero.webp",
  questions: "/dock-tiles/questions-hero.webp",
  the_36: "/dock-tiles/the-36-hero.webp",
};

export type ChoiceTheme = {
  gradient: string;
  glow: string;
};

const LABEL_THEMES: Record<string, ChoiceTheme> = {
  mountains: {
    gradient:
      "linear-gradient(165deg, rgba(15,23,42,0.92) 0%, rgba(30,58,95,0.75) 40%, rgba(71,85,105,0.55) 100%), radial-gradient(120% 80% at 20% 15%, rgba(148,163,184,0.35), transparent 55%)",
    glow: "rgba(148, 163, 184, 0.45)",
  },
  ocean: {
    gradient:
      "linear-gradient(165deg, rgba(8,20,38,0.92) 0%, rgba(12,74,110,0.78) 45%, rgba(14,116,144,0.5) 100%), radial-gradient(90% 70% at 80% 20%, rgba(56,189,248,0.25), transparent 60%)",
    glow: "rgba(56, 189, 248, 0.5)",
  },
  "text back instantly": {
    gradient:
      "linear-gradient(165deg, rgba(30,20,10,0.9) 0%, rgba(180,83,9,0.55) 50%, rgba(251,191,36,0.35) 100%)",
    glow: "rgba(251, 191, 36, 0.45)",
  },
  "take your time": {
    gradient:
      "linear-gradient(165deg, rgba(15,15,35,0.92) 0%, rgba(49,46,129,0.65) 55%, rgba(99,102,241,0.35) 100%)",
    glow: "rgba(129, 140, 248, 0.45)",
  },
  "early mornings": {
    gradient:
      "linear-gradient(165deg, rgba(30,25,15,0.9) 0%, rgba(251,146,60,0.45) 40%, rgba(253,224,71,0.35) 100%)",
    glow: "rgba(253, 224, 71, 0.45)",
  },
  "late nights": {
    gradient:
      "linear-gradient(165deg, rgba(5,8,22,0.95) 0%, rgba(30,27,75,0.8) 50%, rgba(67,56,202,0.4) 100%)",
    glow: "rgba(99, 102, 241, 0.45)",
  },
  "move for love": {
    gradient:
      "linear-gradient(165deg, rgba(20,15,30,0.92) 0%, rgba(190,24,93,0.45) 45%, rgba(244,63,94,0.35) 100%)",
    glow: "rgba(244, 63, 94, 0.45)",
  },
  "stay for roots": {
    gradient:
      "linear-gradient(165deg, rgba(10,18,12,0.92) 0%, rgba(22,101,52,0.55) 50%, rgba(74,222,128,0.25) 100%)",
    glow: "rgba(74, 222, 128, 0.4)",
  },
};

const FALLBACK_THEMES: ChoiceTheme[] = [
  {
    gradient:
      "linear-gradient(165deg, rgba(20,15,28,0.92) 0%, rgba(88,28,135,0.5) 55%, rgba(192,132,252,0.25) 100%)",
    glow: "rgba(192, 132, 252, 0.4)",
  },
  {
    gradient:
      "linear-gradient(165deg, rgba(12,18,28,0.92) 0%, rgba(14,116,144,0.55) 55%, rgba(45,212,191,0.25) 100%)",
    glow: "rgba(45, 212, 191, 0.4)",
  },
  {
    gradient:
      "linear-gradient(165deg, rgba(22,18,12,0.92) 0%, rgba(180,83,9,0.5) 55%, rgba(251,191,36,0.25) 100%)",
    glow: "rgba(251, 191, 36, 0.4)",
  },
  {
    gradient:
      "linear-gradient(165deg, rgba(18,12,20,0.92) 0%, rgba(190,24,93,0.45) 55%, rgba(251,113,133,0.25) 100%)",
    glow: "rgba(251, 113, 133, 0.4)",
  },
  {
    gradient:
      "linear-gradient(165deg, rgba(10,16,24,0.92) 0%, rgba(37,99,235,0.45) 55%, rgba(96,165,250,0.25) 100%)",
    glow: "rgba(96, 165, 250, 0.4)",
  },
];

function hashLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getGameHero(activityId: string): string | undefined {
  return GAME_HERO_IMAGES[activityId];
}

export function getChoiceTheme(label: string): ChoiceTheme {
  const key = label.trim().toLowerCase();
  if (LABEL_THEMES[key]) return LABEL_THEMES[key];
  for (const [k, theme] of Object.entries(LABEL_THEMES)) {
    if (key.includes(k) || k.includes(key)) return theme;
  }
  return FALLBACK_THEMES[hashLabel(label) % FALLBACK_THEMES.length];
}
