import { cn } from "@/lib/utils";
import type { AmbiancePresetId } from "@/lib/ambiance";
import { resolveAmbiancePreset, ambianceMeta } from "@/lib/ambiance";
import { AmbientSceneStack } from "@/components/AmbientSceneStack";

/** Decorative countdown for preview only — illustrates lobby layout. */
const DEMO_COUNTDOWN = "46m 18s";

type LobbyGreetingPreviewProps = {
  headline: string;
  subtext: string;
  guestLabel: string;
  /** Same shape as lobby “the date starts …” line; omit when not scheduled */
  scheduledPreview?: string | null;
  /** When the room starts “right now”, copy differs from a scheduled datetime */
  startsNow?: boolean;
  /** Mirrors focused editor field — highlights matching preview block */
  highlightField?: "headline" | "subtext" | null;
  /** Matches live-room mood presets — drives background art + color grade */
  ambiance?: AmbiancePresetId | null;
  className?: string;
};

/**
 * Full-bleed lobby preview: mood-scene backdrops (no playing cards), typography
 * stacked for legibility on cozy date-night photography.
 */
export function LobbyGreetingPreview({
  headline,
  subtext,
  guestLabel,
  scheduledPreview,
  startsNow = false,
  highlightField = null,
  ambiance: ambianceProp,
  className,
}: LobbyGreetingPreviewProps) {
  const h = headline.trim();
  const s = subtext.trim();
  const hasHeadline = h.length > 0;
  const hasSubtext = s.length > 0;

  const ambiance = resolveAmbiancePreset(ambianceProp);

  const focusRing =
    "rounded-xl shadow-[0_0_28px_rgba(212,175,130,0.28)] ring-2 ring-[hsl(35_52%_62%/0.55)]";

  const moodLabel = ambianceMeta(ambiance).label;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-[hsl(35_28%_72%/0.14)] bg-[#100508] shadow-[0_36px_100px_rgba(0,0,0,0.62)] ring-1 ring-[hsl(16_38%_38%/0.22)]",
        className,
      )}
    >
      <div className="relative mx-auto aspect-[9/17] max-h-[min(56vh,500px)] w-full max-w-[300px] sm:aspect-[10/17] sm:max-h-[520px] sm:max-w-[320px]">
        <AmbientSceneStack
          ambiance={ambianceProp}
          positionClassName="absolute inset-0"
          loading="lazy"
        />
        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-7 pt-10 text-center sm:px-6 sm:pb-8 sm:pt-12">
          <div aria-live="polite" className="mx-auto mb-6 flex max-w-[17.5rem] flex-col items-center gap-4 sm:mb-7 sm:max-w-[18rem]">
            <div className={cn("w-full px-1 py-0.5 transition-all duration-200", highlightField === "headline" ? focusRing : "")}>
              <h2
                className={cn(
                  "font-serif text-xl italic leading-snug text-[#faf3e6] transition-colors duration-200 sm:text-[1.35rem]",
                  !hasHeadline && "text-[#faf3e6]/44",
                )}
                style={
                  hasHeadline
                    ? { textShadow: "0 2px 20px rgba(0,0,0,0.88), 0 0 36px rgba(90,28,28,0.35)" }
                    : undefined
                }
              >
                {hasHeadline ? h : "Your headline lands here"}
              </h2>
            </div>

            <div className={cn("w-full px-1 py-0.5 transition-all duration-200", highlightField === "subtext" ? focusRing : "")}>
              <p
                className={cn(
                  "font-serif text-[13px] leading-relaxed text-[#ebe0cf]/90 transition-colors duration-200 sm:text-[14px]",
                  !hasSubtext && "italic text-[#ebe0cf]/48",
                )}
                style={hasSubtext ? { textShadow: "0 2px 14px rgba(0,0,0,0.82)" } : undefined}
              >
                {hasSubtext
                  ? s
                  : hasHeadline
                    ? "Optional detail line — warmth, ritual, or what to pour."
                    : `Add warmth underneath — ${guestLabel} reads this while they wait.`}
              </p>
            </div>
          </div>

          <div className="border-t border-[hsl(35_28%_58%/0.22)] pt-5">
            <p className="mb-3 flex flex-wrap items-center justify-center gap-x-2 font-serif italic text-[11px] leading-snug text-[#ecd9bc]/92 sm:text-[12px]">
              <span>Room opens in</span>
              <span
                className="font-sans text-[9px] font-normal not-italic tracking-[0.42em] text-[hsl(28_48%_58%/0.68)] sm:text-[10px]"
                aria-hidden
              >
                ······
              </span>
            </p>
            <p
              className="font-serif text-[2.35rem] tabular-nums leading-none tracking-tight text-[#fff8eb] sm:text-[2.75rem]"
              style={{ textShadow: "0 4px 26px rgba(0,0,0,0.88), 0 0 32px rgba(160,72,52,0.28)" }}
              aria-hidden
            >
              {DEMO_COUNTDOWN}
            </p>
            <p className="mt-3 font-sans text-[9px] uppercase tracking-[0.22em] text-[#b9a794]/48">
              Illustrative timer
            </p>
            {scheduledPreview ? (
              <p className="mt-2 font-serif text-xs italic leading-snug text-[#dccfb8]/72 sm:text-sm">
                the date starts {scheduledPreview}
              </p>
            ) : startsNow ? (
              <p className="mt-2 font-serif text-xs italic leading-snug text-[#dccfb8]/72 sm:text-sm">
                Their countdown appears here as soon as they open this lobby.
              </p>
            ) : (
              <p className="mt-2 font-serif text-xs italic leading-snug text-[#a89482]/62 sm:text-sm">
                Schedule a start time on the previous step to preview the date line here.
              </p>
            )}
          </div>

          <p className="mx-auto mt-6 max-w-[15.5rem] font-serif text-[11px] italic leading-relaxed text-[#a89482]/72 sm:mt-7 sm:text-xs">
            The room unlocks early if your host arrives ahead of time. You&apos;ll be let in automatically.
          </p>
        </div>
      </div>

      <p className="border-t border-[hsl(35_22%_32%/0.28)] bg-[#0a0305]/92 px-4 py-3.5 text-center text-[10px] uppercase tracking-[0.26em] text-[#9e8e82]/95">
        Live preview · {guestLabel}&apos;s lobby · {moodLabel}
      </p>
    </div>
  );
}
