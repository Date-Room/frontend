/**
 * The Beta console: watch the chaperon run, work the review queue, decide
 * applications. Structure only, never the words, never who: the API hands
 * us call numbers and tester ids and pattern codes instead of whispers.
 *
 * The console never carries a sentence about a call: no whisper text, not
 * even the reviewer's own, not even when the tester flagged the cue. Codes
 * only (check, pattern, outcome, reaction, reason).
 *
 * Tabs: Live (stat strip with deltas, needs-you rows, on air, the signal
 * stream), Review (a queue with Save & next), Grants (applications with
 * grant and decline), Status (PR 14).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COACH_BETA_MAX_GRANT,
  declineCoachBeta,
  getBetaFeed,
  getBetaHealth,
  getBetaLive,
  getBetaOverview,
  getBetaReviewQueue,
  grantCoachBeta,
  listCoachBetaApplicationsBy,
  postBetaVerdict,
  type BetaFeedFilters,
  type BetaSignalRow,
  type BetaVerdict,
  type BetaVerdictTag,
  type CoachBetaApplication,
  type CoachBetaDeclineReason,
} from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const LIVE_POLL_MS = 5_000;

// ── Pure helpers (tested) ────────────────────────────────────────────────────

/** "+6" / "−4" / "flat" beside a stat, from today and yesterday. */
export function delta(today: number | null | undefined, yesterday: number | null | undefined, suffix = ""): { text: string; tone: "up" | "down" | "flat" } {
  if (today == null || yesterday == null) return { text: "", tone: "flat" };
  const d = today - yesterday;
  if (d === 0) return { text: "flat", tone: "flat" };
  return { text: `${d > 0 ? "+" : "−"}${Math.abs(d)}${suffix}`, tone: d > 0 ? "up" : "down" };
}

/** Plain words for an outcome: "shown", "held · gate", "held · cooldown", "pending". */
export function outcomeLabel(outcome: string): string {
  if (outcome === "suppressed_gate") return "held · gate";
  if (outcome === "suppressed_agent") return "held · cooldown";
  return outcome;
}

export function reactionLabel(row: Pick<BetaSignalRow, "reaction" | "reaction_reason" | "family">): string {
  if (!row.reaction) return "";
  if (row.reaction === "helpful") return row.family === "protect" ? "agreed" : "right call";
  const why: Record<string, string> = {
    not_happen: "did not happen",
    harmless: "harmless",
    too_late: "too late",
    already_knew: "already knew",
  };
  const base = row.family === "protect" ? "wrong call" : "not that";
  return row.reaction_reason ? `${base} · ${why[row.reaction_reason] ?? row.reaction_reason}` : base;
}

