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
    <div className="flex justify-center gap-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
      <span>You {myScore}</span>
      <span>·</span>
      <span>Them {theirScore}</span>
    </div>
  );

  // No round — anyone can claim the storyteller seat.
  if (!round) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 gap-5 text-center">
        <p className="font-serif italic text-cream text-xl">Two truths and a lie</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          One of you tells three things — two true, one made up. The other guesses the lie.
        </p>
        {scoreBar}
        <Button onClick={() => emit("claim_turn")} className="rounded-full bg-amber text-primary-foreground">
          I'll go first
        </Button>
      </div>
    );
  }

  // Composing.
  if (round.phase === "composing") {
    if (!isStoryteller) {
      return (
        <div className="flex flex-col h-full items-center justify-center p-8 gap-3 text-center">
          <p className="font-serif italic text-cream text-lg">They're thinking up their three…</p>
          {scoreBar}
        </div>
      );
    }
    const canSubmit = drafts.every((d) => d.trim()) && lie !== null;
    return (
      <div className="flex flex-col h-full p-4 sm:p-6 gap-3 min-h-0">
        <p className="font-serif italic text-cream">Write three — mark the lie</p>
        {drafts.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLie(i)}
              aria-label={`Mark statement ${i + 1} as the lie`}
              className={`focus-ring h-7 w-7 shrink-0 rounded-full border text-[10px] uppercase transition-all ${
                lie === i
                  ? "bg-rose border-rose text-cream shadow-[0_0_0_4px_rgba(232,166,83,0.18)]"
                  : "border-muted-foreground/40 text-muted-foreground hover:border-rose/40"
              }`}
            >
              lie
            </button>
            <Input
              value={d}
              onChange={(e) => setDrafts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Statement ${i + 1}`}
              className="focus-ring bg-secondary/60 border-white/[0.10] focus-visible:border-primary/40"
            />
          </div>
        ))}
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
          className="rounded-full bg-amber text-primary-foreground disabled:opacity-50 mt-1"
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
        <div className="flex flex-col h-full items-center justify-center p-8 gap-3 text-center">
          <p className="font-serif italic text-cream text-lg">Waiting for their guess…</p>
          {scoreBar}
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full p-4 sm:p-6 gap-3 min-h-0">
        <p className="font-serif italic text-cream text-center">Which one's the lie?</p>
        <div className="flex-1 flex flex-col justify-center gap-3">
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
              className="focus-ring animate-float-up rounded-2xl border border-white/[0.08] bg-card/60 p-4 text-left text-cream hover:border-rose/50 hover:bg-card/80 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_4px_18px_-8px_rgba(0,0,0,0.4)]"
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
    <div className="flex flex-col h-full p-4 sm:p-6 gap-3 min-h-0">
      <p className="font-serif italic text-cream text-center">
        {guessedRight ? "Lie spotted! 🎯" : "The lie slipped through 😶"}
      </p>
      <div className="flex-1 flex flex-col justify-center gap-3">
        {statements.map((s, i) => {
          const isLie = i === round.lie_index;
          const wasGuess = i === round.guess;
          return (
            <div
              key={i}
              className={`rounded-2xl border p-4 text-cream ${
                isLie ? "border-rose bg-rose/10" : "border-border bg-card/60"
              }`}
            >
              <span>{s}</span>
              {isLie && <span className="ml-2 text-[10px] uppercase tracking-wider text-rose">the lie</span>}
              {wasGuess && !isLie && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">their guess</span>}
            </div>
          );
        })}
      </div>
      {scoreBar}
      <Button onClick={() => emit("reveal_and_swap")} className="rounded-full bg-amber text-primary-foreground">
        Next round — swap
      </Button>
    </div>
  );
}
