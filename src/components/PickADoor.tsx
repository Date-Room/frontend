import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  DOOR_ROUNDS,
  initialPickADoorState,
  pickADoorFromJson,
  pickADoorIsFinished,
  reducePickADoor,
} from "@/lib/activities/pickADoor";
import { useCinematic, type CinematicStep } from "@/lib/stagecraft/cinematic";
import { useTypewriter } from "@/lib/stagecraft/typewriter";

/**
 * Pick a Door — game-show reveal. Both pick blind; the panel dims; only the
 * chosen doors stay lit; they swing open and each question rises on a plaque
 * that types itself in. One thing on screen at a time: question → "I'm ready"
 * → say-it-out-loud countdown → the partner's door as its own beat.
 *
 * The cinematic is presentation only — the shared reducer is untouched, and
 * a reload mid-reveal skips the show (see stagecraft rules).
 */

/** Timed from the moment both picks land (the reveal broadcast). */
const REVEAL_STEPS: CinematicStep[] = [
  { id: "dimming", at: 0 },
  { id: "opening", at: 1100 },
  { id: "question", at: 2700 },
];

const ANSWER_SECONDS = 45;

/** Local presentation beats once the plaque stage is reached. */
type Beat = "mine" | "answering" | "theirs" | "theirs-done";

