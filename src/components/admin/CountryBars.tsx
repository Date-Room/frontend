/**
 * Where people are, and whether they stay there. One series (sign-ups) as
 * thin horizontal bars sorted largest first; the rates beside each bar say
 * which countries convert, which is what spending should follow. Beyond
 * the top rows everything folds into "Other". Rows are buttons: picking one
 * filters the page to that country.
 */
import { useState } from "react";
import type { AnalyticsCountryRow } from "@/lib/admin";
import { cn } from "@/lib/utils";

const TOP = 10;

let names: Intl.DisplayNames | null = null;
/** Pure-ish: "KE" → "Kenya"; "unknown" → "Unknown". */
export function countryName(code: string): string {
  if (code === "unknown") return "Unknown";
  if (code === "other") return "Other";
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Pure: "KE" → 🇰🇪; anything that isn't two letters → "". */
export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Pure: the top rows by sign-ups plus one summed "Other" row. */
export function foldCountries(rows: AnalyticsCountryRow[], top = TOP): AnalyticsCountryRow[] {
  const sorted = [...rows].sort((a, b) => b.signed_up - a.signed_up || a.country.localeCompare(b.country));
  if (sorted.length <= top + 1) return sorted;
  const rest = sorted.slice(top);
  const other = rest.reduce<AnalyticsCountryRow>(
    (acc, r) => ({
      country: "other",
      signed_up: acc.signed_up + r.signed_up,
      new_in_period: acc.new_in_period + r.new_in_period,
      had_a_date: acc.had_a_date + r.had_a_date,
      came_back_later: acc.came_back_later + r.came_back_later,
      paid: acc.paid + r.paid,
    }),
    { country: "other", signed_up: 0, new_in_period: 0, had_a_date: 0, came_back_later: 0, paid: 0 },
  );
  return [...sorted.slice(0, top), other];
}

const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "—");

export function CountryBars({
  rows,
  selected,
  onSelect,
}: {
  rows: AnalyticsCountryRow[];
  selected: string | null;
  onSelect: (country: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const shown = foldCountries(rows);
  const max = Math.max(1, ...shown.map((r) => r.signed_up));
  if (shown.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground/70">No sign-ups yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="whitespace-nowrap text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
          <tr>
            <th className="px-4 py-2">Country</th>
            <th className="px-2 py-2">Signed up</th>
            <th className="px-2 py-2 text-right" title="signed up in the selected period">New</th>
            <th className="px-2 py-2 text-right" title="% of this country's sign-ups who had a date">Had a date</th>
            <th className="px-2 py-2 text-right" title="% who came back on a later day">Came back</th>
            <th className="px-4 py-2 text-right" title="% who paid real money">Paid</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const clickable = r.country !== "other";
            const active = selected?.toUpperCase() === r.country.toUpperCase();
            return (
              <tr
                key={r.country}
                onMouseEnter={() => setHover(r.country)}
                onMouseLeave={() => setHover(null)}
                onClick={clickable ? () => onSelect(active ? null : r.country) : undefined}
                className={cn(
                  "border-t border-white/[0.06]",
                  clickable && "cursor-pointer",
                  (hover === r.country || active) && "bg-white/[0.04]",
                )}
                aria-selected={active}
              >
                <td className="whitespace-nowrap px-4 py-1.5 text-cream/90">
                  {flag(r.country) && <span className="mr-1.5" aria-hidden>{flag(r.country)}</span>}
                  {countryName(r.country)}
                </td>
                <td className="w-[45%] px-2 py-1.5">
                  <div className="flex items-center gap-2" title={`${r.signed_up} signed up · ${r.had_a_date} had a date · ${r.came_back_later} came back · ${r.paid} paid`}>
                    <div className="h-2.5 flex-1">
                      <div
                        className={cn("h-full rounded-r-[4px]", active || hover === r.country ? "bg-primary" : "bg-primary/70")}
                        style={{ width: `${(100 * r.signed_up) / max}%`, minWidth: r.signed_up ? 3 : 0 }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums">{r.signed_up}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{r.new_in_period || "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{pct(r.had_a_date, r.signed_up)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{pct(r.came_back_later, r.signed_up)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{pct(r.paid, r.signed_up)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
