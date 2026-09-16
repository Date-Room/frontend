/**
 * GameLanding — the shared landing screen every game opens on. A name, a
 * one-line promise, how it plays in three beats, and an honest time estimate
 * (rooms have countdowns; couples pick games that fit the time they have).
 * The landing shows while the game state is pristine and disappears for both
 * players the moment either acts.
 */
import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { getGameHero } from "@/lib/stagecraft/gameVisuals";

export function GameLanding({
  gameId,
  title,
  promise,
  minutes,
  beats,
  children,
}: {
  /** Activity id — loads dock-tile hero art when available */
  gameId?: string;
  title: string;
  promise: string;
  /** e.g. "≈ 15 min" or "≈ 45–60 min" */
  minutes: string;
  beats: string[];
  /** The start control(s) — game-specific. */
  children: ReactNode;
}) {
  const hero = gameId ? getGameHero(gameId) : undefined;
  return (
    <div className="dr-game-landing flex h-full min-h-0 flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center animate-fade-in">
      {hero && (
        <div className="dr-game-landing__hero" style={{ backgroundImage: `url(${hero})` }} aria-hidden />
      )}
      <div className="dr-game-landing__content relative flex flex-col items-center gap-2">
        <p className="dr-game-landing__title font-serif text-3xl italic text-cream">{title}</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{promise}</p>
        <p
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em]"
          style={{ color: "var(--room-accent)" }}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden /> {minutes}
        </p>
      </div>
      <div className="dr-game-landing__beats relative flex w-full max-w-sm flex-col gap-2">
        {beats.map((b, i) => (
          <div
            key={i}
            className="dr-game-landing__beat flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-left"
            style={{ animationDelay: `${120 + i * 90}ms` }}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 font-serif text-xs text-cream/80">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-cream/90">{b}</span>
          </div>
        ))}
      </div>
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
