import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  OHTG_ROUNDS,
  initialOhtgState,
  listOf,
  ohtgFromJson,
  ohtgIsFinished,
  ohtgRevealSteps,
  reduceOhtg,
} from "@/lib/activities/oneHasToGo";
import { useCinematic } from "@/lib/stagecraft/cinematic";
import { Scoreboard } from "@/lib/stagecraft/Scoreboard";
import { StagePrompt } from "@/lib/stagecraft/StagePrompt";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";

/**
 * One Has To Go — table-cards reveal. Four big cards on the table; you cut
 * one (sealed, no take-backs), then read your date's cut on the same cards
 * re-skinned as a different question. The reveal is physical: the room dims,
 * your cut falls off the table first (ritual — you knew), then theirs (the
 * reveal), landing on a verdict surface that stays put: the cuts, the read,
 * what survives, the running tally. Pacing tightens over the ten-round arc.
 *
 * Deliberate departures from the handoff spec: your own cut stays guessable
 * (same-cut rounds are real, and calling one is the game's best moment), and
 * there is no enforced defend timer — the verdict surface is the prompt.
 */

const STAGE_RANK: Record<string, number> = { dim: 0, yours: 1, theirs: 2, verdict: 3 };

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
    <Scoreboard
      label="Reads"
      entries={[
        { name: "You", value: myReads, accent: true },
        { name: partnerName, value: theirReads },
      ]}
    />
  );

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  const revealing = !ohtgIsFinished(state) && state.phase === "revealing";
  const { stage, witnessed } = useCinematic(
    revealing,
    ohtgRevealSteps(Math.min(state.round, OHTG_ROUNDS.length - 1)),
  );
  // -1 before the reveal; hydrating mid-reveal jumps straight to the verdict.
  const rank = revealing ? (witnessed ? STAGE_RANK[stage ?? "dim"] ?? 0 : 3) : -1;

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
  const theyReadMe = revealing && otherCutEntry != null && state.guesses[otherCutEntry[0]] === myCut;

  const yoursFallen = rank >= 1;
  const theirsFallen = rank >= 2;
  const onVerdict = rank >= 3;

  const survivorNames = onVerdict
    ? round.options.filter((_, i) => i !== myCut && i !== theirCut).map((o) => o.label)
    : [];

  const title = !revealing
    ? guessing
      ? "Now read your date"
      : iCut
        ? "The cut is sealed"
        : "One of these has to go"
    : onVerdict
      ? sameCut
        ? round.matchLine
        : round.clashLine
      : rank === 2
        ? `${partnerName}'s cut`
        : rank === 1
          ? "Your cut"
          : "Both cuts are in";

  const status = !revealing
    ? guessing
      ? iGuessed
        ? "Read locked · waiting for the room…"
        : `Which one do you think ${partnerName} cut? Calling a same-cut is allowed.`
      : iCut
        ? "Sealed · no take-backs."
        : round.lead
    : onVerdict
      ? iReadThem
        ? "You called it."
        : `You read ${partnerName} wrong.`
      : rank === 2
        ? `And ${partnerName}'s.`
        : rank === 1
          ? "It falls off the table."
          : "Lights down. Nobody can change their mind now.";

  const onOption = (i: number) => {
    if (state.phase === "cutting" && !iCut) {
      emit(
        "cut",
        { round: state.round, option: i },
        { event_type: "eliminated", payload: { text: `${round.title} · cut ${round.options[i].label}` } },
      );
    } else if (guessing && !iGuessed) {
      emit("guess", { round: state.round, option: i });
    }
  };

  const nextRound = () => {
    const readsLine = sameCut
      ? iReadThem
        ? `same cut and you called it`
        : "same cut"
      : [
          iReadThem ? `you read ${partnerName} right` : `${partnerName} surprised you`,
          theyReadMe ? `${partnerName} read you` : `your pick surprised ${partnerName}`,
        ].join(" · ");
    emit(
      "next_round",
      { round: state.round },
      { event_type: "reads", payload: { text: `${round.title} · ${readsLine}` } },
    );
  };

  return (
    <div
      className={[
        "dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in",
        revealing && witnessed && !onVerdict ? "dr-stageroom--dim" : "",
      ].join(" ")}
    >
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex shrink-0 flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Round {state.round + 1} of {OHTG_ROUNDS.length} · {round.title}
        </p>
        <p key={title} className="font-serif text-xl italic text-cream animate-fade-in">{title}</p>
        <p key={status} aria-live="polite" className="min-h-[1rem] text-xs text-muted-foreground animate-fade-in">
          {status}
        </p>
      </div>

      {guessing && !iGuessed && (
        <StagePrompt
          id={`ohtg-guess-${state.round}`}
          lead="✓ Your cut is sealed"
          text={`Now tap the one you think ${partnerName} cut.`}
        />
      )}

      <div className={["dr-table relative grid grid-cols-2 gap-3", guessing && !iGuessed ? "dr-table--reading" : ""].join(" ")}>
        {round.options.map((opt, i) => {
          const isMine = myCut === i;
          const isTheirs = revealing && theirCut === i;
          const fell = (isMine && yoursFallen) || (isTheirs && theirsFallen);
          const survivor = onVerdict && !isMine && !isTheirs;
          const sealed = isMine && !fell && (iCut || revealing);
          const isRead = myGuess === i && (guessing || revealing) && iGuessed;
          const waiting = revealing && !onVerdict && !fell && !sealed;
          const clickable = (state.phase === "cutting" && !iCut) || (guessing && !iGuessed);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onOption(i)}
              disabled={!clickable}
              className={[
                "dr-tile focus-ring relative flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-2xl border p-4 pb-8 text-center",
                fell
                  ? witnessed
                    ? "dr-tile--fallen"
                    : "dr-tile--gone"
                  : sealed
                    ? "border-primary bg-primary/10 dr-tile--sealed"
                    : survivor
                      ? "border-emerald-400/50 bg-emerald-400/5"
                      : waiting
                        ? "border-white/[0.08] bg-white/[0.02] opacity-60 saturate-50"
                        : "border-white/[0.10] bg-white/[0.03]",
                clickable ? "hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.05] cursor-pointer" : "",
              ].join(" ")}
            >
              <span className="text-3xl" aria-hidden>{opt.emoji}</span>
              <span className="font-serif text-base sm:text-lg text-cream leading-tight">{opt.label}</span>

              {isRead && !fell && (
                <span className="dr-tile-tag dr-tile-tag--top border-rose/60 text-rose border-dashed">your read</span>
              )}
              {sealed && <span className="dr-tile-tag border-primary/60 text-primary">you cut</span>}
              {fell && isMine && (
                <span className="dr-tile-tag border-destructive/50 text-destructive/90">
                  {sameCut && theirsFallen ? "you both cut" : "you cut"}
                </span>
              )}
              {fell && isTheirs && !sameCut && (
                <span className="dr-tile-tag border-rose/60 text-rose">{partnerName} cut</span>
              )}
              {survivor && <span className="dr-tile-tag border-emerald-400/60 text-emerald-300">survives</span>}
              {fell && (
                <span className="dr-tile-x" aria-hidden>✕</span>
              )}
            </button>
          );
        })}
      </div>

      {guessing && !iGuessed && (
        <p className="relative text-center text-[11px] text-muted-foreground">
          Guessing right is worth a read. Reading yourself only counts if {partnerName} cut it too.
        </p>
      )}

      <div className="relative flex flex-col items-center justify-center gap-3">
        {onVerdict && myCut != null && theirCut != null && myGuess != null ? (
          <div className="flex w-full flex-col gap-3 animate-fade-in">
            <div className="dr-beam" aria-hidden />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-4 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">The cuts</p>
                <p className="mt-2 flex items-center gap-2 font-serif text-cream">
                  <span aria-hidden>{round.options[myCut].emoji}</span> {round.options[myCut].label}
                  <span className="ml-auto text-[10px] font-sans uppercase tracking-[0.2em] text-primary">you</span>
                </p>
                {!sameCut && (
                  <p className="mt-1 flex items-center gap-2 font-serif text-cream">
                    <span aria-hidden>{round.options[theirCut].emoji}</span> {round.options[theirCut].label}
                    <span className="ml-auto text-[10px] font-sans uppercase tracking-[0.2em] text-rose">{partnerName}</span>
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {sameCut
                    ? "Same cut · one thing gone, and you both killed it"
                    : "Two things gone · the table just got smaller"}
                </p>
              </div>
              <div
                className="rounded-2xl border p-4 text-left"
                style={{
                  borderColor: "color-mix(in srgb, var(--room-accent) 45%, transparent)",
                  background: "color-mix(in srgb, var(--room-accent) 6%, transparent)",
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--room-accent)" }}>
                  The read
                </p>
                <p className="mt-2 flex items-center gap-2 font-serif text-cream">
                  <span aria-hidden>{round.options[myGuess].emoji}</span> {round.options[myGuess].label}
                  <span className="ml-auto text-[10px] font-sans uppercase tracking-[0.2em] text-muted-foreground">your guess</span>
                </p>
                <p className={["mt-2 text-xs", iReadThem ? "text-emerald-300" : "text-cream/80"].join(" ")}>
                  {iReadThem
                    ? `🎯 Right · you knew what ${partnerName} would let go`
                    : `Wrong · ${partnerName} actually cut ${round.options[theirCut].label}`}
                </p>
                <p className={["mt-1 text-xs", theyReadMe ? "text-rose" : "text-muted-foreground"].join(" ")}>
                  {theyReadMe ? `👀 ${partnerName} read you too` : `${partnerName} missed yours`}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--room-accent)" }}>
                What survives · {survivorNames.join(" + ")}
              </p>
              <p className="max-w-sm font-serif text-base italic leading-relaxed text-cream/90">
                {survivorNames.length === 1
                  ? `Everything from here is ${survivorNames[0]}. Defend it.`
                  : `${listOf(survivorNames)} live on. Tell ${partnerName} why ${round.options[myCut].label} had to go.`}
              </p>
              {readsBar}
              <Button onClick={nextRound} className={accentBtn} style={accentStyle}>
                {state.round + 1 >= OHTG_ROUNDS.length ? "Finish" : "Next round"}
              </Button>
            </div>
          </div>
        ) : revealing ? null : guessing ? (
          iGuessed ? (
            <p className="text-sm text-muted-foreground animate-pulse">waiting for {partnerName}&apos;s read…</p>
          ) : null
        ) : iCut ? (
          <p className="text-sm text-muted-foreground animate-pulse">waiting for {partnerName} to choose…</p>
        ) : (
          readsBar
        )}
      </div>
    </div>
  );
}
