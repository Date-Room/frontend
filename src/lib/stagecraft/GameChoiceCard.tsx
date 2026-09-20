import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getChoiceTheme } from "@/lib/stagecraft/gameVisuals";

export type ChoiceBadge = {
  text: string;
  tone: "you" | "call" | "partner" | "cut" | "read" | "survives" | "neutral";
};

export type GameChoiceCardProps = {
  label: string;
  emoji: string;
  disabled?: boolean;
  onClick?: () => void;
  size?: "lg" | "md";
  /** Visual state during pick / reveal flows */
  state?:
    | "default"
    | "mine"
    | "theirs"
    | "lit"
    | "faded"
    | "swell"
    | "tug-l"
    | "tug-r"
    | "sealed"
    | "survivor";
  badges?: ChoiceBadge[];
  overlay?: ReactNode;
  className?: string;
};

const BADGE_CLASS: Record<ChoiceBadge["tone"], string> = {
  you: "border-primary/60 text-primary",
  call: "border-rose/50 border-dashed text-rose",
  partner: "border-rose/60 text-rose",
  cut: "border-primary/60 text-primary",
  read: "border-rose/60 border-dashed text-rose",
  survives: "border-emerald-400/60 text-emerald-300",
  neutral: "border-white/20 text-cream/70",
};

export function GameChoiceCard({
  label,
  emoji,
  disabled,
  onClick,
  size = "lg",
  state = "default",
  badges = [],
  overlay,
  className,
}: GameChoiceCardProps) {
  const theme = getChoiceTheme(label);
  const clickable = !disabled && Boolean(onClick);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "dr-choice-card focus-ring group relative flex flex-col items-center justify-end overflow-hidden rounded-2xl border p-0 text-center",
        size === "lg" ? "min-h-[11rem] flex-1" : "min-h-[8rem]",
        state === "swell" && "dr-choice-card--swell",
        state === "tug-l" && "dr-choice-card--tug-l",
        state === "tug-r" && "dr-choice-card--tug-r",
        state === "lit" && "dr-choice-card--lit",
        state === "faded" && "dr-choice-card--faded",
        state === "mine" && "dr-choice-card--mine",
        state === "theirs" && "dr-choice-card--theirs",
        state === "sealed" && "dr-choice-card--sealed",
        state === "survivor" && "dr-choice-card--survivor",
        clickable ? "dr-choice-card--clickable cursor-pointer" : "cursor-default",
        className,
      )}
      style={{ ["--choice-glow" as string]: theme.glow }}
    >
      <span className="dr-choice-card__bg" style={{ background: theme.gradient }} aria-hidden />
      <span className="dr-choice-card__grain" aria-hidden />
      <span className="dr-choice-card__emoji" aria-hidden>
        {emoji}
      </span>
      <span className="dr-choice-card__body">
        <span className="text-title italic leading-tight text-cream">{label}</span>
        {badges.length > 0 && (
          <span className="mt-2 flex min-h-[1.3rem] flex-wrap justify-center gap-1.5">
            {badges.map((b) => (
              <span
                key={b.text}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-label uppercase tracking-[0.18em]",
                  BADGE_CLASS[b.tone],
                )}
              >
                {b.text}
              </span>
            ))}
          </span>
        )}
      </span>
      {overlay}
    </button>
  );
}
