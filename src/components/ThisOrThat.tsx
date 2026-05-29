import { Button } from "@/components/ui/button";
import { getPairs } from "@/lib/catalogRuntime";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { useEffect, useMemo, useState } from "react";

/**
 * This or That — ported to the shared `this_or_that` activity (mobile parity):
 *  - durable state `{ prompt_index, picks: { <userId>: "left" | "right" } }`
 *  - broadcast events `pick { pick }` and `next_prompt { prompt_index }`.
 * Web's a/b maps to mobile's left/right at the boundary.
 */

const REVEAL_HOLD_MS = 1800;

type Choice = "left" | "right";
const sideToChoice = (s: "a" | "b"): Choice => (s === "a" ? "left" : "right");
const choiceToSide = (c: Choice | undefined): "a" | "b" | undefined =>
  c === "left" ? "a" : c === "right" ? "b" : undefined;

function asPicks(v: unknown): Record<string, Choice> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, Choice> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === "left" || val === "right") out[k] = val;
  }
  return out;
}

export function ThisOrThat() {
  const room = useRoomSession();
  const me = room.senderId;
  const { session, state: durable } = useActivitySession("this_or_that");
  const pairs = useMemo(() => getPairs(), []);

  const [promptIndex, setPromptIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, Choice>>({});

  // Adopt durable state: replace picks on a round change, merge within a round.
  useEffect(() => {
    if (!durable) return;
    const pi = typeof durable.prompt_index === "number" ? durable.prompt_index : 0;
    const dp = asPicks(durable.picks);
    setPromptIndex((prevPi) => {
      if (pi !== prevPi) {
        setPicks(dp);
        return pi;
      }
      setPicks((prev) => ({ ...prev, ...dp }));
      return prevPi;
    });
  }, [durable]);

  // Live partner events.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.type === "pick") {
        const c = e.payload.pick;
        if (c === "left" || c === "right") setPicks((prev) => ({ ...prev, [e.userId]: c }));
      } else if (e.type === "next_prompt") {
        const ni = typeof e.payload.prompt_index === "number" ? e.payload.prompt_index : 0;
        setPromptIndex(ni);
        setPicks({});
      }
    });
  }, [session]);

  const idx = promptIndex;
  const pair = pairs[idx % Math.max(1, pairs.length)];
  const myPick = choiceToSide(picks[me]);
  const otherEntry = Object.entries(picks).find(([uid]) => uid !== me);
  const theirPick = choiceToSide(otherEntry?.[1]);
  const bothPicked = Object.keys(picks).length >= 2;
  const isMatch = bothPicked && myPick && theirPick && myPick === theirPick;

  const [revealComplete, setRevealComplete] = useState(false);
  useEffect(() => {
    if (!bothPicked) {
      setRevealComplete(false);
      return;
    }
    const t = window.setTimeout(() => setRevealComplete(true), REVEAL_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [bothPicked, idx]);

  if (pairs.length === 0 || !pair) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-muted-foreground text-sm">
        Loading prompts…
      </div>
    );
  }

  const choose = (side: "a" | "b") => {
    if (myPick) return;
    const c = sideToChoice(side);
    const next = { ...picks, [me]: c };
    setPicks(next);
    void session?.sendEvent("pick", { pick: c });
    // Recap-worthy: each pick reads as "Sasha · picked — Mountains · vs · Beaches".
    void session?.persist(
      { prompt_index: idx, picks: next },
      {
        event_type: "picked",
        payload: {
          text: `${pair.a.label}  ·  vs  ·  ${pair.b.label}`,
          choice: c,
        },
      },
    );
  };

  const nextRound = () => {
    const ni = (idx + 1) % pairs.length;
    setPromptIndex(ni);
    setPicks({});
    void session?.sendEvent("next_prompt", { prompt_index: ni });
    void session?.persist({ prompt_index: ni, picks: {} });
  };

  const Card = ({ side, opt }: { side: "a" | "b"; opt: { label: string; emoji: string } }) => {
    const chosenByMe = myPick === side;
    const chosenByOther = bothPicked && theirPick === side;
    const reveal = bothPicked;
    const dimmed = reveal && !chosenByMe && !chosenByOther;
    return (
      <button
        onClick={() => choose(side)}
        disabled={!!myPick}
        className={[
          "group relative flex-1 rounded-3xl border-2 p-6 sm:p-8 min-h-[200px] flex flex-col items-center justify-center gap-3 text-center card-shadow grain transition-all duration-500",
          chosenByMe && chosenByOther
            ? "border-amber bg-amber/15 candle-glow scale-[1.02]"
            : chosenByMe
              ? "border-amber bg-amber/10 candle-glow"
              : chosenByOther
                ? "border-rose bg-rose/10"
                : reveal
                  ? "border-border bg-card"
                  : "border-border bg-card hover:border-amber/50",
          dimmed ? "opacity-30 grayscale" : "",
          myPick && !chosenByMe && !reveal ? "opacity-50" : "",
        ].join(" ")}
      >
        <div
          className={[
            "text-5xl sm:text-6xl transition-transform duration-500",
            reveal && (chosenByMe || chosenByOther) ? "scale-110" : "",
          ].join(" ")}
        >
          {opt.emoji}
        </div>
        <div className="font-serif text-2xl text-cream">{opt.label}</div>
        {reveal && (chosenByMe || chosenByOther) && (
          <div className="flex gap-2 mt-1 text-[10px] uppercase tracking-[0.25em] font-medium">
            {chosenByMe && (
              <span className="px-2 py-0.5 rounded-full bg-amber/20 text-amber border border-amber/40">you</span>
            )}
            {chosenByOther && (
              <span className="px-2 py-0.5 rounded-full bg-rose/20 text-rose border border-rose/40">them</span>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground text-center">
        Round {idx + 1} · pick one
      </div>
      <div className="flex-1 flex flex-col sm:flex-row items-stretch gap-3">
        <Card side="a" opt={pair.a} />
        <div className="flex items-center justify-center font-serif italic text-muted-foreground">or</div>
        <Card side="b" opt={pair.b} />
      </div>
      <div className="min-h-[3.5rem] flex items-center justify-center">
        {bothPicked ? (
          revealComplete ? (
            <div className="flex flex-col items-center gap-2 fade-in-slow">
              <p className={["font-serif italic text-lg", isMatch ? "text-amber" : "text-cream/80"].join(" ")}>
                {isMatch ? "you both leaned the same way" : "different paths"}
              </p>
              <Button onClick={nextRound} className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90">
                Next round
              </Button>
            </div>
          ) : (
            <p
              className={["font-serif italic text-lg animate-pulse", isMatch ? "text-amber" : "text-cream/80"].join(
                " ",
              )}
            >
              {isMatch ? "✨ same pick" : "split"}
            </p>
          )
        ) : myPick ? (
          <p className="text-sm text-muted-foreground italic">waiting for them to pick…</p>
        ) : null}
      </div>
    </div>
  );
}
