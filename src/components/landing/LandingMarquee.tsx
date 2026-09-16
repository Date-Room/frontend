import type { ReactNode } from "react";

/** Infinite marquee — Originkit-style trust / feature strip. */
export function LandingMarquee({ items }: { items: ReactNode[] }) {
  const track = [...items, ...items];
  return (
    <div className="lp-marquee relative overflow-hidden border-y border-lpborder/40 bg-[oklch(0.13_0.012_42)] py-4">
      <div className="lp-marquee__fade-left" aria-hidden />
      <div className="lp-marquee__fade-right" aria-hidden />
      <div className="lp-marquee__track flex w-max items-center gap-10">
        {track.map((item, i) => (
          <span key={`marquee-${i}`} className="flex shrink-0 items-center gap-2 text-sm text-lpcream/80">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
