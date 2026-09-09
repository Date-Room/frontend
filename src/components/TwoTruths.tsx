import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  TWO_TRUTHS_SPARKS,
  initialTwoTruthsState,
  reduceTwoTruths,
  twoTruthsFromJson,
} from "@/lib/activities/twoTruths";
import { useCinematic, type CinematicStep } from "@/lib/stagecraft/cinematic";
import { Scoreboard } from "@/lib/stagecraft/Scoreboard";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";

/**
 * 2 Truths and a Lie — press and stakes. Statements deal in one at a time;
 * the guesser may press exactly one (the storyteller elaborates out loud),
 * stakes the call (1 safe / 2 confident, wrong hands 2 to the liar), and the
 * unmasking seals the truths green one at a time before the lie flips.
 */

/** Cards land one at a time so you read their face between landings. */
const DEAL_STEPS: CinematicStep[] = [
  { id: "one", at: 300 },
  { id: "two", at: 1400 },
  { id: "three", at: 2500 },
  { id: "ready", at: 3300 },
];
const DEAL_RANK: Record<string, number> = { one: 1, two: 2, three: 3, ready: 4 };

/** The unmasking: call pins, truths seal green beat by beat, the lie flips. */
const UNMASK_STEPS: CinematicStep[] = [
  { id: "pin", at: 0 },
  { id: "seal1", at: 1100 },
  { id: "seal2", at: 2200 },
  { id: "flip", at: 3300 },
  { id: "settle", at: 4200 },
];
const UNMASK_RANK: Record<string, number> = { pin: 0, seal1: 1, seal2: 2, flip: 3, settle: 4 };

