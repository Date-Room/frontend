import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  RANK_ROUNDS,
  compareRankings,
  initialRankItState,
  rankItFromJson,
  rankItIsFinished,
  rankOf,
  reduceRankIt,
} from "@/lib/activities/rankIt";

/**
 * Rank It — order five things secretly, reveal side by side. The reveal
 * leads with where you're furthest apart, because that's the conversation.
 * Reordering is arrow-based (Capacitor-safe; no drag).
 */
export function RankIt() {
  const { state, emit, senderId } = useReducedActivity(
    "rank_it",
    initialRankItState,
    rankItFromJson,
    reduceRankIt,
  );

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  // My local draft order while ranking (item indices, position 0 = rank 1).
  const [draft, setDraft] = useState<number[]>([]);
  useEffect(() => {
    const n = RANK_ROUNDS[state.round]?.items.length ?? 0;
    setDraft(Array.from({ length: n }, (_, i) => i));
  }, [state.round]);

  if (rankItIsFinished(state)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center animate-fade-in">
        <p className="font-serif text-2xl italic text-cream">{RANK_ROUNDS.length} rounds of priorities</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          You've each seen what the other puts first. That's more than most first dates manage.
        </p>
        <Button onClick={() => emit("restart")} className={accentBtn} style={accentStyle}>
          Play again
        </Button>
      </div>
    );
  }

  const round = RANK_ROUNDS[state.round];
  const mine = state.rankings[senderId];
  const otherEntry = Object.entries(state.rankings).find(([uid]) => uid !== senderId);
  const theirs = otherEntry?.[1];
  const submitted = mine != null;
  const revealing = state.phase === "revealing";

  const header = (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Round {state.round + 1} of {RANK_ROUNDS.length} · {round.title}
      </p>
      <p className="font-serif text-xl italic text-cream">{revealing ? "Side by side" : round.prompt}</p>
    </div>
  );

  if (revealing && mine && theirs) {
    const { closest, furthest, furthestGap } = compareRankings(mine, theirs);
    return (
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        {header}
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          {mine.map((item) => {
            const myRank = rankOf(mine, item);
            const theirRank = rankOf(theirs, item);
            const isClosest = item === closest;
            const isFurthest = item === furthest && furthestGap > 0;
            return (
              <div
                key={item}
                className={[
                  "rounded-2xl border p-3.5 transition-all",
                  isFurthest
                    ? "border-rose/50 bg-rose/10"
                    : isClosest
                      ? "border-primary/50 bg-primary/10"
                      : "border-white/[0.08] bg-white/[0.02]",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{round.items[item].emoji}</span>
                  <span className="flex-1 text-sm text-cream">{round.items[item].label}</span>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground tabular-nums">
                    you #{myRank} · them #{theirRank}
                  </span>
                </div>
                {/* Two mirrored bars: longer = ranked higher. */}
                <div className="mt-2 flex flex-col gap-1">
                  <div className="h-1.5 rounded-full bg-primary/70" style={{ width: `${(round.items.length + 1 - myRank) * (100 / round.items.length)}%` }} />
                  <div className="h-1.5 rounded-full bg-rose/70" style={{ width: `${(round.items.length + 1 - theirRank) * (100 / round.items.length)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm text-cream/80 max-w-xs leading-relaxed">
            {furthestGap === 0 ? (
              <>Identical rankings. Either soulmates or someone&apos;s copying. 👀</>
            ) : (
              <>
                Furthest apart: <span className="text-rose font-medium">{round.items[furthest].label}</span>. Tell
                each other why.
              </>
            )}
          </p>
          <Button
            onClick={() => emit("next_round", { round: state.round })}
            className={accentBtn}
            style={accentStyle}
          >
            {state.round + 1 >= RANK_ROUNDS.length ? "Finish" : "Next round"}
          </Button>
        </div>
      </div>
    );
  }

  // Ranking phase.
  const move = (pos: number, dir: -1 | 1) => {
    setDraft((d) => {
      const next = [...d];
      const swap = pos + dir;
      if (swap < 0 || swap >= next.length) return d;
      [next[pos], next[swap]] = [next[swap], next[pos]];
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in">
      {header}
      <p className="text-center text-xs text-muted-foreground">
        {submitted ? "Locked in. They can't see it yet." : "Your date can't see your order until you both lock in."}
      </p>
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        {draft.map((item, pos) => (
          <div
            key={item}
            className={[
              "flex items-center gap-3 rounded-2xl border p-3.5 transition-all",
              submitted ? "border-white/[0.08] bg-white/[0.02] opacity-70" : "border-white/[0.10] bg-white/[0.03]",
            ].join(" ")}
          >
            <span className="w-6 text-center text-sm font-semibold text-primary tabular-nums">{pos + 1}</span>
            <span className="text-xl">{round.items[item].emoji}</span>
            <span className="flex-1 text-sm text-cream">{round.items[item].label}</span>
            {!submitted && (
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(pos, -1)}
                  disabled={pos === 0}
                  aria-label={`Move ${round.items[item].label} up`}
                  className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-muted-foreground transition hover:border-primary/50 hover:text-cream disabled:opacity-25"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(pos, 1)}
                  disabled={pos === draft.length - 1}
                  aria-label={`Move ${round.items[item].label} down`}
                  className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-muted-foreground transition hover:border-primary/50 hover:text-cream disabled:opacity-25"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="min-h-[3rem] flex items-center justify-center">
        {submitted ? (
          <p className="text-sm text-muted-foreground animate-pulse">waiting for their ranking…</p>
        ) : (
          <Button
            onClick={() =>
              emit(
                "submit_ranking",
                { round: state.round, order: draft },
                {
                  event_type: "ranked",
                  payload: {
                    text: `${round.title} · #1 ${round.items[draft[0]].label}`,
                  },
                },
              )
            }
            className={accentBtn}
            style={accentStyle}
          >
            Lock it in
          </Button>
        )}
      </div>
    </div>
  );
}
