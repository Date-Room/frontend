/**
 * The in-call chip. Icons only: a shield for Protect, plus a compass when
 * Coach is on. Coloured by health, with a per-family UNREAD badge (cleared
 * when the rail opens; the shield's goes rose while an alert is up). Words
 * only on hover. Tap the shield → the rail filtered to Protect; the compass →
 * Coach; the chip body → everything.
 *
 * While any pipeline stage is unhealthy the chip becomes the four stage dots
 * (agent · hearing you · hearing them · coaching) with a short reason, and a
 * tap opens the status panel with the sentence and the diagnostics. Quiet
 * when healthy, specific when not: four green dots on every good call is
 * noise people learn to ignore, one red dot is a report we can act on.
 */
import { Compass, ShieldCheck } from "lucide-react";
import { Indicator, healthSummary } from "@/components/ChaperonStatusPanel";
import type { AgentStatus, ChaperonStatus } from "@/hooks/useChaperon";
import { cn } from "@/lib/utils";

export type RailFilter = "all" | "protect" | "coach";

const TONE: Record<ChaperonStatus, string> = {
  off: "text-white/40",
  connecting: "text-sky-300",
  watching: "text-emerald-300",
  degraded: "text-amber",
};

function Badge({ n, tone }: { n: number; tone: "protect" | "coach" | "alert" }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
        tone === "alert"
          ? "bg-rose-500 text-white"
          : tone === "protect"
            ? "bg-emerald-400 text-black"
            : "bg-amber text-black",
      )}
    >
      {n}
    </span>
  );
}

export function ChaperonChip({
  status,
  agent,
  coached,
  unread,
  alertOnScreen,
  remoteName,
  onOpenRail,
  onOpenStatus,
}: {
  status: ChaperonStatus;
  agent: AgentStatus;
  coached: boolean;
  unread: { protect: number; coach: number };
  alertOnScreen: boolean;
  remoteName: string;
  onOpenRail: (filter: RailFilter) => void;
  onOpenStatus: () => void;
}) {
  const summary = healthSummary(status, agent, remoteName);
  const title = `${coached ? "Protect + Coach" : "Protect"} · ${
    status === "watching" ? "listening" : status
  }`;

  if (!summary.healthy) {
    return (
      <button
        type="button"
        onClick={onOpenStatus}
        title={title}
        aria-label={`Chaperon: ${summary.sentence}`}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-2.5 py-1.5 backdrop-blur transition hover:bg-black/75"
      >
        <span className="flex items-center gap-1">
          {summary.states.map((st, i) => (
            <Indicator key={i} state={st} />
          ))}
        </span>
        <span className="text-[11px] text-cream/80">{summary.sentence}</span>
      </button>
    );
  }

  const iconBtn =
    "focus-ring relative flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10";
  return (
    <div
      role="group"
      aria-label="Chaperon"
      title={title}
      className={cn(
        "pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/10 bg-black/50 px-1 backdrop-blur",
        TONE[status],
      )}
    >
      <button
        type="button"
        onClick={() => onOpenRail("protect")}
        aria-label={`Protect${unread.protect ? `, ${unread.protect} unread` : ""}`}
        className={iconBtn}
      >
        <ShieldCheck className="h-4 w-4" />
        <Badge n={unread.protect} tone={alertOnScreen ? "alert" : "protect"} />
      </button>
      {coached && (
        <button
          type="button"
          onClick={() => onOpenRail("coach")}
          aria-label={`Coach${unread.coach ? `, ${unread.coach} unread` : ""}`}
          className={iconBtn}
        >
          <Compass className="h-4 w-4" />
          <Badge n={unread.coach} tone="coach" />
        </button>
      )}
    </div>
  );
}
