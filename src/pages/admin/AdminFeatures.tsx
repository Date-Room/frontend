/**
 * Features answers "what do people actually do in rooms?": for each
 * feature, how many rooms used it, what share of real dates did, how long
 * it held people, whether they came back to it, how often it was opened
 * and abandoned, and how often it shows up in rooms that paid. Counts
 * only; no content is ever recorded.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminFeatures, ROOM_KIND_LABELS, type FeatureRow, type RoomKindFilter } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { loadProblem } from "@/pages/admin/AdminGrowth";
import { cn } from "@/lib/utils";

const FEATURE_LABELS: Record<string, string> = {
  watch: "Watch together",
  dj: "Music (DJ)",
  questions: "Questions",
  this_or_that: "This or that",
  the_36: "The 36 questions",
  "2_truths": "Two truths and a lie",
  truth_or_dare: "Truth or dare",
  one_has_to_go: "One has to go",
  pick_a_door: "Pick a door",
  rank_it: "Rank it",
  guacamole: "Guacamole Panic",
  vision_board: "Vision board",
  fridge: "Fridge notes",
  pinned_note: "Pinned note",
  chat: "Chat",
  room_details: "Room details",
  room_stage: "Room stage",
  chaperon_guardian: "Chaperon · Protect",
  chaperon_coached: "Chaperon · Coach",
};

/** Pure: a readable name for any feature id. */
export function featureLabel(id: string): string {
  if (FEATURE_LABELS[id]) return FEATURE_LABELS[id];
  const words = id.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Pure: "45%" or "—". */
export function pctOrDash(v: number | null | undefined): string {
  return v == null ? "—" : `${v}%`;
}

/** Pure: the most-used and the most-abandoned feature, for the tiles. */
export function headline(features: FeatureRow[]): { top: FeatureRow | null; dropped: FeatureRow | null } {
  const used = features.filter((f) => f.rooms_used > 0);
  const top = used.reduce<FeatureRow | null>((a, f) => (!a || f.rooms_used > a.rooms_used ? f : a), null);
  const tried = features.filter((f) => f.rooms_used + f.rooms_opened_only >= 3 && f.abandon_rate != null);
  const dropped = tried.reduce<FeatureRow | null>((a, f) => (!a || (f.abandon_rate ?? 0) > (a.abandon_rate ?? 0) ? f : a), null);
  return { top, dropped };
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-card/40 neon-tile px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="truncate text-[22px] font-semibold leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const SELECT = "rounded-lg border border-white/[0.14] bg-card px-2.5 py-1.5 text-xs text-cream/90";

export default function AdminFeatures() {
  const [days, setDays] = useState<7 | 30 | 90 | 365>(30);
  const [includeTeam, setIncludeTeam] = useState(false);
  const [platform, setPlatform] = useState<string | null>(null);
  const [kind, setKind] = useState<RoomKindFilter | null>(null);
  const q = useQuery({
    queryKey: ["admin-features", days, includeTeam, platform, kind],
    queryFn: () => getAdminFeatures(days, includeTeam, { platform, kind }),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
  const r = q.data;
  const features = r?.features ?? [];
  const max = Math.max(1, ...features.map((f) => f.rooms_used));
  const { top, dropped } = headline(features);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-cream">Features</h2>
          <p className="mt-1 text-sm text-muted-foreground/70">
            What people do in rooms · last {days === 365 ? "year" : `${days} days`} · counts only, never content
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select aria-label="Room kind" value={kind ?? ""} onChange={(e) => setKind((e.target.value || null) as RoomKindFilter | null)} className={SELECT}>
            <option value="">Dates and squads</option>
            <option value="date">{ROOM_KIND_LABELS.date}</option>
            <option value="squad">{ROOM_KIND_LABELS.squad}</option>
          </select>
          <select aria-label="Platform" value={platform ?? ""} onChange={(e) => setPlatform(e.target.value || null)} className={SELECT}>
            <option value="">All platforms</option>
            <option value="web">Web</option>
            <option value="ios">iPhone</option>
            <option value="android">Android</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={includeTeam} onChange={(e) => setIncludeTeam(e.target.checked)} />
            Include team
          </label>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-white/[0.14]">
          {([7, 30, 90, 365] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={cn("px-3 py-1.5 text-xs", days === d ? "bg-white/[0.12] text-cream" : "text-muted-foreground hover:bg-white/[0.05]")}>
              {d === 365 ? "1y" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {q.isError && !r && (() => {
        const problem = loadProblem(q.error);
        const notLive = q.error instanceof ApiError && q.error.status === 404;
        return (
          <div className="rounded-xl border border-white/[0.08] bg-card/40 px-6 py-10 text-center">
            <p className="text-base font-semibold text-cream">{notLive ? "Feature tracking isn't live on the server yet" : problem.title}</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              {notLive ? "This page is ready, but the server update that counts feature use hasn't been deployed. Once it is, rooms start filling this in." : problem.body}
            </p>
          </div>
        );
      })()}
      {!r && !q.isError && <p className="py-10 text-center text-sm text-muted-foreground/70">Loading…</p>}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Rooms with activity" value={String(r.rooms)} sub="used or opened any feature" />
            <Tile label="Dates" value={String(r.dated_rooms)} sub="of those, both people on the call" />
            <Tile label="Most used" value={top ? featureLabel(top.feature) : "—"} sub={top ? `${top.rooms_used} rooms` : "nothing yet"} />
            <Tile label="Most abandoned" value={dropped ? featureLabel(dropped.feature) : "—"} sub={dropped ? `${pctOrDash(dropped.abandon_rate)} opened, never used` : "needs 3+ opens"} />
          </div>

          <section className="rounded-xl border border-white/[0.08] bg-card/40">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <h3 className="text-sm font-semibold">Every feature</h3>
              <span className="text-xs text-muted-foreground/70">rooms that used it first in the period · hover a header for what it means</span>
            </div>
            {features.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground/70">No feature use recorded in this period yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="whitespace-nowrap text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    <tr>
                      <th className="px-4 py-2">Feature</th>
                      <th className="px-2 py-2" title="rooms where someone actually used it">Rooms used</th>
                      <th className="px-2 py-2 text-right" title="share of the period's dates (both people on the call) that used it">Of dates</th>
                      <th className="px-2 py-2 text-right" title="median time from first to last use in a room">Minutes</th>
                      <th className="px-2 py-2 text-right" title="people who used it in two or more rooms, of everyone who used it">Came back to it</th>
                      <th className="px-2 py-2 text-right" title="opened but never used, of every room that opened it">Abandoned</th>
                      <th className="px-4 py-2 text-right" title="share of its rooms whose host paid real money or made the room permanent">In paid rooms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f) => (
                      <tr key={f.feature} className="border-t border-white/[0.06]">
                        <td className="whitespace-nowrap px-4 py-1.5 text-cream/90">{featureLabel(f.feature)}</td>
                        <td className="w-[30%] px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 flex-1">
                              <div className="h-full rounded-r-[4px] bg-primary/70" style={{ width: `${(100 * f.rooms_used) / max}%`, minWidth: f.rooms_used ? 3 : 0 }} />
                            </div>
                            <span className="w-8 shrink-0 text-right tabular-nums">{f.rooms_used}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{pctOrDash(f.share_of_dates)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{f.median_minutes == null ? "—" : Math.round(f.median_minutes)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{f.users ? `${f.repeat_users} of ${f.users}` : "—"}</td>
                        <td className={cn("px-2 py-1.5 text-right tabular-nums", (f.abandon_rate ?? 0) >= 50 && "text-amber-300")}>{pctOrDash(f.abandon_rate)}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums">{pctOrDash(f.in_paid_rooms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-muted-foreground/70">
              "In paid rooms" shows what paying couples use, not what made them pay. Treat it as a lead, not proof.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
