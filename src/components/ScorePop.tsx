/**
 * A score that lands, instead of one that is simply different.
 *
 * The league refetches after a reveal, so a point used to arrive as a
 * changed number the next time you looked — the one moment in a game
 * that should feel like something, and it read like a table update.
 *
 * Restrained on purpose. The number ticks, and a point of *mine* gets
 * a few sparks behind it. Someone else's point ticks without them:
 * their win is information to me, not a celebration of mine. Nothing
 * covers the screen, nothing lands with a bang — these are grown-ups
 * in a lit room.
 *
 * Geometry and easing live in `lib/scorePop.ts` so they are tested and
 * shared with mobile's `widgets/score_pop.dart`.
 */
import { useEffect, useRef, useState } from "react";
import { SPARK_MS, SPARKS, TICK_MS, sparksFor, tickValue } from "@/lib/scorePop";
import { cn } from "@/lib/utils";

export function ScorePop({
  value,
  mine = false,
  className,
}: {
  value: number;
  /** Mine gets the sparks. Everyone else's just ticks. */
  mine?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  // Null until the first paint has happened: a score that is simply
  // *there* when the panel opens has not just been scored, and ticking
  // it up from zero would announce points won an hour ago.
  const seen = useRef<number | null>(null);
  // Bumped on each gain; keys the burst so a second point restarts the
  // animation instead of joining a finished one.
  const [burst, setBurst] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const from = seen.current;
    seen.current = value;
    if (from === null || from === value) {
      setShown(value);
      return;
    }
    if (value > from) setBurst((b) => b + 1);

    // The OS setting is honoured by skipping the tick outright, not by
    // running it faster: "reduce motion" means none of this.
    const still =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      setShown(value);
      return;
    }

    const started = performance.now();
    const run = () => {
      const t = (performance.now() - started) / TICK_MS;
      setShown(tickValue(from, value, t));
      if (t < 1) frame.current = requestAnimationFrame(run);
    };
    frame.current = requestAnimationFrame(run);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value]);

  const sparks = mine && burst > 0 ? sparksFor(burst) : [];

  return (
    <span className={cn("relative inline-flex items-center justify-center tabular-nums", className)}>
      {/* The sparks sit behind the number and take no pointer events, so
          a burst can never swallow a tap on the row it decorates. */}
      {sparks.length > 0 && (
        <span key={burst} className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden>
          {sparks.map((s, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 rounded-[1px] bg-primary"
              style={{
                width: s.size,
                height: s.size,
                animation: `dr-spark ${SPARK_MS}ms ease-out ${Math.round(s.delay * SPARK_MS)}ms both`,
                ["--dr-spark-x" as string]: `${(Math.sin((s.angle * Math.PI) / 180) * s.distance).toFixed(1)}px`,
                ["--dr-spark-y" as string]: `${(-Math.cos((s.angle * Math.PI) / 180) * s.distance).toFixed(1)}px`,
              }}
            />
          ))}
        </span>
      )}
      <span
        key={`n${burst}`}
        className={cn("relative", burst > 0 && mine && "animate-in zoom-in-75 duration-300")}
      >
        {shown}
      </span>
      {/* The tick is decorative; a screen reader gets the settled number
          once, not every frame of the count. */}
      <span className="sr-only" aria-live="polite">
        {value}
      </span>
    </span>
  );
}
