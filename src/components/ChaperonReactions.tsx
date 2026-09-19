/**
 * Word reactions on a whisper, and the one question behind "Wrong call".
 *
 * Protect (alert / warn): Agree · Wrong call. Coach (note / info): Right
 * call · Not that. Words are better labels than thumbs, and the negative
 * one asks a single why (did not happen / harmless / too late / already
 * knew) plus an off-by-default "flag this for the team" tick. The reason is
 * the label the learning loop was missing; the tick puts this cue at the
 * front of the team's review queue. No words travel: the team sees the
 * check, a pattern code, the reason and the outcome, never the whisper.
 *
 * The rail and the toast render the same component so a whisper is rated
 * once, from either place, and the chosen word stays put.
 */
import { useState } from "react";
import { Compass, ShieldCheck } from "lucide-react";
import type { ChaperonSeverity, ChaperonSignal, ReactionReason } from "@/lib/chaperon";
import { cn } from "@/lib/utils";

export type Rating = "up" | "down";

export type ReactionDetail = { reason?: ReactionReason; shareWithTeam?: boolean };

/** Pure: which rubric family a severity belongs to. */
export function familyOf(severity: ChaperonSeverity): "protect" | "coach" {
  return severity === "alert" || severity === "warn" ? "protect" : "coach";
}

/** Pure: "money_ask" → "Money ask". */
export function checkLabel(checkId: string): string {
  const words = checkId.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Chaperon";
}

export const REASONS: { id: ReactionReason; label: string }[] = [
  { id: "not_happen", label: "That did not happen" },
  { id: "harmless", label: "It happened, it was fine" },
  { id: "too_late", label: "Too late to be useful" },
  { id: "already_knew", label: "I already knew" },
];

export function FamilyIcon({ severity, className }: { severity: ChaperonSeverity; className?: string }) {
  return familyOf(severity) === "protect" ? (
    <ShieldCheck className={className} aria-hidden />
  ) : (
    <Compass className={className} aria-hidden />
  );
}

export function ChaperonReactions({
  signal,
  rated,
  onRate,
  size = "md",
}: {
  signal: ChaperonSignal;
  rated: Rating | undefined;
  onRate: (helpful: boolean, detail?: ReactionDetail) => void;
  size?: "sm" | "md";
}) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<ReactionReason | null>(null);
  const [share, setShare] = useState(false);
  const protect = familyOf(signal.severity) === "protect";
  const yes = protect ? "Agree" : "Right call";
  const no = protect ? "Wrong call" : "Not that";
  const chip = cn(
    "focus-ring rounded-full border transition disabled:opacity-60",
    size === "sm" ? "px-2.5 py-0.5 text-label" : "px-3 py-1 text-label",
  );

  // A probe is the viewer's own test: nothing to rate.
  if (signal.probe || !signal.event_id) return null;

  if (rated) {
    return (
      <span className="text-label text-cream/60">
        {rated === "up" ? `${yes}d` : "Noted. I will adjust."}
      </span>
    );
  }

  if (asking) {
    return (
      <div className="w-full space-y-2" role="group" aria-label="What did I get wrong?">
        <p className="text-label font-medium text-cream/80">What did I get wrong?</p>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              aria-pressed={reason === r.id}
              className={cn(
                chip,
                reason === r.id
                  ? "border-rose-300/60 bg-rose-500/20 text-rose-100"
                  : "border-white/15 bg-white/[0.06] text-cream/85 hover:bg-white/10",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="flex items-start gap-2 text-label leading-snug text-cream/70">
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-emerald-500"
          />
          <span>
            Flag this for the DateRoom team to look at. They see what kind of cue it was and
            your reason, never the words.
          </span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onRate(false, { reason: reason ?? undefined, shareWithTeam: share })
            }
            className={cn(chip, "border-transparent bg-primary font-semibold text-primary-foreground")}
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => onRate(false)}
            className={cn(chip, "border-white/15 text-cream/70 hover:bg-white/10")}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onRate(true)}
        className={cn(chip, "border-white/15 bg-white/[0.06] text-cream/90 hover:bg-white/10")}
      >
        {yes}
      </button>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={cn(chip, "border-white/15 bg-white/[0.06] text-cream/90 hover:bg-white/10")}
      >
        {no}
      </button>
    </div>
  );
}
