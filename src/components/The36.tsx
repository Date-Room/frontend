import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  THE_36,
  SET_LABELS,
  PER_SET,
  SETS_COUNT,
  initialThe36State,
  the36FromJson,
  reduceThe36,
} from "@/lib/activities/the36";

/** The 36 — shared prompt, either player taps Next (mobile `the_36`). */
export function The36() {
  const { state, emit } = useReducedActivity("the_36", initialThe36State, the36FromJson, reduceThe36);

  if (state.done) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center gap-3">
        <div className="text-4xl">💞</div>
        <p className="font-serif italic text-cream text-2xl">You made it through all 36</p>
        <p className="text-sm text-muted-foreground max-w-xs">Three sets, twelve each. That's the whole protocol.</p>
      </div>
    );
  }

  const prompt = THE_36[state.set_index]?.[state.question_index] ?? "…";
  const overall = state.set_index * PER_SET + state.question_index + 1;

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 gap-4 min-h-0">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>{SET_LABELS[state.set_index]}</span>
        <span className="tabular-nums">{overall} / {SETS_COUNT * PER_SET}</span>
      </div>

      <div
        key={`${state.set_index}-${state.question_index}`}
        className="flex-1 min-h-0 flex items-center justify-center rounded-3xl border-2 border-rosegold/30 bg-rosegold/5 p-6 text-center animate-scale-in shadow-[0_28px_72px_-22px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        <p className="font-serif italic text-cream text-2xl leading-snug">{prompt}</p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Question {state.question_index + 1} of {PER_SET}
      </p>

      <button
        type="button"
        onClick={() =>
          emit(
            "advance",
            { from_set: state.set_index, from_q: state.question_index },
            { event_type: "answered", payload: { text: prompt } },
          )
        }
        className="btn-primary focus-ring w-full py-3.5 rounded-full font-semibold"
      >
        Next question
      </button>
    </div>
  );
}
