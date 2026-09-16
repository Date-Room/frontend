/**
 * Shared round / title / status header for stagecraft games — keyed titles
 * re-animate when the phase changes.
 */
export function GameStageHeader({
  kicker,
  title,
  status,
  titleKey,
  statusKey,
}: {
  kicker: string;
  title: string;
  status: string;
  titleKey?: string;
  statusKey?: string;
}) {
  return (
    <div className="dr-game-header relative flex shrink-0 flex-col items-center gap-1 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>
      <p key={titleKey ?? title} className="dr-game-header__title font-serif text-xl italic text-cream">
        {title}
      </p>
      <p
        key={statusKey ?? status}
        aria-live="polite"
        className="dr-game-header__status min-h-[1rem] max-w-sm text-xs text-muted-foreground"
      >
        {status}
      </p>
    </div>
  );
}
