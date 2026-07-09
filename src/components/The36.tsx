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
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-4xl">💞</div>
        <p className="font-serif text-2xl text-cream">You made it through all 36</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Three sets, twelve each. That&apos;s the whole protocol.
        </p>
      </div>
    );
  }

  const prompt = THE_36[state.set_index]?.[state.question_index] ?? "…";
  const overall = state.set_index * PER_SET + state.question_index + 1;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <span>{SET_LABELS[state.set_index]}</span>
        <span className="tabular-nums">
          {overall} / {SETS_COUNT * PER_SET}
        </span>
      </div>

      <div
        key={`${state.set_index}-${state.question_index}`}
        className="flex min-h-0 flex-1 animate-scale-in items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.04] p-6 text-center"
      >
        <p className="text-2xl font-medium leading-snug text-cream">{prompt}</p>
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
        className="focus-ring w-full rounded-full py-3.5 font-semibold text-primary-foreground transition hover:opacity-90"
        style={{ backgroundColor: "var(--room-accent)" }}
      >
        Next question
      </button>
    </div>
  );
}