export function waitingFor(createdAt: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(createdAt).getTime());
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function hhmmss(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBeta() {
  const overview = useQuery({ queryKey: ["beta-overview"], queryFn: getBetaOverview, refetchInterval: LIVE_POLL_MS });
  const queue = useQuery({ queryKey: ["beta-review-queue"], queryFn: () => getBetaReviewQueue(10) });
  const apps = useQuery({ queryKey: ["admin-coach-beta-applications"], queryFn: listCoachBetaApplications });
  const health = useQuery({ queryKey: ["beta-health"], queryFn: getBetaHealth, refetchInterval: 30_000 });
  const needsYou = health.data?.needs_you.length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Beta console</h1>
        <p className="mt-1 text-sm text-slate-400">
          Structure only: what fired, what happened to it, how it was received. Never the words, never who.
        </p>
      </header>

      <Tabs defaultValue="live" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-900/60">
          <TabsTrigger value="live">
            Live <Count n={overview.data?.on_air.sessions} />
          </TabsTrigger>
          <TabsTrigger value="review">
            Review <Count n={queue.data?.unreviewed} tone="amber" />
          </TabsTrigger>
          <TabsTrigger value="grants">
            Grants <Count n={apps.data?.pending_count} tone="amber" />
          </TabsTrigger>
          <TabsTrigger value="status">
            Status {needsYou > 0 && <span className="ml-1.5 rounded-full bg-rose-500/20 px-1.5 text-[10px] font-bold text-rose-300">!</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-6">
          <LiveTab />
        </TabsContent>
        <TabsContent value="review">
          <ReviewTab />
        </TabsContent>
        <TabsContent value="grants">
          <GrantsTab />
        </TabsContent>
        <TabsContent value="status">
          <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
            Status lands in the next release: needs-you rows with the actions that exist, per-judge numbers, today by check.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Count({ n, tone = "slate" }: { n: number | undefined; tone?: "slate" | "amber" }) {
  if (!n) return null;
  return (
    <span className={cn("ml-1.5 rounded-full px-1.5 text-[10px] font-bold", tone === "amber" ? "bg-amber-500/20 text-amber-300" : "bg-slate-700 text-slate-200")}>
      {n}
    </span>
  );
}

// ── Live ─────────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, d }: { label: string; value: string; sub?: string; d?: ReturnType<typeof delta> }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-400">
        {sub}
        {d?.text && (
          <span className={cn("ml-1.5", d.tone === "up" ? "text-emerald-400" : d.tone === "down" ? "text-rose-300" : "text-slate-500")}>
            {d.text}
          </span>
        )}
      </p>
    </div>
  );
}

const FEED_CHIPS: { id: string; label: string; f: BetaFeedFilters }[] = [
  { id: "all", label: "All", f: {} },
  { id: "unreviewed", label: "Needs review", f: { reviewed: false } },
  { id: "shown", label: "Shown", f: { outcome: "shown" } },
  { id: "held", label: "Held", f: { outcome: "suppressed" } },
  { id: "reacted", label: "Reacted", f: { reacted: true } },
  { id: "shared", label: "Shared with team", f: { shared: true } },
  { id: "probe", label: "Probe", f: { probe: true } },
  { id: "mine", label: "My own calls", f: { mine: true } },
];

function LiveTab() {
  const overview = useQuery({ queryKey: ["beta-overview"], queryFn: getBetaOverview, refetchInterval: LIVE_POLL_MS });
  const live = useQuery({ queryKey: ["beta-live"], queryFn: getBetaLive, refetchInterval: LIVE_POLL_MS });
  const health = useQuery({ queryKey: ["beta-health"], queryFn: getBetaHealth, refetchInterval: 30_000 });
  const [chip, setChip] = useState("all");
  const [call, setCall] = useState<string | null>(null);
  const filters = useMemo<BetaFeedFilters>(
    () => ({ ...(FEED_CHIPS.find((c) => c.id === chip)?.f ?? {}), ...(call ? { call } : {}) }),
    [chip, call],
  );
  const feed = useQuery({
    queryKey: ["beta-feed", filters],
    queryFn: () => getBetaFeed(filters, undefined, 50),
    refetchInterval: LIVE_POLL_MS,
  });

  const t = overview.data?.today ?? {};
  const y = overview.data?.yesterday ?? {};
  const n = (k: string) => (t[k] as number | null | undefined) ?? 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="On air" value={String(overview.data?.on_air.sessions ?? 0)} sub={`${overview.data?.on_air.coached ?? 0} coached · ${overview.data?.on_air.guardian ?? 0} guardian`} />
        <Stat label="Shown today" value={String(n("shown"))} sub={`of ${n("signals")} · ${t.show_rate_pct ?? 0}% show rate`} d={delta(n("shown"), (y.shown as number) ?? 0)} />
        <Stat label="Reacted" value={`${t.reacted_pct ?? 0}%`} sub={`${n("reacted")} of ${n("shown")} shown`} d={delta(t.reacted_pct as number, y.reacted_pct as number, " pts")} />
        <Stat label="Agree rate" value={t.agree_rate_pct == null ? "—" : `${t.agree_rate_pct}%`} sub={`${n("helpful")} agree · ${n("unhelpful")} wrong`} d={delta(t.agree_rate_pct as number, y.agree_rate_pct as number, " pts")} />
        <Stat label="Unreviewed" value={String(overview.data?.unreviewed ?? 0)} sub={overview.data?.unreviewed ? "needs you" : "all caught up"} />
        <Stat label="Errors" value={String(n("errors"))} sub={`of ${n("evals")} evaluates`} />
      </div>

      {(health.data?.needs_you ?? []).map((row) => (
        <div key={row.id} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", row.severity === "alert" ? "border-rose-500/40 bg-rose-500/[0.06] text-rose-100" : "border-amber-500/40 bg-amber-500/[0.06] text-amber-100")}>
          <span className={cn("h-2 w-2 rounded-full", row.severity === "alert" ? "bg-rose-400" : "bg-amber-400")} />
          <span className="font-medium">{row.title}</span>
          <span className="truncate text-slate-400">{row.detail}</span>
        </div>
      ))}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">On air · {live.data?.sessions.length ?? 0}</h2>
          <span className="text-xs text-slate-500">newest signal per call</span>
        </div>
        {live.data?.sessions.length ? (
          <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
            {live.data.sessions.map((s) => (
              <li key={s.session_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className={cn("h-2 w-2 rounded-full", s.newest?.outcome === "shown" ? "bg-emerald-400" : "bg-slate-500")} />
                <button type="button" onClick={() => setCall(call === s.call ? null : s.call)} className={cn("font-mono", call === s.call ? "text-emerald-300" : "text-slate-100 hover:text-emerald-200")}>
                  {s.call}
                </button>
                <span className="font-mono text-xs text-slate-500">{s.tester}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px]", s.mode === "guardian" ? "bg-sky-500/15 text-sky-300" : "bg-emerald-500/15 text-emerald-300")}>{s.mode}</span>
                {s.team && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] text-slate-300">team</span>}
                {s.probe_armed && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-300">probe armed</span>}
                <span className="ml-auto text-xs text-slate-400">{s.signals} signals · {s.shown} shown</span>
                {s.newest && (
                  <span className="font-mono text-xs text-slate-300">
                    {s.newest.check_id} {s.newest.confidence.toFixed(2)} <span className="text-slate-500">{hhmmss(s.newest.at)}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4 text-center text-sm text-slate-500">No chaperon on a call right now.</p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="mr-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Signal stream</h2>
          {FEED_CHIPS.map((c) => (
            <button key={c.id} type="button" onClick={() => setChip(c.id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs transition", chip === c.id ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800")}>
              {c.label}
            </button>
          ))}
          {call && (
            <button type="button" onClick={() => setCall(null)} className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-200">
              {call} ×
            </button>
          )}
        </div>
        <SignalTable rows={feed.data?.items ?? []} loading={feed.isLoading} />
        <p className="text-xs text-slate-500">
          {feed.data?.items.length ?? 0} signals · last 30 days{feed.data?.next_cursor ? " · more available" : ""}
        </p>
      </section>
    </>
  );
}

function SignalTable({ rows, loading }: { rows: BetaSignalRow[]; loading: boolean }) {
  if (loading) return <p className="px-2 py-4 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>;
  if (rows.length === 0) return <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4 text-center text-sm text-slate-500">Nothing here yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-xs">
        <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Call</th>
            <th className="px-3 py-2"></th>
            <th className="px-3 py-2">Check</th>
            <th className="px-3 py-2">Pattern</th>
            <th className="px-3 py-2">Judge</th>
            <th className="px-3 py-2">Outcome</th>
            <th className="px-3 py-2">Reaction</th>
            <th className="px-3 py-2">Review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.event_id} className={cn("border-t border-slate-800", r.severity === "alert" && "border-l-2 border-l-rose-500", r.severity === "warn" && "border-l-2 border-l-amber-500")}>
              <td className="px-3 py-2 font-mono text-slate-400">{hhmmss(r.at)}</td>
              <td className="px-3 py-2 font-mono">{r.call} <span className="text-slate-500">{r.tester}</span>{r.team && <span className="ml-1 text-slate-500">· team</span>}</td>
              <td className="px-3 py-2">{r.family === "protect" ? <ShieldCheck className="h-3.5 w-3.5 text-rose-300" /> : <Compass className="h-3.5 w-3.5 text-amber-300" />}</td>
              <td className="px-3 py-2 font-mono">{r.check_id} <span className="text-slate-500">{r.confidence.toFixed(2)}</span>{r.probe && <span className="ml-1 rounded-full bg-sky-500/15 px-1.5 text-[10px] text-sky-300">probe</span>}</td>
              <td className="px-3 py-2 text-slate-300">{r.pattern || "—"}</td>
              <td className="px-3 py-2 font-mono text-slate-400">{r.model || r.provider}</td>
              <td className="px-3 py-2 text-slate-300">{outcomeLabel(r.outcome)}</td>
              <td className="px-3 py-2 text-slate-300">{reactionLabel(r)}{r.shared && <span className="ml-1 rounded-full bg-sky-500/15 px-1.5 text-[10px] text-sky-300">shared</span>}</td>
              <td className="px-3 py-2">
                {r.probe ? <span className="text-slate-500">auto</span> : r.review ? <span className={cn("rounded-full px-1.5 text-[10px]", r.review.verdict === "correct" ? "bg-emerald-500/15 text-emerald-300" : r.review.verdict === "wrong" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300")}>{r.review.verdict}</span> : <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] text-amber-300">review</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Review ───────────────────────────────────────────────────────────────────

const TAGS: { id: BetaVerdictTag; label: string }[] = [
  { id: "user_right", label: "User is right" },
  { id: "missed_worse", label: "Missed something worse" },
  { id: "wording_off", label: "Wording off" },
  { id: "rubric_gap", label: "Rubric gap" },
];

function ReviewTab() {
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ["beta-review-queue"], queryFn: () => getBetaReviewQueue(10) });
  const [skipped, setSkipped] = useState<string[]>([]);
  const items = (queue.data?.items ?? []).filter((r) => !skipped.includes(r.event_id));
  const current = items[0];
  const [verdict, setVerdict] = useState<BetaVerdict | null>(null);
  const [tag, setTag] = useState<BetaVerdictTag | null>(null);
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: () => postBetaVerdict({ event_id: current.event_id, verdict: verdict as BetaVerdict, tag: tag ?? undefined, note }),
    onSuccess: () => {
      setVerdict(null);
      setTag(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["beta-review-queue"] });
      void qc.invalidateQueries({ queryKey: ["beta-overview"] });
      void qc.invalidateQueries({ queryKey: ["beta-feed"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save the verdict"),
  });

  if (queue.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!current) return <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">Nothing to review. Flagged cues and low-confidence shown signals come here first.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="uppercase tracking-wider">Reviewing · {queue.data?.unreviewed ?? 0} waiting</span>
          <button type="button" onClick={() => setSkipped((s) => [...s, current.event_id])} className="hover:text-slate-200">Skip for now</button>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-sm">
            {current.family === "protect" ? <ShieldCheck className="h-4 w-4 text-rose-300" /> : <Compass className="h-4 w-4 text-amber-300" />}
            <span className="font-mono font-semibold">{current.check_id}</span>
            <span className="rounded bg-slate-800 px-1.5 font-mono text-xs text-slate-300">{current.confidence.toFixed(2)}</span>
            <span className="ml-auto font-mono text-xs text-slate-500">{current.call} · {current.tester}{current.team ? " · team" : ""}</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Pattern</p>
            <p className="text-lg text-slate-100">{current.pattern || "(the judge gave no pattern)"}</p>
            {current.shared && (
              <p className="mt-2 text-xs text-sky-300">Flagged by the tester with their reaction: they want this one looked at.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 text-xs sm:grid-cols-4">
            {[
              ["Judge", `${current.model || current.provider} · ${current.rubric_version || "—"}`],
              ["Elapsed", `${Math.floor(current.elapsed_sec / 60)}:${String(current.elapsed_sec % 60).padStart(2, "0")}`],
              ["Outcome", outcomeLabel(current.outcome)],
              ["Reaction", reactionLabel(current) || "none"],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-900/60 px-4 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                <p className="text-slate-200">{v}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3 border-t border-slate-800 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Was this call right?</p>
            <div className="grid grid-cols-3 gap-2">
              {(["correct", "wrong", "borderline"] as BetaVerdict[]).map((v) => (
                <button key={v} type="button" onClick={() => setVerdict(v)} className={cn("rounded-lg border px-3 py-2 text-sm capitalize transition", verdict === v ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800")}>
                  {v}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <button key={t.id} type="button" onClick={() => setTag(tag === t.id ? null : t.id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", tag === t.id ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800")}>
                  {t.label}
                </button>
              ))}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the rubric log (optional)" rows={2} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none" />
            <button type="button" disabled={!verdict || save.isPending} onClick={() => save.mutate()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save &amp; next
            </button>
          </div>
        </div>
      </div>
      <aside className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Up next</p>
        {items.slice(1, 6).map((r) => (
          <div key={r.event_id} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs">
            <p className="font-mono text-slate-100">{r.check_id}</p>
            <p className="text-slate-500">{r.call} · {r.confidence.toFixed(2)}{r.shared ? " · shared" : ""}</p>
          </div>
        ))}
      </aside>
    </div>
  );
}

// ── Grants ───────────────────────────────────────────────────────────────────

const DECLINE_REASONS: { id: CoachBetaDeclineReason; label: string }[] = [
  { id: "no_reason", label: "No reason given" },
  { id: "duplicate_device", label: "Duplicate device" },
  { id: "not_yet", label: "Not yet" },
  { id: "other", label: "Other" },
];

function GrantsTab() {
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ["admin-coach-beta-applications"], queryFn: listCoachBetaApplications });
  const decided = useQuery({ queryKey: ["admin-coach-beta-decided"], queryFn: () => listCoachBetaApplicationsBy("all") });
  const [selected, setSelected] = useState<string | null>(null);
  const list = pending.data?.items ?? [];
  const app = list.find((a) => a.user_id === selected) ?? list[0];
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-coach-beta-applications"] });
    void qc.invalidateQueries({ queryKey: ["admin-coach-beta-decided"] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        {app ? <ApplicationCard app={app} onDone={refresh} /> : <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">No pending applications.</p>}
      </div>
      <aside className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Waiting ({list.length})</p>
          <div className="mt-2 space-y-1.5">
            {list.map((a) => (
              <button key={a.id} type="button" onClick={() => setSelected(a.user_id)} className={cn("block w-full rounded-lg border px-3 py-2 text-left text-xs", app?.id === a.id ? "border-emerald-500/50 bg-emerald-500/[0.06]" : "border-slate-800 bg-slate-900/40 hover:bg-slate-800")}>
                <p className="text-slate-100">{a.display_name || a.email}</p>
                <p className="text-slate-500">waiting {waitingFor(a.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Decided</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {(decided.data?.items ?? []).filter((a) => a.status !== "pending").slice(0, 8).map((a) => (
              <li key={a.id} className="text-slate-400">
                <span className="text-slate-200">{a.display_name || a.email}</span> {a.status}{a.decline_reason ? ` · ${a.decline_reason.replace("_", " ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function ApplicationCard({ app, onDone }: { app: CoachBetaApplication; onDone: () => void }) {
  const [calls, setCalls] = useState(1);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState<CoachBetaDeclineReason>("no_reason");
  const grant = useMutation({
    mutationFn: () => grantCoachBeta({ user_id: app.user_id, calls }),
    onSuccess: (r) => { toast.success(`Granted · ${r.calls_remaining} calls now`); onDone(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Grant failed"),
  });
  const decline = useMutation({
    mutationFn: () => declineCoachBeta({ user_id: app.user_id, reason }),
    onSuccess: () => { toast.success("Declined"); setDeclineOpen(false); onDone(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Decline failed"),
  });
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <p className="font-semibold">{app.display_name || app.email}</p>
        {app.is_team && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] text-slate-300">team</span>}
        <span className="ml-auto text-xs text-amber-300">waiting {waitingFor(app.created_at)}</span>
      </div>
      <div className="px-4 py-4">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Why they want in</p>
        <p className="mt-1 text-xl text-slate-100">{app.reason ? `“${app.reason}”` : <span className="text-slate-500">(no reason given)</span>}</p>
        <p className="mt-2 text-xs text-slate-500">{app.email} · {app.calls_remaining} calls now</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 px-4 py-3">
        <div className="inline-flex items-center rounded-lg border border-slate-700">
          <button type="button" aria-label="Fewer" onClick={() => setCalls((c) => Math.max(1, c - 1))} className="px-2 py-1.5 text-slate-300 hover:bg-slate-800"><Minus className="h-4 w-4" /></button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">{calls}</span>
          <button type="button" aria-label="More" onClick={() => setCalls((c) => Math.min(COACH_BETA_MAX_GRANT, c + 1))} className="px-2 py-1.5 text-slate-300 hover:bg-slate-800"><Plus className="h-4 w-4" /></button>
        </div>
        <button type="button" disabled={grant.isPending} onClick={() => grant.mutate()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
          {grant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Grant {calls}
        </button>
        {!declineOpen ? (
          <button type="button" onClick={() => setDeclineOpen(true)} className="rounded-lg border border-rose-500/40 bg-rose-500/[0.06] px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10">Decline</button>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {DECLINE_REASONS.map((r) => (
              <button key={r.id} type="button" onClick={() => setReason(r.id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", reason === r.id ? "border-rose-400/60 bg-rose-500/15 text-rose-100" : "border-slate-700 bg-slate-900 text-slate-300")}>{r.label}</button>
            ))}
            <button type="button" disabled={decline.isPending} onClick={() => decline.mutate()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40">Confirm decline</button>
            <button type="button" onClick={() => setDeclineOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function listCoachBetaApplications() {
  return listCoachBetaApplicationsBy("pending");
}
