import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  OHTG_ROUNDS,
  initialOhtgState,
  ohtgFromJson,
  ohtgIsFinished,
  ohtgRevealSteps,
  reduceOhtg,
} from "@/lib/activities/oneHasToGo";
import { useCinematic } from "@/lib/stagecraft/cinematic";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";

/**
 * One Has To Go — staged reveal built on the stamp. Your own cut stamps the
 * moment you tap it (no take-backs); the reveal then plays as beats: your
 * guess pins, their cut slams down, the read verdict lands, then the mirror
 * (did they read you). Pacing tightens as the ten-round arc deepens.
 *
 * Presentation only over the shared reducer; reload mid-reveal lands on the
 * settled board (stagecraft witnessed-live rule).
 */

const STAGE_RANK: Record<string, number> = { pin: 0, stamp: 1, verdict: 2, mirror: 3, settle: 4 };

export function OneHasToGo() {
  const { state, emit, senderId } = useReducedActivity(
    "one_has_to_go",
    initialOhtgState,
    ohtgFromJson,
    reduceOhtg,
  );
  const partnerName = usePartnerName();

  const myReads = state.reads[senderId] ?? 0;
  const theirReads = Object.entries(state.reads).reduce(
    (n, [k, v]) => (k === senderId ? n : n + v),
    0,
  );

  const readsBar = (
    <div className="flex justify-center gap-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      <span>Reads · you {myReads}</span>
      <span>·</span>
      <span>{partnerName} {theirReads}</span>
    </div>
  );

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  const revealing = !ohtgIsFinished(state) && state.phase === "revealing";
  const { stage, witnessed } = useCinematic(revealing, ohtgRevealSteps(Math.min(state.round, OHTG_ROUNDS.length - 1)));
  // Reveal progress: -1 before the show, 4 (settle) when hydrated mid-reveal.
  const rank = revealing ? (witnessed ? STAGE_RANK[stage ?? "pin"] ?? 0 : 4) : -1;

  if (ohtgIsFinished(state)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center animate-fade-in">
        <p className="font-serif text-2xl italic text-cream">That&apos;s all {OHTG_ROUNDS.length} rounds</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {myReads === theirReads
            ? "You read each other equally well. Or equally badly."
            : myReads > theirReads
              ? `You read ${partnerName} better than they read you. For now.`
              : `${partnerName} read you better than you read them. Worth fixing.`}
        </p>
        {readsBar}
        <Button onClick={() => emit("restart")} className={accentBtn} style={accentStyle}>
          Play again
        </Button>
      </div>
    );
  }

  const round = OHTG_ROUNDS[state.round];
  const myCut = state.cuts[senderId];
  const otherCutEntry = Object.entries(state.cuts).find(([uid]) => uid !== senderId);
  const theirCut = otherCutEntry?.[1];
  const myGuess = state.guesses[senderId];
  const iCut = myCut != null;
  const iGuessed = myGuess != null;
  const guessing = state.phase === "guessing";
  const sameCut = revealing && myCut === theirCut;
  const iReadThem = revealing && myGuess === theirCut;
  const theyReadMe =
    revealing && otherCutEntry != null && state.guesses[otherCutEntry[0]] === myCut;

  const theirStampShown = rank >= 1;
  const verdictShown = rank >= 2;
  const mirrorShown = rank >= 3;
  const settled = rank >= 4;

  const title = !revealing
    ? guessing
      ? "Read their mind"
      : "One has to go"
    : settled
      ? sameCut
        ? round.matchLine
        : round.clashLine
      : rank === 0
        ? "Before the truth…"
        : "The cut lands";

  const status = !revealing
    ? guessing
      ? iGuessed
        ? "Guess locked. No changing your mind."
        : `Which one did ${partnerName} cut?`
      : iCut
        ? "Locked in. No take-backs."
        : round.lead
    : settled
      ? "Defend your decisions."
      : rank === 0 && myGuess != null
        ? `You think ${partnerName} cut ${round.options[myGuess].label}…`
        : "";

  const onOption = (i: number) => {
    if (state.phase === "cutting" && !iCut) {
      emit(
        "cut",
        { round: state.round, option: i },
        {
          event_type: "eliminated",
          payload: { text: `${round.title} · cut ${round.options[i].label}` },
        },
      );
    } else if (guessing && !iGuessed) {
      emit("guess", { round: state.round, option: i });
    }
  };

  const nextRound = () => {
    const readsLine = sameCut
      ? "same cut"
      : [iReadThem ? `you read ${partnerName} right` : `${partnerName} surprised you`,
         theyReadMe ? `${partnerName} read you` : `your pick surprised ${partnerName}`].join(" · ");
    emit(
      "next_round",
      { round: state.round },
      { event_type: "reads", payload: { text: `${round.title} · ${readsLine}` } },
    );
  };

  return (
    <div className={["dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in", revealing && witnessed && !settled ? "dr-stageroom--dusk" : ""].join(" ")}>
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Round {state.round + 1} of {OHTG_ROUNDS.length} · {round.title}
        </p>
        <p className="font-serif text-xl italic text-cream">{title}</p>
        <p key={status} className="min-h-[1rem] text-xs text-muted-foreground animate-fade-in">{status}</p>
      </div>

      <div className="relative flex flex-1 flex-col justify-center gap-3">
        {round.options.map((opt, i) => {
          const cutByMe = myCut === i;
          const cutByThem = revealing && theirStampShown && theirCut === i;
          const dead = (revealing || guessing || iCut) && cutByMe ? true : cutByThem;
          const myPendingGuess = (guessing || (revealing && !settled)) && myGuess === i;
          const clickable = (state.phase === "cutting" && !iCut) || (guessing && !iGuessed);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onOption(i)}
              disabled={!clickable}
              className={[
                "dr-cutcard focus-ring relative rounded-2xl border p-4 text-left transition-all duration-300",
                dead
                  ? "border-destructive/50 bg-destructive/10"
                  : myPendingGuess
                    ? "border-primary bg-primary/10"
                    : "border-white/[0.08] bg-white/[0.02]",
                clickable ? "hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.05]" : "",
                cutByThem ? "dr-cutcard--slammed" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span className={["text-2xl", dead ? "grayscale" : ""].join(" ")}>{opt.emoji}</span>
                <span
                  className={[
                    "flex-1 text-sm sm:text-base text-cream",
                    dead ? "line-through decoration-destructive/70 opacity-70" : "",
                  ].join(" ")}
                >
                  {opt.label}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-medium">
                  {myPendingGuess && !revealing && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">your guess</span>
                  )}
                  {revealing && rank === 0 && myPendingGuess && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">your guess</span>
                  )}
                  {settled && cutByMe && (
                    <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/40">you ❌</span>
                  )}
                  {settled && cutByThem && (
                    <span className="px-2 py-0.5 rounded-full bg-rose/20 text-rose border border-rose/40">{partnerName} ❌</span>
                  )}
                </span>
              </div>
              {cutByMe && !settled && (iCut || revealing) && (
                <span className="dr-stamp" aria-hidden>✕</span>
              )}
              {cutByThem && !settled && (
                <span className={["dr-stamp dr-stamp--anim", sameCut ? "dr-stamp--second" : ""].join(" ")} aria-hidden>✕</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative min-h-[5rem] flex flex-col items-center justify-center gap-2">
        {revealing ? (
          <>
            {verdictShown && (
              <p className={["text-sm animate-fade-in", iReadThem ? "text-primary font-medium" : "text-cream/70"].join(" ")}>
                {sameCut && iReadThem
                  ? "🎯 Same cut, and you called it"
                  : iReadThem
                    ? `🎯 You read ${partnerName} right`
                    : `${partnerName} surprised you`}
              </p>
            )}
            {mirrorShown && (
              <p className={["text-sm animate-fade-in", theyReadMe ? "text-rose font-medium" : "text-cream/70"].join(" ")}>
                {theyReadMe ? `👀 ${partnerName} read you too` : `Your pick surprised ${partnerName}`}
              </p>
            )}
            {settled && (
              <>
                {readsBar}
                <Button onClick={nextRound} className={accentBtn} style={accentStyle}>
                  {state.round + 1 >= OHTG_ROUNDS.length ? "Finish" : "Next round"}
                </Button>
              </>
            )}
          </>
        ) : guessing ? (
          iGuessed ? (
            <p className="text-sm text-muted-foreground animate-pulse">waiting for {partnerName}&apos;s guess…</p>
          ) : (
            <p className="text-sm text-muted-foreground">You both cut. 👀 Now read their mind.</p>
          )
        ) : iCut ? (
          <p className="text-sm text-muted-foreground animate-pulse">waiting for {partnerName} to choose…</p>
        ) : (
          readsBar
        )}
      </div>
    </div>
  );
}
