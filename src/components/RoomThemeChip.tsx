import { Sparkles } from "lucide-react";
import { ambianceMeta, PLAIN_MOOD, type LobbyMood } from "@/lib/ambiance";
import { cn } from "@/lib/utils";

function moodDisplay(mood: LobbyMood): { emoji: string; label: string } {
  if (mood === PLAIN_MOOD) return { emoji: "⬜", label: "Plain" };
  const meta = ambianceMeta(mood);
  return { emoji: meta.emoji, label: meta.label };
}

/** Tap-to-open theme picker — shows the active mood at a glance. */
export function RoomThemeChip({
  current,
  onClick,
  disabled,
  compact,
  className,
}: {
  current: LobbyMood;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const meta = moodDisplay(current);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Room theme: ${meta.label}. Tap to change.`}
      className={cn(
        "dr-theme-chip inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/35 bg-primary/10 text-left transition hover:border-primary/55 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
        compact ? "px-2.5 py-1" : "px-3 py-1.5",
        className,
      )}
    >
      <span className={cn("leading-none", compact ? "text-body" : "text-body")} aria-hidden>
        {meta.emoji}
      </span>
      <span className="min-w-0">
        <span className="block text-label font-bold uppercase tracking-[0.16em] text-primary/85">
          Theme
        </span>
        {!compact && (
          <span className="block max-w-[7rem] truncate text-label font-semibold text-cream sm:max-w-[9rem]">
            {meta.label}
          </span>
        )}
      </span>
      <Sparkles className={cn("shrink-0 text-primary", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
    </button>
  );
}
