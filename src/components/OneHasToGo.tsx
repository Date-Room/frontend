import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  OHTG_ROUNDS,
  initialOhtgState,
  ohtgFromJson,
  ohtgIsFinished,
  reduceOhtg,
} from "@/lib/activities/oneHasToGo";

/**
 * One Has To Go — cut one of four, guess your date's cut before the reveal,
 * then defend your decision out loud. The tally tracks reads (correct guesses
 * about each other), never compatibility.
 */
export function OneHasToGo() {
  const { state, emit, senderId } = useReducedActivity(
    "one_has_to_go",
    initialOhtgState,
    ohtgFromJson,
    reduceOhtg,
  );

  const myReads = state.reads[senderId] ?? 0;
  const theirReads = Object.entries(state.reads).reduce(
    (n, [k, v]) => (k === senderId ? n : n + v),
    0,
  );

  const readsBar = (
    <div className="flex justify-center gap-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      <span>Reads · you {myReads}</span>
      <span>·</span>
      <span>them {theirReads}</span>
    </div>
  );

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  if (ohtgIsFinished(state)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center animate-fade-in">
        <p className="font-serif text-2xl italic text-cream">That&apos;s all {OHTG_ROUNDS.length} rounds</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {myReads === theirReads
            ? "You read each other equally well. Or equally badly."
            : myReads > theirReads
              ? "You read them better than they read you. For now."
              : "They read you better than you read them. Worth fixing."}
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
  const revealing = state.phase === "revealing";
  const guessing = state.phase === "guessing";
  const iReadThem = revealing && myGuess === theirCut;
  const theyReadMe =
    revealing &&
    otherCutEntry != null &&
    state.guesses[otherCutEntry[0]] === myCut;
  const sameCut = revealing && myCut === theirCut;

  const header = (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Round {state.round + 1} of {OHTG_ROUNDS.length} · {round.title}
      </p>
      <p className="font-serif text-xl italic text-cream">
        {revealing ? (sameCut ? round.matchLine : round.clashLine) : guessing ? "Before the reveal…" : "One has to go"}
      </p>
      <p className="text-xs text-muted-foreground">
        {revealing
          ? "Defend your decisions."
          : guessing
            ? "Which one did they cut?"
            : round.lead}
      </p>
    </div>
  );

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in">
      {header}
      <div className="flex flex-1 flex-col justify-center gap-3">
        {round.options.map((opt, i) => {
          const cutByMe = revealing && myCut === i;
          const cutByThem = revealing && theirCut === i;
          const wasCut = cutByMe || cutByThem;
          const myPendingCut = !revealing && myCut === i;
          const myPendingGuess = guessing && myGuess === i;
          const clickable = (state.phase === "cutting" && !iCut) || (guessing && !iGuessed);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onOption(i)}
              disabled={!clickable}
              className={[
                "focus-ring rounded-2xl border p-4 text-left transition-all duration-300",
                wasCut
                  ? "border-destructive/50 bg-destructive/10"
                  : myPendingCut || myPendingGuess
                    ? "border-primary bg-primary/10"
                    : "border-white/[0.08] bg-white/[0.02]",
                clickable ? "hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.05]" : "",
                revealing && !wasCut ? "opacity-80" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span className={["text-2xl", wasCut ? "grayscale" : ""].join(" ")}>{opt.emoji}</span>
                <span
                  className={[
                    "flex-1 text-sm sm:text-base text-cream",
                    wasCut ? "line-through decoration-destructive/70 opacity-70" : "",
                  ].join(" ")}
                >
                  {opt.label}
                </span>
                <span className="flex shrink-0 gap-1.5 text-[10px] uppercase tracking-[0.2em] font-medium">
                  {myPendingCut && !guessing && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">your cut</span>
                  )}
                  {myPendingGuess && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">your guess</span>
                  )}
                  {cutByMe && (
                    <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/40">you ❌</span>
                  )}
                  {cutByThem && (
                    <span className="px-2 py-0.5 rounded-full bg-rose/20 text-rose border border-rose/40">them ❌</span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="min-h-[4.5rem] flex flex-col items-center justify-center gap-2">
        {revealing ? (
          <>
            <div className="flex flex-col items-center gap-1 text-sm">
              <p className={iReadThem ? "text-primary font-medium" : "text-cream/70"}>
                {iReadThem ? "🎯 You read them right" : "Their pick surprised you"}
              </p>
              <p className={theyReadMe ? "text-rose font-medium" : "text-cream/70"}>
                {theyReadMe ? "👀 They read you too" : "Your pick surprised them"}
              </p>
            </div>
            {readsBar}
            <Button
              onClick={() => emit("next_round", { round: state.round })}
              className={accentBtn}
              style={accentStyle}
            >
              {state.round + 1 >= OHTG_ROUNDS.length ? "Finish" : "Next round"}
            </Button>
          </>
        ) : guessing ? (
          iGuessed ? (
            <p className="text-sm text-muted-foreground animate-pulse">waiting for their guess…</p>
          ) : (
            <p className="text-sm text-muted-foreground">You both chose. 👀 Now read their mind.</p>
          )
        ) : iCut ? (
          <p className="text-sm text-muted-foreground animate-pulse">waiting for them to choose…</p>
        ) : (
          readsBar
        )}
      </div>
    </div>
  );
}
