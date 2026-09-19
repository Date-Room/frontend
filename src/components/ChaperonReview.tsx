/**
 * "From your chaperon" on the recap: the private review, restructured.
 *
 * One serif line (the headline), then Protect and Coach as two cards with
 * what each did (counts from the server, moments and the tip from the
 * judge), the viewer's test named as theirs, and "Was this review fair?"
 * as the third label the learning loop reads (judge → reaction → review).
 * Per-viewer private: the other person has their own, or none.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Lightbulb, ShieldCheck } from "lucide-react";
import {
  getCoachBetaStatus,
  getProtectStatus,
  protectPill,
  rateChaperonDebrief,
  type ChaperonDebriefResponse,
  type DebriefRating,
} from "@/lib/chaperon";
import { cn } from "@/lib/utils";

/** Pure: how the Protect card reads. */
export function protectSummary(
  counts: { protect: number },
  safety: "all_clear" | "flagged",
  probeCaught: boolean,
): { pill: string; tone: "clear" | "flagged"; test: string | null } {
  const test = probeCaught ? "I caught your test and set it aside." : null;
  if (safety === "flagged") {
    return {
      pill: `${counts.protect} flag${counts.protect === 1 ? "" : "s"}`,
      tone: "flagged",
      test,
    };
  }
  return { pill: "All clear", tone: "clear", test };
}

const RATINGS: { id: DebriefRating; label: string }[] = [
  { id: "fair", label: "Yes" },
  { id: "mostly", label: "Mostly" },
  { id: "unfair", label: "No" },
];

export function ChaperonReview({
  roomId,
  res,
  partnerName,
}: {
  roomId: string;
  res: ChaperonDebriefResponse;
  partnerName: string | null;
}) {
  const qc = useQueryClient();
  const debrief = res.debrief;
  const coached = res.mode === "coached" || res.mode === "wing";
  const [rating, setRating] = useState<DebriefRating | null>(res.rating ?? null);
  const rate = useMutation({
    mutationFn: (r: DebriefRating) => rateChaperonDebrief(roomId, r),
    onSuccess: (_d, r) => {
      setRating(r);
      void qc.invalidateQueries({ queryKey: ["chaperon-debrief", roomId] });
    },
  });
  // Next-date lines come from the entitlements the person already has.
  const { data: protect } = useQuery({ queryKey: ["protect-status"], queryFn: getProtectStatus });
  const { data: coach } = useQuery({ queryKey: ["coach-beta-status"], queryFn: getCoachBetaStatus });

  if (!debrief) return null;
  const p = protectSummary(res.counts, debrief.safety, res.probe_caught);
  const them = partnerName?.trim() || "your date";
  const pill = protectPill(protect);

  return (
    <section className="mb-8 animate-float-up" aria-label="From your chaperon">
      <p className="mb-2 flex items-center gap-1.5 px-1 text-label uppercase tracking-[0.28em] text-emerald-300/80">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Private review · only you
      </p>
      <h2 className="mb-4 px-1 font-serif text-display italic leading-snug text-cream">
        {debrief.headline}
      </h2>

      <div className="space-y-3">
        {/* Protect */}
        <div
          className={cn(
            "rounded-2xl border px-4 py-3",
            p.tone === "flagged"
              ? "border-rose-500/35 bg-rose-500/[0.07]"
              : "border-emerald-500/30 bg-emerald-500/[0.06]",
          )}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={cn("h-4 w-4", p.tone === "flagged" ? "text-rose-300" : "text-emerald-400")}
              aria-hidden
            />
            <p className="text-body font-semibold text-cream">Protect</p>
            <span
              className={cn(
                "ml-auto rounded-full px-2 py-0.5 text-label font-semibold uppercase tracking-wide",
                p.tone === "flagged"
                  ? "bg-rose-500/15 text-rose-300"
                  : "bg-emerald-500/15 text-emerald-300",
              )}
            >
              {p.pill}
            </span>
          </div>
          {p.test && <p className="mt-1.5 text-body text-cream/85">{p.test}</p>}
          {debrief.moments.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {debrief.moments.map((m) => (
                <li key={m} className="flex items-start gap-2.5 text-body text-cream/85">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cream/40" aria-hidden />
                  {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-body text-muted-foreground">
              Nothing to flag with {them}: no pressure, no push to move off DateRoom, no money
              talk.
            </p>
          )}
        </div>

        {/* Coach, only when it ran */}
        {coached && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-amber-400" aria-hidden />
              <p className="text-body font-semibold text-cream">Coach</p>
              <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-label font-semibold uppercase tracking-wide text-amber-300">
                {res.counts.coach} nudge{res.counts.coach === 1 ? "" : "s"}
              </span>
            </div>
            {debrief.tip ? (
              <p className="mt-1.5 flex items-start gap-2 text-body text-cream/85">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" aria-hidden />
                {debrief.tip}
              </p>
            ) : (
              <p className="mt-1.5 text-body text-muted-foreground">Nothing to add this time.</p>
            )}
          </div>
        )}
        {!coached && debrief.tip && (
          <p className="flex items-start gap-2 px-1 text-body text-muted-foreground">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cream/50" aria-hidden />
            {debrief.tip}
          </p>
        )}

        {/* The third label */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <p className="text-body text-cream">Was this review fair?</p>
          <div className="mt-2 flex gap-2" role="group" aria-label="Was this review fair?">
            {RATINGS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={rating === r.id}
                disabled={rate.isPending}
                onClick={() => rate.mutate(r.id)}
                className={cn(
                  "focus-ring rounded-full border px-4 py-1.5 text-body transition disabled:opacity-60",
                  rating === r.id
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                    : "border-white/15 bg-white/[0.04] text-cream/85 hover:bg-white/10",
                )}
              >
                {r.label}
              </button>
            ))}
            {rating && <span className="self-center text-label text-muted-foreground">Thanks.</span>}
          </div>
        </div>

        {/* Next date */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-body text-cream">Next date</p>
            <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-label font-semibold uppercase tracking-wide text-cream/70">
              Protect · {pill.label}
              {coach && coach.calls_remaining > 0
                ? ` · Coach · ${coach.calls_remaining} call${coach.calls_remaining === 1 ? "" : "s"}`
                : ""}
            </span>
          </div>
          <p className="mt-1 text-label text-muted-foreground">
            {pill.tone === "empty"
              ? "Your free Protect date is used. Protect comes with the Chaperoned Datepack."
              : "Turn it on from the room before your next date."}
          </p>
        </div>
      </div>
    </section>
  );
}
