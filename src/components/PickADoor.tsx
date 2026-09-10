import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  DOOR_ROUNDS,
  initialPickADoorState,
  pickADoorFromJson,
  pickADoorIsFinished,
  pickADoorSameDoor,
  pickADoorStageOwner,
  reducePickADoor,
} from "@/lib/activities/pickADoor";
import { setHelpNow } from "@/lib/activityHelpNow";
import { prefersReducedMotion, useCinematic, type CinematicStep } from "@/lib/stagecraft/cinematic";
import { useTypewriter } from "@/lib/stagecraft/typewriter";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";

/**
 * Pick a Door — game-show reveal, now strictly turn-based: the reveal stages
 * live in shared state, only the door's owner can say "I'm ready" or pass it
 * over, and one tap moves both screens (live-tested fix: local beats let both
 * players start their countdowns at once and never see each other's card).
 */

const REVEAL_STEPS: CinematicStep[] = [
  { id: "dimming", at: 0 },
  { id: "opening", at: 1100 },
  { id: "question", at: 2700 },
];

const ANSWER_SECONDS = 45;

export function PickADoor() {
  const { state, emit, senderId } = useReducedActivity(
    "pick_a_door",
    initialPickADoorState,
    pickADoorFromJson,
    reducePickADoor,
  );
  const partnerName = usePartnerName();

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  const revealing = !pickADoorIsFinished(state) && state.phase === "revealing";
  const { stage: cin, witnessed } = useCinematic(revealing, REVEAL_STEPS);

  // The shared answer ring, restarted whenever an answering stage begins.
  const answering = revealing && (state.stage === 1 || state.stage === 3);
  const [seconds, setSeconds] = useState(ANSWER_SECONDS);
  useEffect(() => {
    if (!answering) {
      setSeconds(ANSWER_SECONDS);
      return;
    }
    const id = window.setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [answering, state.stage, state.round]);

  // Publish the "right now" help line + you-are-here step (self-contained so
  // it can run before the finished early-return; hooks must not be skipped).
  useEffect(() => {
    const finished = state.round >= DOOR_ROUNDS.length;
    const iPickedNow = senderId in state.picks;
    const same = pickADoorSameDoor(state);
    const owner = pickADoorStageOwner(state);
    const mine = owner === senderId;
    const snap = finished
      ? { now: "That's all the rounds. Tap Play again for another run.", step: 3 }
      : state.phase === "picking"
        ? iPickedNow
          ? { now: `Locked. Waiting for ${partnerName} to pick.`, step: 0 }
          : { now: "Tap one of the three doors. No clues.", step: 0 }
        : same
          ? state.stage === 0
            ? { now: "Same door! Tap We're ready, then answer it together.", step: 1 }
            : { now: "Answer together, out loud. Then either of you taps Next round.", step: 1 }
          : state.stage === 0
            ? mine
              ? { now: "Your door is open. Read it, then tap I'm ready to answer.", step: 1 }
              : { now: `${partnerName} reads their door first.`, step: 1 }
            : state.stage === 1
              ? mine
                ? { now: "Answer out loud. Done? Tap Pass it over.", step: 1 }
                : { now: `Listen — ${partnerName} is answering.`, step: 1 }
              : state.stage === 2
                ? mine
                  ? { now: "Your door now. Read it, then tap I'm ready to answer.", step: 2 }
                  : { now: `${partnerName}'s second door. Listen.`, step: 2 }
                : mine
                  ? { now: "Answer out loud. Then either of you taps Next round.", step: 2 }
                  : { now: `Listen — then either of you taps Next round.`, step: 2 };
    setHelpNow("pick_a_door", snap);
  }, [state, senderId, partnerName]);

  // The second door earns its own swing when the shared stage reaches it.
  const [secondOpened, setSecondOpened] = useState(false);
  useEffect(() => {
    if (state.stage < 2) {
      setSecondOpened(false);
      return;
    }
    if (secondOpened) return;
    if (prefersReducedMotion()) {
      setSecondOpened(true);
      return;
    }
    const t = window.setTimeout(() => setSecondOpened(true), 1500);
    return () => window.clearTimeout(t);
  }, [state.stage, secondOpened]);

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
  const sameDoor = revealing && pickADoorSameDoor(state);
  const stageOwner = revealing ? pickADoorStageOwner(state) : null;
  const iOwnStage = stageOwner === senderId;
  const stageDoorIdx = sameDoor
    ? myPick
    : stageOwner != null
      ? state.picks[stageOwner]
      : undefined;
  const stageDoor = stageDoorIdx != null ? round.doors[stageDoorIdx] : null;

  const dimmed = revealing && witnessed && cin != null;
  const onPlaque = revealing && (witnessed ? cin === "question" : true);
  const showDoors = !revealing || (witnessed && (cin === "dimming" || cin === "opening"));
  const secondIntro = onPlaque && state.stage >= 2 && !secondOpened;
  const typed = useTypewriter(stageDoor?.question ?? "", onPlaque && !secondIntro);

  const lastStage = sameDoor ? 1 : 3;
  const finishLabel = state.round + 1 >= DOOR_ROUNDS.length ? "Finish" : "Next round";

  const ownerWord = sameDoor ? "Together" : iOwnStage ? "Your door" : `${partnerName}'s door`;

  const status = !revealing
    ? iPicked
      ? "Locked in · waiting for them…"
      : "You don't know what's behind them. Choose anyway."
    : !onPlaque
      ? witnessed && cin === "opening"
        ? "The doors are opening…"
        : "Both doors are locked."
      : sameDoor
        ? state.stage === 0
          ? "You landed on the same door. Answer it together."
          : "Both of you. Out loud."
        : state.stage === 0 || state.stage === 2
          ? iOwnStage
            ? "Behind your door. Take a breath."
            : `${partnerName} reads their question first.`
          : iOwnStage
            ? "Say it out loud. No typing, no take-backs."
            : `Listen. ${partnerName} is answering.`;

  const title = !revealing || !onPlaque
    ? revealing
      ? "The doors open"
      : "Pick a door"
    : sameDoor
      ? "One door, two answers"
      : state.stage <= 1
        ? "The first door"
        : "The second door";

  return (
    <div className={["dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in", dimmed ? "dr-stageroom--dim" : ""].join(" ")}>
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex shrink-0 flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Round {state.round + 1} of {DOOR_ROUNDS.length} · {round.title}
        </p>
        <p key={title} className="font-serif text-xl italic text-cream animate-fade-in">{title}</p>
        <p key={status} aria-live="polite" className="min-h-[1rem] text-xs text-muted-foreground animate-fade-in">{status}</p>
      </div>

      {showDoors && (
        <div className="relative flex flex-1 flex-col justify-center gap-3">
          {round.doors.map((door, i) => {
            const isMine = myPick === i;
            const isTheirs = revealing && theirPick === i;
            const chosen = isMine || isTheirs;
            const shut = revealing && !chosen;
            const opening = witnessed && cin === "opening" && chosen;
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
                    { event_type: "opened_door", payload: { text: `${round.title} · ${door.name}` } },
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

      {revealing && witnessed && cin === "opening" && stageDoor && (
        <div className="relative flex flex-col items-center gap-2">
          <div className="dr-beam" aria-hidden />
        </div>
      )}

      {onPlaque && stageDoor && (
        <div className="dr-stage relative flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="dr-beam" aria-hidden />

          {secondIntro ? (
            <BigDoor label={ownerWord} name={stageDoor.name} />
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--room-accent)" }}>
                {ownerWord} · {stageDoor.name}
              </p>
              <blockquote key={`${state.round}-${state.stage <= 1 ? "a" : "b"}`} className={["dr-plaque w-full max-w-md text-left", typed.complete ? "dr-plaque--settled" : ""].join(" ")}>
                <span className="dr-plaque-glyph" aria-hidden>{stageDoor.emoji}</span>
                <p className="font-serif italic text-xl sm:text-2xl leading-snug text-cream">
                  {typed.shown}
                  {!typed.complete && <span className="dr-caret" aria-hidden />}
                </p>
              </blockquote>

              {(state.stage === 0 || state.stage === 2) && typed.complete && (
                iOwnStage || sameDoor ? (
                  <Button
                    onClick={() => emit("advance_stage", { round: state.round, stage: state.stage + 1 })}
                    className={accentBtn + " animate-fade-in"}
                    style={accentStyle}
                  >
                    {sameDoor ? "We're ready" : "I'm ready to answer"}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    waiting for {partnerName} to be ready…
                  </p>
                )
              )}

              {answering && (
                <div className="flex flex-col items-center gap-3 animate-fade-in">
                  <div className="dr-ring" style={{ ["--p" as string]: seconds / ANSWER_SECONDS }}>
                    <span className="font-serif">{seconds}</span>
                  </div>
                  {state.stage === lastStage ? (
                    <Button onClick={() => emit("next_round", { round: state.round })} className={accentBtn} style={accentStyle}>
                      {finishLabel}
                    </Button>
                  ) : iOwnStage ? (
                    <Button
                      onClick={() => emit("advance_stage", { round: state.round, stage: state.stage + 1 })}
                      variant="outline"
                      className="rounded-full border-white/20 text-cream hover:bg-white/5"
                    >
                      Pass it over
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">your door comes next</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The hero swing before a plaque. Plays on mount (CSS animations). */
function BigDoor({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--room-accent)" }}>
        {label} · {name}
      </p>
      <div className="dr-bigdoor" aria-hidden>
        <span className="dr-bigdoor-spill" />
        <span className="dr-bigdoor-leaf dr-bigdoor-leaf--l" />
        <span className="dr-bigdoor-leaf dr-bigdoor-leaf--r" />
      </div>
      <p className="text-xs text-muted-foreground animate-pulse">opening…</p>
    </div>
  );
}
