import { Circle, Columns2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { setCallMode, useCallMode, type CallMode } from "@/lib/callLayout";

const MODES: { id: CallMode; label: string; icon: LucideIcon }[] = [
  { id: "split", label: "Side by side", icon: Columns2 },
  { id: "bubble", label: "Bubble", icon: Circle },
];

/**
 * Desktop call layout switcher — lives in the room's top bar so it is
 * reachable in every mode and every stage state (a game intro, a dock
 * drill-in and the call pane itself all displace the stage header).
 */
export function CallLayoutSwitcher({ className }: { className?: string }) {
  const mode = useCallMode();
  return (
    <div
      role="radiogroup"
      aria-label="Call layout"
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full border border-white/[0.12] bg-white/[0.04] p-0.5",
        className,
      )}
    >
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={m.label}
            title={m.label}
            onClick={() => setCallMode(m.id)}
            className={cn(
              "focus-ring flex h-6 w-6 items-center justify-center rounded-full transition",
              active ? "bg-primary/25 text-primary" : "text-cream/55 hover:bg-white/[0.06] hover:text-cream",
            )}
          >
            <m.icon className={cn("h-3.5 w-3.5", m.id === "bubble" && "fill-current")} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
