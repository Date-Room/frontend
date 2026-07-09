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

  // Live partner events. When a partner event lands AND we can
  // persist, write the converged state to durable — so the round /
  // pick survives a reload even if only one side is signed in
  // (matches mobile's "persist on partner's behalf" semantics).
  // `promptIndex` is referenced inline rather than `idx` because
  // `idx` is declared below this effect — closing over it would
  // hit a TDZ on first render.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      const isPartner = e.userId !== me;
      if (e.type === "pick") {
        const c = e.payload.pick;
        if (c !== "left" && c !== "right") return;
        setPicks((prev) => {
          const next = { ...prev, [e.userId]: c };
          if (isPartner && room.canPersist) {
            void session.persist({ prompt_index: promptIndex, picks: next });
          }
          return next;
        });
      } else if (e.type === "next_prompt") {
        const ni = typeof e.payload.prompt_index === "number" ? e.payload.prompt_index : 0;
        setPromptIndex(ni);
        setPicks({});
        if (isPartner && room.canPersist) {
          void session.persist({ prompt_index: ni, picks: {} });
        }
      }
    });
  }, [session, me, promptIndex, room.canPersist]);

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
          "focus-ring group relative flex-1 rounded-2xl border p-6 sm:p-8 min-h-[180px] md:min-h-[260px] flex flex-col items-center justify-center gap-4 text-center transition-all duration-500",
          chosenByMe && chosenByOther
            ? "border-primary bg-primary/15 scale-[1.02]"
            : chosenByMe
              ? "border-primary bg-primary/10"
              : chosenByOther
                ? "border-rose bg-rose/10"
                : reveal
                  ? "border-white/[0.08] bg-white/[0.02]"
                  : "border-white/[0.10] bg-white/[0.02] hover:border-primary/50 hover:-translate-y-0.5",
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
        <div className="text-xl font-medium text-cream">{opt.label}</div>
        {reveal && (chosenByMe || chosenByOther) && (
          <div className="flex gap-2 mt-1 text-[10px] uppercase tracking-[0.25em] font-medium">
            {chosenByMe && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">you</span>
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
    <div className="flex flex-col h-full gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground text-center">
        Round {idx + 1} · pick one
      </div>
      <div className="flex-1 flex flex-col md:flex-row items-stretch gap-3 max-w-3xl mx-auto w-full">
        <Card side="a" opt={pair.a} />
        <div className="flex items-center justify-center text-muted-foreground/70">
          <span className="px-2 text-[10px] uppercase tracking-[0.32em]">or</span>
        </div>
        <Card side="b" opt={pair.b} />
      </div>
      <div className="min-h-[3.5rem] flex items-center justify-center">
        {bothPicked ? (
          revealComplete ? (
            <div className="flex flex-col items-center gap-3 fade-in-slow">
              <p className={["text-lg font-medium", isMatch ? "text-primary" : "text-cream/80"].join(" ")}>
                {isMatch ? "you both leaned the same way" : "different paths"}
              </p>
              <Button
                onClick={nextRound}
                className="rounded-full text-primary-foreground hover:opacity-90"
                style={{ backgroundColor: "var(--room-accent)" }}
              >
                Next round
              </Button>
            </div>
          ) : (
            <p
              className={["text-lg font-medium animate-pulse", isMatch ? "text-primary" : "text-cream/80"].join(" ")}
            >
              {isMatch ? "✨ same pick" : "split"}
            </p>
          )
        ) : myPick ? (
          <p className="text-sm text-muted-foreground">waiting for them to pick…</p>
        ) : null}
      </div>
    </div>
  );
}
