/**
 * Squad beta queue: who asked, where they are, how many, what for. Pick a
 * spread of groups (the country counts help), then let them in or decline.
 * Granting is idempotent and audited server-side.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  declineSquadBeta,
  grantSquadBeta,
  listSquadBetaApplications,
  type SquadBetaApplication,
  type SquadBetaDeclineReason,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

const PLAN_LABELS: Record<string, string> = {
  films: "Films",
  games: "Games",
  catch_up: "Catching up",
  trip: "Trip",
  other: "Other",
};

const DECLINE_REASONS: { id: SquadBetaDeclineReason; label: string }[] = [
  { id: "not_yet", label: "Not yet" },
  { id: "full", label: "Beta full" },
  { id: "other", label: "Other" },
];

type Filter = "pending" | "granted" | "declined" | "all";

/** Pure: "KE 3 · NG 2 · ?? 1", biggest first. */
export function countryLine(byCountry: Record<string, number>): string {
  return Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([c, n]) => `${c} ${n}`)
    .join(" · ");
}

export default function AdminSquad() {
  const [filter, setFilter] = useState<Filter>("pending");
  const q = useQuery({
    queryKey: ["admin-squad-beta", filter],
    queryFn: () => listSquadBetaApplications(filter),
  });
  const counts = q.data?.counts;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Squad beta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Requests for Squad (friend nights, 2 to 5 people). Oldest first.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Waiting" value={counts?.pending} />
        <Stat label="Let in" value={counts?.with_access} />
        <Stat label="Declined" value={counts?.declined} />
        <div className="rounded-lg border border-white/[0.08] bg-card/40 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Waiting by country</p>
          <p className="mt-1 text-sm text-cream">{counts ? countryLine(counts.pending_by_country) || "None" : "—"}</p>
        </div>
      </div>

      <div className="flex gap-1.5" role="tablist" aria-label="Filter requests">
        {(["pending", "granted", "declined", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize",
              filter === f ? "border-primary/60 bg-primary/15 text-cream" : "border-white/[0.14] text-cream/70 hover:bg-white/[0.06]",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />}
      {q.data && q.data.items.length === 0 && (
        <p className="rounded-lg border border-white/[0.08] bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground/70">
          Nothing here.
        </p>
      )}
      <div className="space-y-3">
        {q.data?.items.map((app) => <RequestCard key={app.id} app={app} />)}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-card/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  );
}

function RequestCard({ app }: { app: SquadBetaApplication }) {
  const qc = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState<SquadBetaDeclineReason>("not_yet");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-squad-beta"] });
  const grant = useMutation({
    mutationFn: () => grantSquadBeta({ user_id: app.user_id }),
    onSuccess: () => { toast.success(`${app.display_name || app.email} is in`); refresh(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Grant failed"),
  });
  const decline = useMutation({
    mutationFn: () => declineSquadBeta({ user_id: app.user_id, reason }),
    onSuccess: () => { toast.success("Declined"); setDeclineOpen(false); refresh(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Decline failed"),
  });

  return (
    <div className="rounded-lg border border-white/[0.08] bg-card/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-4 py-3">
        <p className="font-semibold">{app.display_name || app.email}</p>
        {app.is_team && <span className="rounded-full bg-white/[0.12] px-2 py-0.5 text-[11px] text-cream/80">team</span>}
        <span className="text-xs text-muted-foreground">{app.email}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(app.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          {app.status !== "pending" && ` · ${app.status}${app.decline_reason ? ` (${app.decline_reason.replace("_", " ")})` : ""}`}
        </span>
      </div>
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-3">
        <Field label="Where" value={`${app.city}${app.country ? `, ${app.country}` : ""}`} />
        <Field label="How many" value={`${app.group_size} people`} />
        <Field label="For" value={app.plans.map((p) => PLAN_LABELS[p] ?? p).join(", ")} />
        {app.note && (
          <div className="sm:col-span-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Note</p>
            <p className="mt-1 text-cream">&ldquo;{app.note}&rdquo;</p>
          </div>
        )}
      </div>
      {app.status === "pending" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.08] px-4 py-3">
          <button
            type="button"
            disabled={grant.isPending}
            onClick={() => grant.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground neon-btn hover:bg-primary/90 disabled:opacity-40"
          >
            {grant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Let them in
          </button>
          {!declineOpen ? (
            <button type="button" onClick={() => setDeclineOpen(true)} className="rounded-lg border border-rose-500/40 bg-rose-500/[0.06] px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10">
              Decline
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {DECLINE_REASONS.map((r) => (
                <button key={r.id} type="button" onClick={() => setReason(r.id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", reason === r.id ? "border-rose-400/60 bg-rose-500/15 text-rose-100" : "border-white/[0.14] bg-card text-cream/80")}>
                  {r.label}
                </button>
              ))}
              <button type="button" disabled={decline.isPending} onClick={() => decline.mutate()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40">
                Confirm decline
              </button>
              <button type="button" onClick={() => setDeclineOpen(false)} className="text-xs text-muted-foreground hover:text-cream">
                Cancel
              </button>
            </div>
          )}
          <span className="text-xs text-muted-foreground/70">They only ever see &ldquo;not this round&rdquo;.</span>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-cream">{value}</p>
    </div>
  );
}