export function PickADoor() {
  const { state, emit, senderId } = useReducedActivity(
    "pick_a_door",
    initialPickADoorState,
    pickADoorFromJson,
    reducePickADoor,
  );

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  const revealing = !pickADoorIsFinished(state) && state.phase === "revealing";
  const { stage, witnessed } = useCinematic(revealing, REVEAL_STEPS);

  const [beat, setBeat] = useState<Beat>("mine");
  const [seconds, setSeconds] = useState(ANSWER_SECONDS);
  const roundRef = useRef(state.round);
  useEffect(() => {
    if (roundRef.current !== state.round) {
      roundRef.current = state.round;
      setBeat("mine");
      setSeconds(ANSWER_SECONDS);
    }
  }, [state.round]);

  // The say-it-out-loud countdown. Runs out gracefully — no auto-advance.
  useEffect(() => {
    if (beat !== "answering") return;
    const id = window.setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [beat]);

  if (pickADoorIsFinished(state)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center animate-fade-in">
        <p className="font-serif text-2xl italic text-cream">All {DOOR_ROUNDS.length} rounds, done</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          A lot of doors opened between you. The ones still closed keep their secrets for next time.
        </p>
        <Button onClick={() => emit("restart")} className={accentBtn} style={accentStyle}>
          Play again
        </Button>
      </div>
    );
  }

  const round = DOOR_ROUNDS[state.round];
  const myPick = state.picks[senderId];
  const otherEntry = Object.entries(state.picks).find(([uid]) => uid !== senderId);
  const theirPick = otherEntry?.[1];
  const iPicked = myPick != null;
  const sameDoor = revealing && myPick === theirPick;
  const mine = myPick != null ? round.doors[myPick] : null;
  const theirs = theirPick != null ? round.doors[theirPick] : null;

  const dimmed = revealing && witnessed && stage != null;
  const onPlaque = revealing && witnessed && stage === "question";
  const showDoors = !revealing || (witnessed && (stage === "dimming" || stage === "opening"));

  const nextRound = () => emit("next_round", { round: state.round });
  const finishLabel = state.round + 1 >= DOOR_ROUNDS.length ? "Finish" : "Next round";

  const status = !revealing
    ? iPicked
      ? "Locked in · waiting for them…"
      : "You don't know what's behind them. Choose anyway."
    : !witnessed
      ? "Answer what's behind yours out loud, then swap."
      : stage === "dimming"
        ? "Both doors are locked."
        : stage === "opening"
          ? "The doors are opening…"
          : beat === "mine"
            ? sameDoor
              ? "You landed on the same door."
              : "Behind your door."
            : beat === "answering"
              ? "Say it out loud. No typing, no take-backs."
              : "Now theirs. Same rules.";

  const title = !revealing || (witnessed && (stage === "dimming" || stage === "opening"))
    ? "Pick a door"
    : sameDoor
      ? "One door, two answers"
      : "The doors open";

  return (
    <div className={["dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in", dimmed ? "dr-stageroom--dim" : ""].join(" ")}>
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Round {state.round + 1} of {DOOR_ROUNDS.length} · {round.title}
        </p>
        <p className="font-serif text-xl italic text-cream">{title}</p>
        <p key={status} className="text-xs text-muted-foreground animate-fade-in">{status}</p>
      </div>

      {showDoors && (
        <div className="relative flex flex-1 flex-col justify-center gap-3">
          {round.doors.map((door, i) => {
            const isMine = myPick === i;
            const isTheirs = revealing && theirPick === i;
            const chosen = isMine || isTheirs;
            const shut = revealing && !chosen;
            const opening = stage === "opening" && chosen;
            const clickable = !iPicked && !revealing;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (!clickable) return;
                  emit(
                    "pick",
                    { round: state.round, door: i },
                    {
                      event_type: "opened_door",
                      payload: { text: `${round.title} · ${door.name}` },
                    },
                  );
                }}
                disabled={!clickable}
                className={[
                  "dr-door focus-ring rounded-2xl border p-4 text-left",
                  chosen ? "dr-door--lit border-primary bg-primary/10" : "border-white/[0.08] bg-white/[0.02]",
                  shut ? "dr-door--shut" : "",
                  clickable ? "hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.05]" : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span className={["dr-door-panel", opening ? "dr-door-panel--opening" : ""].join(" ")} aria-hidden>
                    <span className="dr-door-leaf dr-door-leaf--l" />
                    <span className="dr-door-leaf dr-door-leaf--r" />
                    <span className="dr-door-spill" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-cream flex items-center gap-2 flex-wrap">
                      {door.name}
                      {isMine && !revealing && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] tracking-[0.2em]">your door</span>
                      )}
                      {revealing && isMine && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] tracking-[0.2em]">
                          {sameDoor ? "both of you" : "you"}
                        </span>
                      )}
                      {revealing && isTheirs && !sameDoor && (
                        <span className="px-2 py-0.5 rounded-full bg-rose/20 text-rose border border-rose/40 text-[10px] tracking-[0.2em]">them</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {shut ? "Still closed. Its secret keeps." : "Something's behind it."}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {onPlaque && mine && theirs && (
        <StagePlaques
          sameDoor={sameDoor}
          mine={mine}
          theirs={theirs}
          beat={beat}
          seconds={seconds}
          onReady={() => setBeat("answering")}
          onPass={() => setBeat(sameDoor ? "theirs-done" : "theirs")}
          onFinish={nextRound}
          finishLabel={finishLabel}
        />
      )}

      {revealing && !witnessed && mine && theirs && (
        <SettledReveal
          round={state.round}
          sameDoor={sameDoor}
          myPick={myPick!}
          theirPick={theirPick!}
          onNext={nextRound}
          finishLabel={finishLabel}
        />
      )}

      {!revealing && (
        <div className="relative min-h-[2.5rem] flex items-center justify-center">
          {iPicked && <p className="text-sm text-muted-foreground animate-pulse">waiting for them to pick a door…</p>}
        </div>
      )}
    </div>
  );
}

/** The lit stage: one plaque at a time, question typing itself in. */
function StagePlaques({
  sameDoor,
  mine,
  theirs,
  beat,
  seconds,
  onReady,
  onPass,
  onFinish,
  finishLabel,
}: {
  sameDoor: boolean;
  mine: { emoji: string; name: string; question: string };
  theirs: { emoji: string; name: string; question: string };
  beat: Beat;
  seconds: number;
  onReady: () => void;
  onPass: () => void;
  onFinish: () => void;
  finishLabel: string;
}) {
  const showingTheirs = beat === "theirs" || beat === "theirs-done";
  const door = showingTheirs ? theirs : mine;
  const owner = sameDoor ? "Together" : showingTheirs ? "Their door" : "Your door";
  const typed = useTypewriter(door.question, true);

  return (
    <div className="dr-stage relative flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="dr-beam" aria-hidden />
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--room-accent)" }}>
        {owner} · {door.name}
      </p>
      <blockquote key={door.name} className={["dr-plaque", typed.complete ? "dr-plaque--settled" : ""].join(" ")}>
        <span className="dr-plaque-glyph" aria-hidden>{door.emoji}</span>
        <p className="font-serif italic text-xl sm:text-2xl leading-snug text-cream">
          {typed.shown}
          {!typed.complete && <span className="dr-caret" aria-hidden />}
        </p>
      </blockquote>

      {beat === "mine" && typed.complete && (
        <Button onClick={onReady} className="rounded-full text-primary-foreground hover:opacity-90 animate-fade-in" style={{ backgroundColor: "var(--room-accent)" }}>
          I&apos;m ready to answer
        </Button>
      )}

      {beat === "answering" && (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="dr-ring" style={{ ["--p" as string]: seconds / ANSWER_SECONDS }}>
            <span className="font-serif">{seconds}</span>
          </div>
          <Button
            onClick={sameDoor ? onFinish : onPass}
            variant="outline"
            className="rounded-full border-white/20 text-cream hover:bg-white/5"
          >
            {sameDoor ? finishLabel : "Pass it over"}
          </Button>
        </div>
      )}

      {(beat === "theirs" || beat === "theirs-done") && typed.complete && (
        <Button onClick={onFinish} className="rounded-full text-primary-foreground hover:opacity-90 animate-fade-in" style={{ backgroundColor: "var(--room-accent)" }}>
          {finishLabel}
        </Button>
      )}
    </div>
  );
}

/** Hydrated mid-reveal (reload / late join): no show, both questions settled. */
function SettledReveal({
  round: roundIndex,
  sameDoor,
  myPick,
  theirPick,
  onNext,
  finishLabel,
}: {
  round: number;
  sameDoor: boolean;
  myPick: number;
  theirPick: number;
  onNext: () => void;
  finishLabel: string;
}) {
  const round = DOOR_ROUNDS[roundIndex];
  const opened = sameDoor ? [myPick] : [myPick, theirPick];
  return (
    <div className="relative flex flex-1 flex-col justify-center gap-3">
      {round.doors.map((door, i) => {
        const isOpen = opened.includes(i);
        return (
          <div
            key={i}
            className={["rounded-2xl border p-4", isOpen ? "border-primary bg-primary/10" : "border-white/[0.08] bg-white/[0.02] opacity-40"].join(" ")}
          >
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cream flex items-center gap-2">
              <span className="text-xl" aria-hidden>{isOpen ? door.emoji : "🚪"}</span>
              {door.name}
              {isOpen && i === myPick && (
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] tracking-[0.2em]">
                  {sameDoor ? "both of you" : "you"}
                </span>
              )}
              {isOpen && !sameDoor && i === theirPick && (
                <span className="px-2 py-0.5 rounded-full bg-rose/20 text-rose border border-rose/40 text-[10px] tracking-[0.2em]">them</span>
              )}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-cream/90">
              {isOpen ? door.question : "Still closed. Its secret keeps."}
            </p>
          </div>
        );
      })}
      <div className="flex justify-center pt-2">
        <Button onClick={onNext} className="rounded-full text-primary-foreground hover:opacity-90" style={{ backgroundColor: "var(--room-accent)" }}>
          {finishLabel}
        </Button>
      </div>
    </div>
  );
}
