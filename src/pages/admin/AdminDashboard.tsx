/**
 * The dashboard answers two questions: what changed, and what needs me.
 * Every tile carries its prior-period value; the Needs action list is real
 * checks with a link and a button only where a route exists; one chart,
 * one series.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminNeedsAction,
  getAdminStatsDeltas,
  getAdminTimeseries,
  listAdminRooms,
  postBetaEndSessions,
  type AdminNeedsActionRow,
} from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { cn } from "@/lib/utils";

/** Pure: "+12%" / "−2 pts" / "flat" and its tone. */
export function trend(current: number | null | undefined, prior: number | null | undefined, mode: "pct" | "pts" | "abs" = "pct"): { text: string; tone: "up" | "down" | "flat" } {
  if (current == null || prior == null) return { text: "", tone: "flat" };
  if (mode === "pct") {
    if (prior === 0) return current === 0 ? { text: "flat", tone: "flat" } : { text: "new", tone: "up" };
    const d = Math.round((100 * (current - prior)) / prior);
    if (d === 0) return { text: "flat", tone: "flat" };
    return { text: `${d > 0 ? "+" : "−"}${Math.abs(d)}%`, tone: d > 0 ? "up" : "down" };
  }
  const d = current - prior;
  if (d === 0) return { text: "flat", tone: "flat" };
  return { text: `${d > 0 ? "+" : "−"}${Math.abs(d)}${mode === "pts" ? " pts" : ""}`, tone: d > 0 ? "up" : "down" };
}

function Tile({ label, value, sub, t }: { label: string; value: string; sub?: string; t?: ReturnType<typeof trend> }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-card/40 px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="text-[26px] font-semibold leading-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">
        {t?.text && <span className={cn("mr-1.5 font-semibold", t.tone === "up" ? "text-emerald-300" : t.tone === "down" ? "text-rose-300" : "text-muted-foreground/70")}>{t.text}</span>}
        {sub}
      </p>
    </div>
  );
}

