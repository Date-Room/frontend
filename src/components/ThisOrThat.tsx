import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  TOT_CLOCK_SECONDS,
  TOT_ROUNDS_PER_RUN,
  initialTotState,
  reduceTot,
  totFromJson,
  totRunDone,
  totSetForRun,
  type TotSide,
} from "@/lib/activities/thisOrThat";
import { useCinematic, type CinematicStep } from "@/lib/stagecraft/cinematic";
import { Scoreboard } from "@/lib/stagecraft/Scoreboard";
import { StagePrompt } from "@/lib/stagecraft/StagePrompt";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";

/**
 * This or That — the run. Two halves own the room; a 7s clock pressures the
 * pick (expiring costs nothing, the hesitation is the insight); you call
 * their side before the reveal; the halves tug on the verdict — same side
 * and both tags land on one swelling half, split and they pull apart.
 */

const REVEAL_STEPS: CinematicStep[] = [
  { id: "dim", at: 0 },
  { id: "theirs", at: 900 },
  { id: "verdict", at: 2100 },
];

export function ThisOrThat() {
  const { state, emit, senderId } = useReducedActivity(
    "this_or_that",
    initialTotState,
    totFromJson,
    reduceTot,
  );
  const partnerName = usePartnerName();

  const set = totSetForRun(state.run);
  const roundIndex = Math.min(state.round, TOT_ROUNDS_PER_RUN - 1);
  const pair = set[roundIndex];
  const board = totRunDone(state);

  const myPick = state.picks[senderId];
  const myPrediction = state.predictions[senderId];
  const otherPickEntry = Object.entries(state.picks).find(([uid]) => uid !== senderId);
  const theirPick = otherPickEntry?.[1];
  const revealing = !board && state.phase === "revealing";

  const { stage, witnessed } = useCinematic(revealing, REVEAL_STEPS);
  const revealRank = revealing ? (witnessed ? { dim: 0, theirs: 1, verdict: 2 }[stage ?? "dim"] ?? 0 : 2) : -1;
  const theirsLit = revealRank >= 1;
  const settled = revealRank >= 2;

  const myReads = state.reads[senderId] ?? 0;
  const theirReads = Object.entries(state.reads).reduce((n, [k, v]) => (k === senderId ? n : n + v), 0);
  const roundsDone = state.log.length + (revealing ? 1 : 0);

  // The 7s clock: purely local, purely cosmetic — expiring costs nothing.
  const [clock, setClock] = useState(TOT_CLOCK_SECONDS);
  const startedAt = useRef(Date.now());
  useEffect(() => {
    if (board || revealing || myPick != null) return;
    startedAt.current = Date.now();
    setClock(TOT_CLOCK_SECONDS);
    const id = window.setInterval(() => setClock((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.round, state.run, board, myPick != null]);

  const sameSide = revealing && myPick != null && myPick === theirPick;
  const iReadThem = revealing && myPrediction != null && myPrediction === theirPick;
  const theyReadMe =
    revealing && otherPickEntry != null && state.predictions[otherPickEntry[0]] === myPick;

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  const scoreboard = (
    <Scoreboard
      label="Reads"
      entries={[
        { name: "You", value: myReads, accent: true },
        { name: partnerName, value: theirReads },
      ]}
    />
  );

  if (board) {
    const players = Object.keys(state.reads);
    const longestFor = (uid: string) => {
      let best = { ms: -1, i: 0 };
      state.log.forEach((r, i) => {
        const v = r.ms[uid] ?? -1;
        if (v > best.ms) best = { ms: v, i };
      });
      return best;
    };
    const mySlow = longestFor(senderId);
    const theirUid = players.find((p) => p !== senderId) ?? otherPickEntry?.[0];
    const theirSlow = theirUid ? longestFor(theirUid) : null;
    return (
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-serif text-2xl italic text-cream">How you two line up</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {state.same_count >= 4
              ? "You want almost the same life. Check the one you didn't."
              : state.same_count <= 1
                ? "You disagree on nearly everything and you're still here."
                : `Same side ${state.same_count} of ${TOT_ROUNDS_PER_RUN}. The splits are the interesting part.`}
          </p>
        </div>
        {scoreboard}
        <div className="flex flex-1 flex-col gap-2">
          {state.log.map((r, i) => {
            const p = set[i];
            const mine = r.picks[senderId];
            const theirs = Object.entries(r.picks).find(([uid]) => uid !== senderId)?.[1];
            const same = mine != null && mine === theirs;
            const sideLabel = (s: TotSide | undefined) => (s === "a" ? p.a : s === "b" ? p.b : null);
            return (
              <div
                key={i}
                className={[
                  "rounded-2xl border p-3",
                  same ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/[0.10] bg-white/[0.03]",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 text-sm text-cream/90">
                    {p.a.label} <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">or</span> {p.b.label}
                  </span>
                  <span className="rounded-full border border-primary/50 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-primary">
                    you · {sideLabel(mine)?.emoji}
                  </span>
                  <span className="rounded-full border border-rose/50 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-rose">
                    {partnerName} · {sideLabel(theirs)?.emoji}
                  </span>
                </div>
                {!same && <p className="mt-1.5 text-xs text-muted-foreground">{p.split}</p>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
          {mySlow.ms > 800 && (
            <p>
              You hesitated longest on {set[mySlow.i].a.label} or {set[mySlow.i].b.label} · {(mySlow.ms / 1000).toFixed(1)}s. The pause said something.
            </p>
          )}
          {theirSlow && theirSlow.ms > 800 && (
            <p>
              {partnerName} paused longest on {set[theirSlow.i].a.label} or {set[theirSlow.i].b.label} · {(theirSlow.ms / 1000).toFixed(1)}s.
            </p>
          )}
        </div>
        <div className="flex justify-center">
          <Button onClick={() => emit("new_run")} className={accentBtn} style={accentStyle}>
            Run a new set
          </Button>
        </div>
      </div>
    );
  }

  const title = revealing
    ? settled
      ? sameSide ? "Same side" : "Split"
      : theirsLit
        ? `${partnerName}'s side`
        : "Both locked"
    : myPick == null
      ? "Pick fast"
      : myPrediction == null
        ? `Now call ${partnerName}'s`
        : "Locked in";

  const status = revealing
    ? settled
      ? `${sameSide ? pair.together : pair.split}${iReadThem ? " And you read them right." : ` You had ${partnerName} on the other side.`}`
      : theirsLit
        ? "Watch which one lights."
        : "Neither of you can change it now."
    : myPick == null
      ? "Don't think it through. The clock is the point."
      : myPrediction == null
        ? `Before you see it — which side did ${partnerName} take?`
        : `waiting for ${partnerName}…`;

  const tap = (side: TotSide) => {
    if (revealing) return;
    if (myPick == null) {
      emit("pick", { round: state.round, side, ms: Date.now() - startedAt.current });
    } else if (myPrediction == null) {
      emit(
        "predict",
        { round: state.round, side },
        { event_type: "called", payload: { text: `${pair.a.label} or ${pair.b.label}` } },
      );
    }
  };

  const half = (side: TotSide) => {
    const opt = side === "a" ? pair.a : pair.b;
    const isMine = myPick === side;
    const isMyCall = myPrediction === side;
    const isTheirs = revealing && theirsLit && theirPick === side;
    const litSame = settled && sameSide && isMine;
    const fadedOut = revealing && theirsLit && !isMine && !isTheirs;
    const clickable = !revealing && (myPick == null || myPrediction == null);
    return (
      <button
        type="button"
        disabled={!clickable}
        onClick={() => tap(side)}
        className={[
          "dr-half focus-ring relative flex min-h-[9rem] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center",
          litSame
            ? "dr-half--swell border-emerald-400/60 bg-emerald-400/10"
            : isMine && isTheirs
              ? "border-emerald-400/60 bg-emerald-400/10"
              : isMine
                ? "border-primary bg-primary/10"
                : isTheirs
                  ? "border-rose/60 bg-rose/10 dr-half--lit"
                  : fadedOut
                    ? "border-white/[0.08] bg-white/[0.02] opacity-30 saturate-50"
                    : "border-white/[0.10] bg-white/[0.03]",
          settled && !sameSide && (isMine || isTheirs) ? (side === "a" ? "dr-half--tug-l" : "dr-half--tug-r") : "",
          clickable ? "hover:-translate-y-1 hover:border-primary/50 cursor-pointer" : "",
        ].join(" ")}
      >
        <span className="text-4xl" aria-hidden>{opt.emoji}</span>
        <span className="font-serif text-lg sm:text-xl italic leading-tight text-cream">{opt.label}</span>
        <span className="flex min-h-[1.3rem] flex-wrap justify-center gap-1.5">
          {isMine && (
            <span className="rounded-full border border-primary/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-primary">you</span>
          )}
          {isMyCall && !revealing && (
            <span className="rounded-full border border-rose/50 border-dashed px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-rose">your call</span>
          )}
          {isTheirs && (
            <span className="rounded-full border border-rose/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-rose">{partnerName}</span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className={["dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in", revealing && witnessed && !settled ? "dr-stageroom--dim" : ""].join(" ")}>
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Round {Math.min(roundsDone + (revealing ? 0 : 1), TOT_ROUNDS_PER_RUN)} of {TOT_ROUNDS_PER_RUN} · {pair.tier}
        </p>
        <p key={title} className="font-serif text-xl italic text-cream animate-fade-in">{title}</p>
        <p key={status} aria-live="polite" className="min-h-[1rem] max-w-sm text-xs text-muted-foreground animate-fade-in">{status}</p>
      </div>

      {!revealing && myPick != null && myPrediction == null && (
        <StagePrompt
          id={`tot-call-${state.run}-${state.round}`}
          lead="✓ Your pick is locked"
          text={`Now tap the side you think ${partnerName} took.`}
        />
      )}

      <div className="relative flex flex-1 flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {half("a")}
        <span className="self-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">or</span>
        {half("b")}
      </div>

      <div className="relative flex min-h-[4.5rem] flex-col items-center justify-center gap-2">
        {!revealing && myPick == null && (
          <div className="dr-ring" style={{ ["--p" as string]: clock / TOT_CLOCK_SECONDS }}>
            <span className="font-serif">{clock}</span>
          </div>
        )}
        {settled && (
          <div className="flex flex-col items-center gap-2 animate-fade-in">
            <p className={["text-xs", theyReadMe ? "text-rose" : "text-muted-foreground"].join(" ")}>
              {theyReadMe ? `👀 ${partnerName} read you too.` : `${partnerName} thought you'd go the other way.`}
            </p>
            {scoreboard}
            <Button
              onClick={() =>
                emit(
                  "next_round",
                  { round: state.round },
                  {
                    event_type: "pair",
                    payload: {
                      text: `${pair.a.label} or ${pair.b.label} · ${sameSide ? "same side" : "split"}${iReadThem ? " · read them right" : ""}`,
                    },
                  },
                )
              }
              className={accentBtn}
              style={accentStyle}
            >
              {state.round + 1 >= TOT_ROUNDS_PER_RUN ? "See how you line up" : "Next pair"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
