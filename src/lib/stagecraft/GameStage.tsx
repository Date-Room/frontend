import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getGameHero } from "@/lib/stagecraft/gameVisuals";

/** Stage wrapper with optional ambient hero art and dimming overlay. */
export function GameStage({
  gameId,
  dimmed,
  className,
  children,
}: {
  gameId?: string;
  dimmed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const hero = gameId ? getGameHero(gameId) : undefined;
  return (
    <div
      className={cn(
        "dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in",
        hero && "dr-stageroom--themed",
        dimmed && "dr-stageroom--dim",
        className,
      )}
      style={hero ? ({ ["--game-hero" as string]: `url(${hero})` } as CSSProperties) : undefined}
    >
      <div className="dr-stageroom-shade" aria-hidden />
      {children}
    </div>
  );
}
