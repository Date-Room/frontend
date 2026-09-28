/**
 * Growth answers "are people staying?": who got from sign-up to a real
 * date and back again, what rooms opened and how they were paid for, and
 * which permanent rooms nobody is paying for. Read from the analytics log,
 * which outlives room purges; team and admin accounts are left out.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminAnalytics,
  postAdminAnalyticsBackfill,
  type AnalyticsFunnelStep,
  type AnalyticsReport,
} from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { CountryBars, countryName, flag } from "@/components/admin/CountryBars";
import { cn } from "@/lib/utils";

const FUNNEL_LABELS: Record<AnalyticsFunnelStep["step"], string> = {
  signed_up: "Signed up",
  opened_or_joined_room: "Opened or joined a room",
  had_a_date: "Had a date (both on the call)",
  came_back_later: "Came back on a later day",
  paid: "Paid real money",
};

const PAID_VIA_LABELS: Record<string, string> = {
  free: "Free try",
  purchase: "Paid",
  subscription: "Subscription",
  promo: "Promo code",
  admin_grant: "Admin grant",
  dev_checkout: "Dev checkout",
  open_beta: "Free (paywall off)",
  unknown: "Unknown (from before tracking)",
};

const PROVIDER_LABELS: Record<string, string> = {
  apple: "App Store",
  google: "Google Play",
  stripe: "Card (Stripe)",
  mpesa: "M-Pesa",
  pokeapay: "M-Pesa (PokeaPay)",
  promo: "Promo code",
  admin: "Admin grant",
  dev: "Dev checkout",
};

const SOURCE_LABELS: Record<string, string> = {
  real: "Real money",
  test: "Store test",
  promo: "Gift · promo",
  admin: "Gift · admin",
  dev: "Dev",
};

const PRODUCT_LABELS: Record<string, string> = {
  date_pack: "Date Pack",
  long_pack: "Long Pack",
  together: "Together",
  crew: "Crew",
  time_extension: "Time extension",
  other: "Other",
};

/** Pure: "KES 1,200" / "USD 4.99" / "—". */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !currency) return "—";
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`;
}

const PACKAGE_LABELS: Record<string, string> = {
  single_pass: "Try",
  date_pack: "Date Pack",
  long_pack: "Long Pack",
  subscription: "Together",
};

const CLOSED_LABELS: Record<string, string> = {
  recap_expired: "Recap window ended",
  lapsed: "Lapsed (not renewed)",
  closed_by_members: "Closed by the couple",
  deleted_by_host: "Deleted by host",
};

/** Pure: what to tell an admin when the growth numbers can't load. */
export function loadProblem(error: unknown): { title: string; body: string; retry: boolean } {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 404) {
    return {
      title: "Growth tracking isn't live on the server yet",
      body: "This page is ready, but the server update that records rooms, dates and visits hasn't been deployed. Once it is, numbers appear here on their own. Then press Rebuild history to fill in what we can from before.",
      retry: false,
    };
  }
  if (status === 401 || status === 403) {
    return {
      title: "This account can't see growth numbers",
      body: "Growth is for platform admins. Sign in with an admin account to see it.",
      retry: false,
    };
  }
  return {
    title: "Couldn't reach the server just now",
    body: "Nothing is lost. The numbers are still being recorded; this page just couldn't fetch them. Try again in a moment.",
    retry: true,
  };
}

/** Pure: a label for a paid_via value, falling back to the raw value. */
export function paidViaLabel(v: string): string {
  return PAID_VIA_LABELS[v] ?? v;
}

/** Pure: true when a paid_via value means money actually moved. */
export function isRealMoney(v: string): boolean {
  return v === "purchase" || v === "subscription";
}

/** Pure: each funnel step with its % of sign-ups and % of the step before. */
export function funnelRows(steps: AnalyticsFunnelStep[]) {
  const top = steps[0]?.users ?? 0;
  return steps.map((s, i) => {
    const prev = i === 0 ? s.users : steps[i - 1].users;
    return {
      ...s,
      label: FUNNEL_LABELS[s.step] ?? s.step,
      ofTop: top ? Math.round((100 * s.users) / top) : 0,
      ofPrev: prev ? Math.round((100 * s.users) / prev) : 0,
    };
  });
}

/** Pure: "14m", "1h 05m", "—". */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Pure: one plain sentence for a recent-activity row. */
export function eventLine(kind: string, props: Record<string, unknown>): string {
  const pkg = PACKAGE_LABELS[String(props.package ?? "")] ?? String(props.package ?? "room");
  const via = props.paid_via ? ` · ${paidViaLabel(String(props.paid_via))}` : "";
  switch (kind) {
    case "room_opened":
      return `Opened a ${pkg} room${via}`;
    case "room_joined":
      return props.is_guest ? `A guest joined a ${pkg} room` : `Joined a ${pkg} room`;
    case "date_connected":
      return `Both people on the call (${pkg})`;
    case "room_ended":
      return `Ended a ${pkg} room${props.call_seconds ? ` after ${formatDuration(Number(props.call_seconds))}` : ""}`;
    case "room_promoted":
      return `Made a room permanent${via}`;
    case "room_renewed":
      return `Renewed a Together room${via}`;
    case "room_purged":
      return `Room closed · ${CLOSED_LABELS[String(props.reason)] ?? String(props.reason ?? "")}`;
    default:
      return kind;
  }
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-card/40 neon-tile px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="text-[26px] font-semibold leading-tight tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-white/[0.08] bg-card/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground/70">{hint}</span>}
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function sum(rows: AnalyticsReport["daily"], key: keyof AnalyticsReport["daily"][number]) {
  return rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
}

function Backfill() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof postAdminAnalyticsBackfill>> | null>(null);
  const run = useMutation({
    mutationFn: (apply: boolean) => postAdminAnalyticsBackfill(apply),
    onSuccess: (r) => {
      if (r.applied) {
        toast.success(`Rebuilt ${r.events} events and ${r.active_user_days} active days`);
        setPreview(null);
        void qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      } else {
        setPreview(r);
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Backfill failed"),
  });
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {preview ? (
        <>
          <span className="text-muted-foreground">
            Will rebuild {preview.events} room events and {preview.active_user_days} active days for {preview.users_with_activity} people.
          </span>
          <button type="button" disabled={run.isPending} onClick={() => run.mutate(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3 py-1.5 text-cream hover:bg-primary/25 disabled:opacity-40">
            {run.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Apply
          </button>
          <button type="button" onClick={() => setPreview(null)} className="rounded-lg px-2 py-1.5 text-muted-foreground hover:text-cream">Cancel</button>
        </>
      ) : (
        <button type="button" disabled={run.isPending} onClick={() => run.mutate(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-card px-3 py-1.5 text-cream/90 hover:bg-white/[0.08] disabled:opacity-40">
          {run.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Rebuild history
        </button>
      )}
    </div>
  );
}

export default function AdminGrowth() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [includeTeam, setIncludeTeam] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin-analytics", days, includeTeam, country],
    queryFn: () => getAdminAnalytics(days, includeTeam, country),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
  const r = q.data;
  const daily = r?.daily ?? [];
  const active = daily.map((d) => d.active_users);
  const avgActive = active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-cream">Growth</h2>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Are people staying · {country ? `${countryName(country)} · ` : ""}last {days} days
            {r && (r.tracking_since ? ` · exact since ${day(r.tracking_since)}` : " · tracking starts with the next room")}
          </p>
        </div>
        {(r?.countries?.length ?? 0) > 0 && (<select
          aria-label="Country"
          value={country ?? ""}
          onChange={(e) => setCountry(e.target.value || null)}
          className="ml-auto rounded-lg border border-white/[0.14] bg-card px-2.5 py-1.5 text-xs text-cream/90"
        >
          <option value="">All countries</option>
          {(r?.countries ?? []).map((c) => (
            <option key={c.country} value={c.country}>
              {flag(c.country)} {countryName(c.country)} ({c.signed_up})
            </option>
          ))}
        </select>)}
        <label className={cn("flex items-center gap-2 text-xs text-muted-foreground", !r?.countries?.length && "ml-auto")}>
          <input type="checkbox" checked={includeTeam} onChange={(e) => setIncludeTeam(e.target.checked)} />
          Include team
        </label>
        <div className="inline-flex overflow-hidden rounded-lg border border-white/[0.14]">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={cn("px-3 py-1.5 text-xs", days === d ? "bg-white/[0.12] text-cream" : "text-muted-foreground hover:bg-white/[0.05]")}>{d}d</button>
          ))}
        </div>
      </div>

      {q.isError && !r && (() => {
        const problem = loadProblem(q.error);
        return (
          <div className="rounded-xl border border-white/[0.08] bg-card/40 px-6 py-10 text-center">
            <p className="text-base font-semibold text-cream">{problem.title}</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{problem.body}</p>
            {problem.retry && (
              <button type="button" onClick={() => void q.refetch()} disabled={q.isFetching} className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-card px-3 py-1.5 text-xs text-cream/90 hover:bg-white/[0.08] disabled:opacity-40">
                {q.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Try again
              </button>
            )}
          </div>
        );
      })()}
      {!r && !q.isError && <p className="py-10 text-center text-sm text-muted-foreground/70">Loading…</p>}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Dates" value={String(sum(daily, "dates"))} sub="both people on the call" />
            <Tile label="Rooms opened" value={String(sum(daily, "opened"))} sub={`${sum(daily, "opened_paid")} paid · ${sum(daily, "opened_free")} free`} />
            <Tile label="Active per day" value={String(avgActive)} sub={`${active[active.length - 1] ?? 0} today`} />
            <Tile label="Typical call" value={formatDuration(r.median_call_seconds)} sub="median, ended rooms" />
          </div>

          <Section
            title="Where people are"
            hint="sign-ups by location, and how many from each stay · click a country to filter"
            right={country ? <button type="button" onClick={() => setCountry(null)} className="text-xs text-primary hover:underline">Show all</button> : undefined}
          >
            {r.countries ? (
              <CountryBars rows={r.countries} selected={country} onSelect={setCountry} />
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground/70">
                The country breakdown arrives with the next server update.
              </p>
            )}
            {r.countries && (
              <p className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-muted-foreground/70">
                Location is where they signed up from, else where they last visited from, else their profile country. IP geolocation by{" "}
                <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="underline hover:text-cream/80">DB-IP</a>.
              </p>
            )}
          </Section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Section title="From sign-up to staying" hint="all time · right column is % of the step before">
              <div className="space-y-3 px-4 py-4">
                {funnelRows(r.funnel).map((s, i) => (
                  <div key={s.step}>
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="min-w-0 text-cream/90">{s.label}</span>
                      <span className="ml-auto tabular-nums font-semibold">{s.users}</span>
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground/70" title="of the step before">
                        {i === 0 ? "" : `${s.ofPrev}%`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${s.ofTop}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Do sign-ups come back?" hint="% of each week's sign-ups active N weeks later">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    <tr>
                      <th className="px-4 py-2">Week of</th>
                      <th className="px-2 py-2 text-right">Joined</th>
                      {[1, 2, 3, 4].map((n) => <th key={n} className="px-2 py-2 text-right">Wk {n}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {r.cohorts.map((c) => (
                      <tr key={c.week_of} className="border-t border-white/[0.06]">
                        <td className="px-4 py-1.5 text-muted-foreground">{day(c.week_of)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{c.signed_up}</td>
                        {c.active_pct.map((pct, i) => (
                          <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                            {pct == null ? (
                              <span className="text-muted-foreground/40">·</span>
                            ) : (
                              <span className="rounded px-1.5 py-0.5" style={{ background: `hsl(var(--primary) / ${Math.min(0.08 + pct / 100, 0.9)})` }}>{pct}%</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Dates per day" hint="both people on the call">
              <div className="px-4 pb-2 pt-3"><RevenueChart points={daily.map((d) => ({ day: d.day, value: d.dates }))} height={160} /></div>
            </Section>
            <Section title="Active people per day" hint="signed in and used the app">
              <div className="px-4 pb-2 pt-3"><RevenueChart points={daily.map((d) => ({ day: d.day, value: d.active_users }))} height={160} /></div>
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Section title="Rooms opened" hint={`by type and how they were paid for · last ${days} days`}>
              {r.rooms_by_package.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground/70">No rooms opened in this period.</p>
              ) : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    <tr><th className="px-4 py-2">Room</th><th className="px-4 py-2">Paid for by</th><th className="px-4 py-2 text-right">Rooms</th></tr>
                  </thead>
                  <tbody>
                    {r.rooms_by_package.map((row) => (
                      <tr key={`${row.package}-${row.paid_via}`} className="border-t border-white/[0.06]">
                        <td className="px-4 py-2 text-cream/90">{PACKAGE_LABELS[row.package] ?? row.package}</td>
                        <td className={cn("px-4 py-2", isRealMoney(row.paid_via) ? "text-emerald-300" : "text-muted-foreground")}>{paidViaLabel(row.paid_via)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.rooms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </Section>
            <Section title="Made permanent, renewed, closed" hint={`last ${days} days`}>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
                {[
                  ["Made permanent", r.promotions],
                  ["Renewed", r.renewals],
                ].map(([label, counts]) => {
                  const entries = Object.entries(counts as Record<string, number>);
                  return (
                    <div key={label as string} className="contents">
                      <dt className="text-muted-foreground">{label as string}</dt>
                      <dd className="text-right tabular-nums">{entries.reduce((n, [, v]) => n + v, 0)}</dd>
                      {entries.map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="pl-3 text-xs text-muted-foreground/70">{paidViaLabel(k)}</dt>
                          <dd className="text-right text-xs tabular-nums text-muted-foreground/70">{v}</dd>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <dt className="text-muted-foreground">Closed</dt>
                <dd className="text-right tabular-nums">{Object.values(r.closed_reasons).reduce((a, b) => a + b, 0)}</dd>
                {Object.entries(r.closed_reasons).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="pl-3 text-xs text-muted-foreground/70">{CLOSED_LABELS[k] ?? k}</dt>
                    <dd className="text-right text-xs tabular-nums text-muted-foreground/70">{v}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>

          {r.purchases && (
            <Section title="What's being paid for" hint={`every purchase and gift · last ${days} days · store country is the store or card, not the person`}>
              {r.purchases.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground/70">No purchases or gifts in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="whitespace-nowrap text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
                      <tr>
                        <th className="px-4 py-2">Product</th>
                        <th className="px-2 py-2">Paid through</th>
                        <th className="px-2 py-2">Store country</th>
                        <th className="px-2 py-2">Kind</th>
                        <th className="px-2 py-2 text-right">Sales</th>
                        <th className="px-2 py-2 text-right">Buyers</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.purchases.map((g, i) => (
                        <tr key={i} className="border-t border-white/[0.06]">
                          <td className="px-4 py-1.5 text-cream/90">{PRODUCT_LABELS[g.product] ?? g.product}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{PROVIDER_LABELS[g.provider] ?? g.provider}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                            {g.store_country ? `${flag(g.store_country)} ${countryName(g.store_country)}` : "—"}
                          </td>
                          <td className={cn("px-2 py-1.5", g.source === "real" ? "text-emerald-300" : "text-muted-foreground")}>
                            {SOURCE_LABELS[g.source] ?? g.source}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{g.count}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{g.buyers}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums">{formatMoney(g.amount, g.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          <Section
            title="Permanent rooms nobody is paying for"
            hint="no end date and the host has no live subscription · nothing will ever close these"
            right={r.open_ended_unpaid_rooms.length > 0 ? <span className="rounded-full bg-rose-500/15 px-2 text-[11px] font-semibold text-rose-300">{r.open_ended_unpaid_rooms.length}</span> : undefined}
          >
            {r.open_ended_unpaid_rooms.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground/70">None. Every permanent room has an end date or a paying host.</p>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  <tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">Host</th><th className="px-4 py-2">Created</th><th className="px-4 py-2">State</th></tr>
                </thead>
                <tbody>
                  {r.open_ended_unpaid_rooms.map((room) => (
                    <tr key={room.room_id} className="border-t border-white/[0.06]">
                      <td className="px-4 py-2 font-mono text-cream/90">{room.code}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{room.host_email ?? "—"}{room.team ? " · team" : ""}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{day(room.created_at)}</td>
                      <td className="px-4 py-2"><span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] uppercase">{room.state}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Section>

          <Section title="Recent activity" hint="newest first" right={<Backfill />}>
            {r.recent.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground/70">Nothing recorded yet. Use Rebuild history to recover rooms that still exist.</p>
            ) : (
              <ul>
                {r.recent.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 border-t border-white/[0.06] px-4 py-2 text-sm first:border-t-0">
                    <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground/70">{when(e.at)}</span>
                    <span className="text-cream/90">{eventLine(e.kind, e.props)}</span>
                    <span className="ml-auto text-xs text-muted-foreground/70">{e.user_email ?? "guest"}{e.backfilled ? " · rebuilt" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
