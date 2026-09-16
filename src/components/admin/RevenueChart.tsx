/**
 * One series, thin bars, a baseline, four grid lines, a single direct label on
 * the last point, hover tooltip per bar. The series wears the admin primary
 * (electric cyan); one series, so no legend and the title names it.
 */
import { useState } from "react";

export type Point = { day: string; value: number };

/** Pure: nice axis ceiling for a max value (10, 20, 50, 100, ... steps). */
export function niceMax(max: number): number {
  if (max <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (max <= m * pow) return m * pow;
  return 10 * pow;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function RevenueChart({ points, unit = "", height = 200 }: { points: Point[]; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 760;
  const padL = 40;
  const padB = 22;
  const padT = 14;
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const bw = (w - padL - 8) / Math.max(points.length, 1);
  const y = (v: number) => height - padB - (height - padB - padT) * (v / max);
  const last = points.length - 1;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" className="block" role="img" aria-label="Daily settled revenue">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={padL} x2={w - 8} y1={y(max * g)} y2={y(max * g)} stroke="hsl(222 24% 16%)" strokeWidth="1" />
            <text x={padL - 6} y={y(max * g) + 4} textAnchor="end" fontSize="10" fill="hsl(215 20% 55%)">{fmt(max * g)}</text>
          </g>
        ))}
        <line x1={padL} x2={w - 8} y1={height - padB} y2={height - padB} stroke="hsl(222 24% 24%)" />
        {points.map((p, i) => {
          const x = padL + i * bw;
          const h = height - padB - y(p.value);
          return (
            <rect
              key={p.day}
              x={x + 1.5}
              y={y(p.value)}
              width={Math.max(bw - 3, 1)}
              height={Math.max(h, 0)}
              rx="2"
              fill={i === last || i === hover ? "hsl(190 95% 55%)" : "hsl(190 95% 55% / 0.45)"}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {points.length > 0 && (
          <text x={padL + last * bw + bw / 2} y={y(points[last].value) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="hsl(210 40% 96%)">
            {fmt(points[last].value)}{unit}
          </text>
        )}
        {points.length > 0 && (
          <>
            <text x={padL} y={height - 6} fontSize="10" fill="hsl(215 20% 55%)">{points[0].day.slice(5)}</text>
            <text x={w - 8} y={height - 6} textAnchor="end" fontSize="10" fill="hsl(215 20% 55%)">{points[last].day.slice(5)}</text>
          </>
        )}
      </svg>
      {hover != null && points[hover] && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-white/[0.14] bg-card px-2 py-1 text-xs text-cream shadow">
          {points[hover].day} · {points[hover].value.toLocaleString()}{unit}
        </div>
      )}
    </div>
  );
}