const KES = (n: number) => (n >= 1_000_000 ? `KES ${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `KES ${Math.round(n / 1000)}k` : `KES ${n}`);

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const stats = useQuery({ queryKey: ["admin-stats-deltas", days], queryFn: () => getAdminStatsDeltas(days), refetchInterval: 60_000 });
  const needs = useQuery({ queryKey: ["admin-needs-action"], queryFn: getAdminNeedsAction, refetchInterval: 30_000 });
  const series = useQuery({ queryKey: ["admin-timeseries", days], queryFn: () => getAdminTimeseries(days), staleTime: 60_000 });
  const rooms = useQuery({ queryKey: ["admin-rooms-live"], queryFn: () => listAdminRooms({ limit: 6 }), refetchInterval: 30_000 });
  const end = useMutation({
    mutationFn: (r: string[]) => postBetaEndSessions(r),
    onSuccess: (r) => { toast.success(`Closed ${r.ended}`); void qc.invalidateQueries({ queryKey: ["admin-needs-action"] }); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not close"),
  });

  const c = stats.data?.current ?? {};
  const p = stats.data?.prior ?? {};
  const n = stats.data?.now;
  const src = stats.data?.signups_by_source ?? {};
  const srcLine = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k.replace("_", " ")} ${v}`).join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-cream">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground/70">Platform pulse · last {days} days against the {days} before</p>
        </div>
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-white/[0.14]">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={cn("px-3 py-1.5 text-xs", days === d ? "bg-white/[0.12] text-cream" : "text-muted-foreground hover:bg-white/[0.05]")}>{d}d</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Settled revenue" value={KES((c.revenue_kes as number) ?? 0)} sub={`${c.mpesa_completed ?? 0} M-Pesa payments`} t={trend(c.revenue_kes as number, p.revenue_kes as number)} />
        <Tile label="New users" value={String(c.new_users ?? 0)} sub={srcLine || "no sign-ups yet"} t={trend(c.new_users as number, p.new_users as number)} />
        <Tile label="Live rooms" value={String(n?.live_rooms ?? 0)} sub={`${n?.live_dates ?? 0} dates · ${n?.live_persistent ?? 0} persistent`} />
        <Tile label="M-Pesa success" value={c.mpesa_success_pct == null ? "—" : `${c.mpesa_success_pct}%`} sub={`${c.mpesa_attempts ?? 0} attempts`} t={trend(c.mpesa_success_pct as number, p.mpesa_success_pct as number, "pts")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-xl border border-white/[0.08] bg-card/40">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <h3 className="text-sm font-semibold">Settled revenue</h3>
              <span className="text-xs text-muted-foreground/70">daily, KES, M-Pesa</span>
            </div>
            <div className="px-4 pb-2 pt-3">
              {series.data ? (
                <RevenueChart points={series.data.points.map((pt) => ({ day: pt.day, value: pt.revenue_kes }))} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground/70">Loading…</p>
              )}
            </div>
          </section>
          <section className="rounded-xl border border-white/[0.08] bg-card/40">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <h3 className="text-sm font-semibold">Rooms</h3>
              <span className="text-xs text-muted-foreground/70">newest first</span>
              <Link to="/admin/rooms" className="ml-auto text-xs text-primary hover:underline">All rooms</Link>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
                <tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">Host</th><th className="px-4 py-2">Package</th><th className="px-4 py-2">People</th><th className="px-4 py-2">State</th></tr>
              </thead>
              <tbody>
                {(rooms.data?.items ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-2 font-mono text-cream/90">{r.code}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground/70">{r.host_email ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.package}{r.persistence === "persistent" ? " · persistent" : ""}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{r.participant_count}/{r.max_participants}</td>
                    <td className="px-4 py-2"><span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] uppercase">{r.state}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <section className="rounded-xl border border-white/[0.08] bg-card/40">
          <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
            <h3 className="text-sm font-semibold">Needs action</h3>
            <span className="text-xs text-muted-foreground/70">real checks, one button each</span>
            {(needs.data?.items.length ?? 0) > 0 && <span className="ml-auto rounded-full bg-rose-500/15 px-2 text-[11px] font-semibold text-rose-300">{needs.data?.items.length}</span>}
          </div>
          {needs.data?.items.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground/70">Nothing needs you right now.</p>}
          {(needs.data?.items ?? []).map((row: AdminNeedsActionRow) => (
            <div key={row.id} className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", row.severity === "alert" ? "bg-rose-400" : "bg-amber-400")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-cream">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.detail}</p>
              </div>
              {row.action === "end_sessions" ? (
                <button type="button" disabled={end.isPending} onClick={() => end.mutate(row.rooms)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-card px-3 py-1.5 text-xs text-cream/90 hover:bg-white/[0.08] disabled:opacity-40">
                  {end.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Close
                </button>
              ) : row.href ? (
                <Link to={row.href} className="rounded-lg border border-white/[0.14] bg-card px-3 py-1.5 text-xs text-cream/90 hover:bg-white/[0.08]">Open</Link>
              ) : null}
            </div>
          ))}
          <div className="border-t border-white/[0.08] px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Also this period</p>
            <dl className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground/70">Rooms opened</dt><dd className="tabular-nums">{c.rooms_opened ?? 0} <span className="text-muted-foreground/70">({trend(c.rooms_opened as number, p.rooms_opened as number).text || "flat"})</span></dd>
              <dt className="text-muted-foreground/70">Codes redeemed</dt><dd className="tabular-nums">{c.promo_redemptions ?? 0}</dd>
              <dt className="text-muted-foreground/70">Active subs</dt><dd className="tabular-nums">{n?.active_subscriptions ?? 0}</dd>
              <dt className="text-muted-foreground/70">All users</dt><dd className="tabular-nums">{n?.total_users ?? 0}</dd>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
