import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  DOOR_ROUNDS,
  initialPickADoorState,
  pickADoorFromJson,
  pickADoorIsFinished,
  reducePickADoor,
} from "@/lib/activities/pickADoor";

/**
 * Pick a Door — commit to a category blind, then answer what's behind it out
 * loud. Chosen doors open on reveal; the unpicked door stays closed and keeps
 * its secret for a future date.
 */
export function PickADoor() {
  const { state, emit, senderId } = useReducedActivity(
    "pick_a_door",
    initialPickADoorState,
    pickADoorFromJson,
    reducePickADoor,
  );

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

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
  const revealing = state.phase === "revealing";
  const samePick = revealing && myPick === theirPick;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Round {state.round + 1} of {DOOR_ROUNDS.length} · {round.title}
        </p>
        <p className="font-serif text-xl italic text-cream">
          {revealing ? (samePick ? "Same door. Answer it together." : "The doors open") : "Pick a door"}
        </p>
        <p className="text-xs text-muted-foreground">
          {revealing
            ? "Answer what's behind yours out loud, then swap."
            : "You don't know what's behind them. Choose anyway."}
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {round.doors.map((door, i) => {
          const pickedByMe = myPick === i;
          const pickedByThem = theirPick === i;
          const opened = revealing && (pickedByMe || pickedByThem);
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
                "focus-ring rounded-2xl border p-4 text-left transition-all duration-500",
                opened
                  ? "border-primary bg-primary/10"
                  : pickedByMe
                    ? "border-primary bg-primary/10"
                    : "border-white/[0.08] bg-white/[0.02]",
                clickable ? "hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.05]" : "",
                revealing && !opened ? "opacity-40" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{opened ? door.emoji : "🚪"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-cream flex items-center gap-2 flex-wrap">
                    {door.name}
                    {opened && pickedByMe && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] tracking-[0.2em]">you</span>
                    )}
                    {opened && pickedByThem && (
                      <span className="px-2 py-0.5 rounded-full bg-rose/20 text-rose border border-rose/40 text-[10px] tracking-[0.2em]">them</span>
                    )}
                    {!revealing && pickedByMe && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] tracking-[0.2em]">your door</span>
                    )}
                  </p>
                  {opened ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-cream/90 animate-float-up">{door.question}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {revealing ? "Still closed. Its secret keeps." : "Something's behind it."}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="min-h-[3.5rem] flex items-center justify-center">
        {revealing ? (
          <Button
            onClick={() => emit("next_round", { round: state.round })}
            className={accentBtn}
            style={accentStyle}
          >
            {state.round + 1 >= DOOR_ROUNDS.length ? "Finish" : "Next round"}
          </Button>
        ) : iPicked ? (
          <p className="text-sm text-muted-foreground animate-pulse">waiting for them to pick a door…</p>
        ) : null}
      </div>
    </div>
  );
}
