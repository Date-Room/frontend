import { cn } from "@/lib/utils";
import type { AmbiancePresetId } from "@/lib/ambiance";
import { resolveAmbiancePreset } from "@/lib/ambiance";
import { LOBBY_PREVIEW_SCENES } from "@/lib/lobbyPreviewScenes";

type AmbientSceneStackProps = {
  /** Room mood from `room_state.ambiance_preset` or create-flow selection */
  ambiance?: AmbiancePresetId | null;
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
  const preset = resolveAmbiancePreset(ambiance);
  const scene = LOBBY_PREVIEW_SCENES[preset];
  const [r, g, b] = scene.centerRgb;
  const vo = scene.centerVignetteOpacity;

  return (
    <div className={cn("pointer-events-none relative overflow-hidden", positionClassName)} aria-hidden>
      <img
        key={scene.src}
        src={scene.src}
        alt=""
        aria-hidden
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
          kenBurns && "animate-ken-burns motion-reduce:animate-none",
          imgClassName,
        )}
        style={{ objectPosition: scene.objectPosition }}
        referrerPolicy="strict-origin-when-cross-origin"
        decoding="async"
        loading={loading}
      />
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
    </div>
  );
}