export function TwoTruths() {
  const { state, emit, senderId } = useReducedActivity(
    "2_truths",
    initialTwoTruthsState,
    twoTruthsFromJson,
    reduceTwoTruths,
  );
  const partnerName = usePartnerName();

  const [drafts, setDrafts] = useState(["", "", ""]);
  const [lie, setLie] = useState<number | null>(null);
  const [suspect, setSuspect] = useState<number | null>(null);
  const [stake, setStake] = useState<1 | 2>(1);
  const [skippedPress, setSkippedPress] = useState(false);
  const [pressPick, setPressPick] = useState<number | null>(null);

  const round = state.round;
  const isStoryteller = round?.storyteller_id === senderId;
  const myScore = state.scores[senderId] ?? 0;
  const theirScore = Object.entries(state.scores).reduce((n, [k, v]) => (k === senderId ? n : n + v), 0);

  const scoreboard = (
    <Scoreboard
      label="Points"
      entries={[
        { name: "You", value: myScore, accent: true },
        { name: partnerName, value: theirScore },
      ]}
    />
  );

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;
  const quietBtn = "rounded-full border-white/20 text-cream hover:bg-white/5";

  const guessing = round?.phase === "guessing";
  const revealing = round?.phase === "revealing";

  // Deal-in for the guesser; unmask for both. Witnessed-live rules apply.
  const deal = useCinematic(Boolean(guessing && !isStoryteller), DEAL_STEPS);
  const dealtRank = guessing && !isStoryteller ? (deal.witnessed ? DEAL_RANK[deal.stage ?? ""] ?? 0 : 4) : 4;
  const unmask = useCinematic(Boolean(revealing), UNMASK_STEPS);
  const unmaskRank = revealing ? (unmask.witnessed ? UNMASK_RANK[unmask.stage ?? "pin"] ?? 0 : 4) : -1;
  const settled = unmaskRank >= 4;

  // No round — anyone can claim the storyteller seat.
  if (!round) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center animate-fade-in">
        <p className="font-serif text-2xl italic text-cream">Two truths and a lie</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          One of you tells three things, two true and one made up. The other presses, stakes, and calls the lie.
        </p>
        {scoreboard}
        <Button
          onClick={() => {
            setDrafts(["", "", ""]);
            setLie(null);
            setSuspect(null);
            setStake(1);
            setSkippedPress(false);
            setPressPick(null);
            emit("claim_turn");
          }}
          className={accentBtn}
          style={accentStyle}
        >
          I&apos;ll go first
        </Button>
      </div>
    );
  }

  // Composing.
  if (round.phase === "composing") {
    if (!isStoryteller) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center animate-fade-in">
          <p className="text-lg font-medium text-cream">{partnerName} is writing their three…</p>
          <p className="text-xs text-muted-foreground">Two are true. One is about to be invented.</p>
          {scoreboard}
        </div>
      );
    }
    const canSubmit = drafts.every((d) => d.trim().length > 2) && lie !== null;
    return (
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-serif text-xl italic text-cream">Write three</p>
          <p className="text-xs text-muted-foreground">
            Two true, one made up. Mark the lie — {partnerName} never sees the mark.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {drafts.map((d, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setLie(i)}
                aria-pressed={lie === i}
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
                placeholder={TWO_TRUTHS_SPARKS[(state.rounds_played * 3 + i) % TWO_TRUTHS_SPARKS.length]}
                className="bg-secondary/60 border-white/10 focus-visible:border-primary/40"
              />
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Stuck? The hints are sparks — the best lie sits right next to a strange truth.
        </p>
        <Button
          onClick={() => {
            if (lie === null) return;
            const trimmed = drafts.map((x) => x.trim());
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
          Seal them
        </Button>
      </div>
    );
  }

  const statements = round.statements ?? [];
  const lieIndex = round.lie_index ?? 0;
  const truthOrder = [0, 1, 2].filter((i) => i !== lieIndex);
  const sealedRank = (i: number) => (i === truthOrder[0] ? 1 : 2);
  const lieFlipped = revealing && (unmaskRank >= 3);
  const callPinned = revealing && unmaskRank >= 0;
  const rightCall = revealing && round.guess === lieIndex;

  const title = revealing
    ? settled
      ? rightCall
        ? isStoryteller ? `${partnerName} read you` : "You called it"
        : isStoryteller ? "Your lie walked free" : `${partnerName} fooled you`
      : unmaskRank >= 3
        ? "The lie turns over"
        : "The truths seal first"
    : isStoryteller
      ? round.pressed != null
        ? "You've been pressed"
        : `${partnerName} is reading you`
      : round.pressed == null && !skippedPress
        ? "Press one"
        : "Call the lie";

  const status = revealing
    ? settled
      ? rightCall
        ? `${round.stake ?? 1} point${(round.stake ?? 1) > 1 ? "s" : ""} to ${isStoryteller ? partnerName : "you"}. Ask about the lie — there's usually a story under it.`
        : `That one was true. ${round.stake ?? 1} point${(round.stake ?? 1) > 1 ? "s" : ""} to ${isStoryteller ? "you" : partnerName}. Ask about the lie anyway.`
      : "One of these was never true."
    : isStoryteller
      ? round.pressed != null
        ? "Say more about it. Out loud. Sell it."
        : "Watch them hover. Give nothing away."
      : round.pressed == null && !skippedPress
        ? "Make them elaborate on one statement, out loud. You only get one press."
        : `Pick your stake, then accuse the one ${partnerName} made up.`;

  const commitAccuse = () => {
    if (suspect == null) return;
    const right = suspect === lieIndex;
    emit(
      "guess",
      { guess: suspect, stake },
      {
        event_type: "called",
        payload: {
          text: `${right ? "caught the lie" : "fooled"} · ${stake} point${stake > 1 ? "s" : ""} ${right ? "won" : `to ${partnerName}`}`,
        },
      },
    );
    setSuspect(null);
  };

  return (
    <div className={["dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in", revealing && unmask.witnessed && !settled ? "dr-stageroom--dim" : ""].join(" ")}>
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex flex-col items-center gap-1 text-center">
        <p key={title} className="font-serif text-xl italic text-cream animate-fade-in">{title}</p>
        <p key={status} aria-live="polite" className="min-h-[1rem] max-w-sm text-xs text-muted-foreground animate-fade-in">
          {status}
        </p>
      </div>

      <div className="relative flex flex-1 flex-col justify-center gap-3">
        {statements.map((text, i) => {
          const dealtIn = isStoryteller || revealing || DEAL_RANK.one <= 0 || dealtRank >= Math.min(i + 1, 3);
          const isLie = i === lieIndex;
          const sealedTrue = revealing && !isLie && unmaskRank >= sealedRank(i);
          const flipped = lieFlipped && isLie;
          const isCalled = round.guess === i;
          const isPressed = round.pressed === i;
          const isSuspect = suspect === i && !revealing;
          const isPressPick = pressPick === i && !revealing;
          const canTap = !isStoryteller && guessing;
          return (
            <button
              key={i}
              type="button"
              disabled={isStoryteller || !guessing}
              onClick={() => {
                if (!canTap) return;
                if (round.pressed == null && !skippedPress) setPressPick(i);
                else setSuspect(i);
              }}
              className={[
                "dr-ttcard focus-ring relative rounded-2xl border p-4 text-left transition-all duration-300",
                flipped
                  ? "dr-ttcard--flip border-destructive/60 bg-destructive/10"
                  : sealedTrue
                    ? "dr-ttcard--sealed border-emerald-400/60 bg-emerald-400/10"
                    : isSuspect || isPressPick
                      ? "dr-lockin border-primary bg-primary/10"
                      : callPinned && isCalled && !settled
                        ? "border-primary bg-primary/10"
                        : "border-white/[0.10] bg-white/[0.03]",
                !dealtIn ? "opacity-0 translate-y-3" : "opacity-100",
                canTap && guessing ? "hover:-translate-y-0.5 hover:border-primary/50 cursor-pointer" : "",
              ].join(" ")}
            >
              <span className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 font-serif text-sm text-cream/80">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm sm:text-base leading-relaxed text-cream">{text}</span>
              </span>
              <span className="absolute -bottom-2.5 right-3 flex gap-1.5">
                {isPressed && (
                  <span className="rounded-full border border-rose/60 bg-background px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-rose">pressed</span>
                )}
                {(isCalled && (revealing || settled)) && (
                  <span className="rounded-full border border-primary/60 bg-background px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-primary">the call</span>
                )}
                {sealedTrue && (
                  <span className="rounded-full border border-emerald-400/60 bg-background px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-emerald-300">true</span>
                )}
                {flipped && (
                  <span className="rounded-full border border-destructive/60 bg-background px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-destructive">the lie</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative flex min-h-[5.5rem] flex-col items-center justify-center gap-3">
        {guessing && !isStoryteller && round.pressed == null && !skippedPress && dealtRank >= 4 && (
          <div className="flex flex-col items-center gap-2 animate-fade-in">
            {pressPick != null ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    emit("press", { index: pressPick });
                    setPressPick(null);
                  }}
                  className={accentBtn}
                  style={accentStyle}
                >
                  Press this one
                </Button>
                <Button onClick={() => setPressPick(null)} variant="outline" className={quietBtn}>
                  Not that one
                </Button>
              </div>
            ) : (
              <Button onClick={() => setSkippedPress(true)} variant="outline" className={quietBtn}>
                Skip the press — straight to the call
              </Button>
            )}
          </div>
        )}

        {guessing && !isStoryteller && (round.pressed != null || skippedPress) && (
          <div className="flex flex-col items-center gap-2 animate-fade-in">
            <div className="flex gap-2">
              {[1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStake(n as 1 | 2)}
                  className={[
                    "focus-ring rounded-2xl border px-4 py-2 text-left transition",
                    stake === n ? "border-primary bg-primary/10" : "border-white/15",
                  ].join(" ")}
                >
                  <span className="block font-serif text-lg text-cream">{n === 1 ? "1 · Play it safe" : "2 · I've got them"}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {n === 1 ? "One point either way." : `Wrong, and ${partnerName} takes two.`}
                  </span>
                </button>
              ))}
            </div>
            {suspect != null && (
              <Button onClick={commitAccuse} className={accentBtn + " animate-fade-in"} style={accentStyle}>
                Accuse · {stake} point{stake > 1 ? "s" : ""}
              </Button>
            )}
          </div>
        )}

        {guessing && isStoryteller && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {round.pressed != null ? "elaborate, then hold your nerve…" : `waiting on ${partnerName}'s call…`}
          </p>
        )}

        {settled && (
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            {scoreboard}
            <Button onClick={() => emit("reveal_and_swap")} className={accentBtn} style={accentStyle}>
              Next round — swap
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
