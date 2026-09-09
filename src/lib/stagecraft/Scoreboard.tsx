/**
 * Scoreboard — the shared game-show score surface. Two nameplates with big
 * serif numbers; when a value rises, that plate flashes and the number ticks.
 * Each game keeps its own currency (reads, tokens, points): the label names
 * it, and there is deliberately no cross-game aggregate — the currencies
 * mean different things.
 */
import { useEffect, useRef, useState } from "react";

type Entry = { name: string; value: number; accent?: boolean };

function Plate({ entry }: { entry: Entry }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(entry.value);
  useEffect(() => {
    if (entry.value > prev.current) {
      setBump(true);
      const t = window.setTimeout(() => setBump(false), 1400);
      prev.current = entry.value;
      return () => window.clearTimeout(t);
    }
    prev.current = entry.value;
  }, [entry.value]);

  return (
    <div
      className={[
        "dr-score-plate flex min-w-[6.5rem] flex-col items-center gap-0.5 rounded-2xl border px-4 py-2",
        entry.accent ? "border-primary/40 bg-primary/10" : "border-white/[0.10] bg-white/[0.03]",
        bump ? "dr-score-plate--bump" : "",
      ].join(" ")}
    >
      <span className="max-w-[7rem] truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {entry.name}
      </span>
      <span className="font-serif text-2xl leading-none text-cream tabular-nums">{entry.value}</span>
    </div>
  );
}

export function Scoreboard({ label, entries }: { label: string; entries: Entry[] }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{label}</span>
      {entries.map((e) => (
        <Plate key={e.name + (e.accent ? "-you" : "")} entry={e} />
      ))}
    </div>
  );
}
