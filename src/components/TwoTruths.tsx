import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  initialTwoTruthsState,
  twoTruthsFromJson,
  reduceTwoTruths,
} from "@/lib/activities/twoTruths";

/** 2 Truths and a Lie — mobile `2_truths`. */
export function TwoTruths() {
  const { state, emit, senderId } = useReducedActivity(
    "2_truths",
    initialTwoTruthsState,
    twoTruthsFromJson,
    reduceTwoTruths,
  );
  const [drafts, setDrafts] = useState(["", "", ""]);
  const [lie, setLie] = useState<number | null>(null);

  const round = state.round;
  const isStoryteller = round?.storyteller_id === senderId;
  const myScore = state.scores[senderId] ?? 0;
  const theirScore = Object.entries(state.scores).reduce((n, [k, v]) => (k === senderId ? n : n + v), 0);

  const scoreBar = (
    <div className="flex justify-center gap-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      <span>You {myScore}</span>
      <span>·</span>
      <span>Them {theirScore}</span>
    </div>
  );

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  // No round — anyone can claim the storyteller seat.
  if (!round) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
        <p className="font-serif text-2xl italic text-cream">Two truths and a lie</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          One of you tells three things — two true, one made up. The other guesses the lie.
        </p>
        {scoreBar}
        <Button onClick={() => emit("claim_turn")} className={accentBtn} style={accentStyle}>
          I&apos;ll go first
        </Button>
      </div>
    );
  }

  // Composing.
  if (round.phase === "composing") {
    if (!isStoryteller) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-lg font-medium text-cream">They&apos;re thinking up their three…</p>
          {scoreBar}
        </div>
      );
    }
    const canSubmit = drafts.every((d) => d.trim()) && lie !== null;
    return (
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Write three — mark the lie
        </p>
        <div className="flex flex-col gap-3">
          {drafts.map((d, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setLie(i)}
                aria-label={`Mark statement ${i + 1} as the lie`}
                className={`focus-ring h-8 w-8 shrink-0 rounded-full border text-[10px] uppercase transition ${
                  lie === i
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.18)]"
                    : "border-muted-foreground/40 text-muted-foreground hover:border-primary/50"
                }`}
              >
                lie
              </button>
              <Input
                value={d}
                onChange={(e) => setDrafts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Statement ${i + 1}`}
                className="bg-secondary/60 border-white/10 focus-visible:border-primary/40"
              />
            </div>
          ))}
        </div>
        <Button
          onClick={() => {
            if (lie === null) return;
            const trimmed = drafts.map((d) => d.trim());
            emit(
              "submit_statements",
              { statements: trimmed, lie_index: lie },
              { event_type: "submitted", payload: { text: trimmed.join("  ·  ") } },
            );
          }}
          disabled={!canSubmit}
          className={accentBtn}
          style={accentStyle}
        >
          Submit
        </Button>
      </div>
    );
  }

  const statements = round.statements ?? [];

  // Guessing.
  if (round.phase === "guessing") {
    if (isStoryteller) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-lg font-medium text-cream">Waiting for their guess…</p>
          {scoreBar}
        </div>
      );
    }
    return (
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Which one&apos;s the lie?
        </p>
        <div className="flex flex-1 flex-col justify-center gap-3">
          {statements.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                emit(
                  "guess",
                  { guess: i },
                  { event_type: "guessed", payload: { text: s } },
                )
              }
              className="focus-ring animate-float-up rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left text-cream transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.05]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {s}
            </button>
          ))}
        </div>
        {scoreBar}
      </div>
    );
  }

  // Revealing.
  const guessedRight = round.guess === round.lie_index;
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
      <p className="text-center text-lg font-medium text-cream">
        {guessedRight ? "Lie spotted! 🎯" : "The lie slipped through 😶"}
      </p>
      <div className="flex flex-1 flex-col justify-center gap-3">
        {statements.map((s, i) => {
          const isLie = i === round.lie_index;
          const wasGuess = i === round.guess;
          return (
            <div
              key={i}
              className={`rounded-2xl border p-4 text-cream ${
                isLie ? "border-primary bg-primary/10" : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              <span>{s}</span>
              {isLie && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">the lie</span>}
              {wasGuess && !isLie && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">their guess</span>
              )}
            </div>
          );
        })}
      </div>
      {scoreBar}
      <Button onClick={() => emit("reveal_and_swap")} className={accentBtn} style={accentStyle}>
        Next round — swap
      </Button>
    </div>
  );
}
