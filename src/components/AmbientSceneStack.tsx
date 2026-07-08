import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LobbyMood } from "@/lib/ambiance";
import { PLAIN_MOOD, resolveAmbiancePreset } from "@/lib/ambiance";
import { LOBBY_PREVIEW_SCENES } from "@/lib/lobbyPreviewScenes";

/** Faded-in resting opacity for the photo — kept low so the scene reads as a
 *  soft wash behind the room chrome rather than busy foreground art. */
const SCENE_OPACITY = 0.55;

type AmbientSceneStackProps = {
  /** Room mood from create-flow selection or persisted background_id */
  ambiance?: LobbyMood | null;
  /** Wrapper positioning — e.g. `fixed inset-0 z-[1]` (full viewport) or `absolute inset-0` (nested frame) */
  positionClassName: string;
  /** Passed through to `<img>` (e.g. animation variants) */
  imgClassName?: string;
  /** Subtle ken-burns on photography; respects `motion-reduce` */
  kenBurns?: boolean;
  loading?: "eager" | "lazy";
};

/**
 * Mood-matched photography + grade from `lobbyPreviewScenes` — shared by the create-room
 * preview widget and live lobby / date room backgrounds.
 */
export function AmbientSceneStack({
  ambiance,
  positionClassName,
  imgClassName,
  kenBurns = true,
  loading = "eager",
}: AmbientSceneStackProps) {
  // Plain mood: no photography — a quiet, neutral gradient so the room reads
  // clean/default rather than themed.
  if (ambiance === PLAIN_MOOD) {
    return (
      <div className={cn("pointer-events-none overflow-hidden", positionClassName)} aria-hidden>
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/30" />
      </div>
    );
  }

  const preset = resolveAmbiancePreset(ambiance);
  const scene = LOBBY_PREVIEW_SCENES[preset];
  const [r, g, b] = scene.centerRgb;
  const vo = scene.centerVignetteOpacity;

  return (
    <SceneLayer
      key={preset}
      scene={scene}
      positionClassName={positionClassName}
      imgClassName={imgClassName}
      kenBurns={kenBurns}
      loading={loading}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 98% 74% at 50% 46%, rgba(${r},${g},${b},${vo}) 0%, rgba(${r},${g},${b},${vo * 0.48}) 46%, transparent 72%)`,
        }}
      />
      <div
        className={cn("absolute inset-0 bg-gradient-to-t", scene.washT, scene.washVia, scene.washB)}
      />
      {scene.accentL ? <div className={cn("absolute inset-0", scene.accentL)} /> : null}
      {scene.accentR ? <div className={cn("absolute inset-0", scene.accentR)} /> : null}
    </SceneLayer>
  );
}

/** Renders the photo + grade layers, fading the image in on load (and on every
 *  scene change, since the parent keys this by preset). */
function SceneLayer({
  scene,
  positionClassName,
  imgClassName,
  kenBurns,
  loading,
  children,
}: {
  scene: (typeof LOBBY_PREVIEW_SCENES)[keyof typeof LOBBY_PREVIEW_SCENES];
  positionClassName: string;
  imgClassName?: string;
  kenBurns: boolean;
  loading: "eager" | "lazy";
  children: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  // Reset when the source changes so a swapped scene fades in cleanly.
  useEffect(() => setLoaded(false), [scene.src]);

  return (
    <div className={cn("pointer-events-none relative overflow-hidden", positionClassName)} aria-hidden>
      <img
        src={scene.src}
        alt=""
        aria-hidden
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ease-out",
          kenBurns && "animate-ken-burns motion-reduce:animate-none",
          imgClassName,
        )}
        style={{ objectPosition: scene.objectPosition, opacity: loaded ? SCENE_OPACITY : 0 }}
        referrerPolicy="strict-origin-when-cross-origin"
        decoding="async"
        loading={loading}
        onLoad={() => setLoaded(true)}
      />
      {children}
    </div>
  );
}
