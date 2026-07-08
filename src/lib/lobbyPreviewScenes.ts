import type { AmbiancePresetId } from "@/lib/ambiance";

/**
 * Full-bleed lobby preview art per mood — Unsplash photography (subject + palette matched to vibe).
 * License: https://unsplash.com/license — acceptable for URLs + attribution in product docs/marketing footer.
 *
 * Swap `src` to self-hosted `/public/` assets anytime; keep `AmbiancePresetId` keys aligned with ambiance.ts + index.css.
 */
export type LobbyPreviewScene = {
  src: string;
  /** Focal point for object-position (avoid busy centers when possible) */
  objectPosition: string;
  /** Bottom-to-top wash (Tailwind arbitrary) for legibility */
  washT: string;
  washVia: string;
  washB: string;
  /** Optional extra cool/warm radial accent */
  accentL?: string;
  accentR?: string;
  /** Soft center dim (helps hide busy mid-frame) */
  centerVignetteOpacity: number;
  /** Base RGB for radial center dim (mood-tinted shadow) */
  centerRgb: readonly [number, number, number];
  /** Signature colour pulled from the scene — drives the room's accent /
   *  colour scheme so UI chrome matches the chosen background. */
  accentRgb: readonly [number, number, number];
};

const Q = "auto=format&fit=crop&w=1800&q=88";

/** Curated IDs — compositions chosen for portrait phone framing + mood fidelity. */
export const LOBBY_PREVIEW_SCENES: Record<AmbiancePresetId, LobbyPreviewScene> = {
  candlelit: {
    src: `/lobby-mood-candlelit.png`,
    objectPosition: "50% 52%",
    washT: "from-[#0a0305]/96",
    washVia: "via-[#14080c]/70",
    washB: "to-[#1c0c08]/38",
    accentL: "bg-[radial-gradient(ellipse_58%_50%_at_42%_35%,rgba(255,165,92,0.24)_0%,transparent_60%)]",
    accentR: "bg-[radial-gradient(ellipse_48%_40%_at_82%_70%,rgba(255,215,165,0.1)_0%,transparent_55%)]",
    centerVignetteOpacity: 0.42,
    centerRgb: [12, 5, 8],
    accentRgb: [255, 165, 92],
  },
  moonlit: {
    src: `https://images.unsplash.com/photo-1519681393784-d120267933ba?${Q}`,
    objectPosition: "50% 45%",
    washT: "from-[#040610]/97",
    washVia: "via-[#060d22]/78",
    washB: "to-[#101838]/52",
    accentL: "bg-[radial-gradient(ellipse_52%_48%_at_76%_18%,rgba(140,155,235,0.18)_0%,transparent_58%)]",
    accentR: "bg-[radial-gradient(ellipse_46%_40%_at_22%_75%,rgba(70,105,165,0.12)_0%,transparent_55%)]",
    centerVignetteOpacity: 0.4,
    centerRgb: [6, 8, 26],
    accentRgb: [140, 155, 235],
  },
  golden: {
    src: `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?${Q}`,
    objectPosition: "50% 35%",
    washT: "from-[#100804]/94",
    washVia: "via-[#261208]/72",
    washB: "to-[#3a2410]/42",
    accentL: "bg-[radial-gradient(ellipse_62%_55%_at_42%_30%,rgba(255,205,118,0.28)_0%,transparent_60%)]",
    accentR: "bg-[radial-gradient(ellipse_44%_36%_at_82%_55%,rgba(255,158,74,0.14)_0%,transparent_52%)]",
    centerVignetteOpacity: 0.34,
    centerRgb: [22, 10, 5],
    accentRgb: [255, 205, 118],
  },
  ocean: {
    src: `https://images.unsplash.com/photo-1505118380757-91f5f5632de0?${Q}`,
    objectPosition: "50% 40%",
    washT: "from-[#010c12]/96",
    washVia: "via-[#052028]/74",
    washB: "to-[#063238]/46",
    accentL: "bg-[radial-gradient(ellipse_48%_44%_at_68%_32%,rgba(90,215,228,0.14)_0%,transparent_58%)]",
    accentR: "bg-[radial-gradient(ellipse_52%_42%_at_28%_70%,rgba(40,145,178,0.12)_0%,transparent_55%)]",
    centerVignetteOpacity: 0.45,
    centerRgb: [2, 16, 24],
    accentRgb: [90, 215, 228],
  },
  secret: {
    src: `https://images.unsplash.com/photo-1572116469696-31de0f17cc34?${Q}`,
    objectPosition: "50% 62%",
    washT: "from-[#08030a]/96",
    washVia: "via-[#140a18]/74",
    washB: "to-[#1c0824]/42",
    accentL: "bg-[radial-gradient(ellipse_55%_45%_at_72%_18%,rgba(220,165,245,0.16)_0%,transparent_55%)]",
    accentR: "bg-[radial-gradient(ellipse_48%_40%_at_28%_70%,rgba(255,205,148,0.1)_0%,transparent_52%)]",
    centerVignetteOpacity: 0.46,
    centerRgb: [12, 4, 18],
    accentRgb: [220, 165, 245],
  },
  aurora: {
    src: `https://images.unsplash.com/photo-1531366936337-7c912a4589a7?${Q}`,
    objectPosition: "50% 32%",
    washT: "from-[#020810]/94",
    washVia: "via-[#081220]/72",
    washB: "to-[#0c1830]/46",
    accentL: "bg-[radial-gradient(ellipse_58%_50%_at_72%_24%,rgba(120,238,206,0.22)_0%,transparent_56%)]",
    accentR: "bg-[radial-gradient(ellipse_50%_42%_at_26%_70%,rgba(186,148,248,0.16)_0%,transparent_54%)]",
    centerVignetteOpacity: 0.38,
    centerRgb: [4, 12, 24],
    accentRgb: [120, 238, 206],
  },
  ember: {
    src: `https://images.unsplash.com/photo-1672698163035-ed62e6c191f9?${Q}`,
    objectPosition: "50% 55%",
    washT: "from-[#0a0404]/94",
    washVia: "via-[#140808]/74",
    washB: "to-[#1a0a04]/40",
    accentL: "bg-[radial-gradient(ellipse_70%_60%_at_52%_88%,rgba(255,138,72,0.38)_0%,transparent_62%)]",
    accentR: "bg-[radial-gradient(ellipse_44%_36%_at_82%_32%,rgba(255,206,148,0.12)_0%,transparent_50%)]",
    centerVignetteOpacity: 0.44,
    centerRgb: [18, 6, 4],
    accentRgb: [255, 138, 72],
  },
  blush: {
    src: `https://images.unsplash.com/photo-1472214103451-9374bd1c798e?${Q}`,
    objectPosition: "50% 42%",
    washT: "from-[#0c0510]/93",
    washVia: "via-[#14081a]/74",
    washB: "to-[#1c0820]/44",
    accentL: "bg-[radial-gradient(ellipse_56%_48%_at_32%_30%,rgba(255,146,214,0.16)_0%,transparent_56%)]",
    accentR: "bg-[radial-gradient(ellipse_50%_40%_at_76%_60%,rgba(255,208,226,0.12)_0%,transparent_52%)]",
    centerVignetteOpacity: 0.37,
    centerRgb: [14, 4, 16],
    accentRgb: [255, 146, 214],
  },
};
