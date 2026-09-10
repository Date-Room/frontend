import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  OB_PASSES,
  OB_REACTIONS,
  OB_TOPICS,
  OB_WRITE_MAX,
  OB_WRITE_MIN,
  buildObDeck,
  initialObState,
  obFromJson,
  obSlots,
  obTopic,
  reduceOb,
  rollTopicQuestions,
} from "@/lib/activities/openBook";
import { useCinematic, type CinematicStep } from "@/lib/stagecraft/cinematic";
import { GameLanding } from "@/lib/stagecraft/GameLanding";
import { useTypewriter } from "@/lib/stagecraft/typewriter";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";

/**
 * Open Book (activity id "questions") — draft topics, not questions. See
 * lib/activities/openBook.ts for the rules. This component keeps the old
 * QuestionDeck name/file so the launcher wiring stays untouched.
 */

const DEAL_STEPS: CinematicStep[] = [
  { id: "shuffle", at: 0 },
  { id: "bins", at: 1000 },
  { id: "card", at: 2600 },
];

const HEAT_STYLE: Record<string, string> = {
  Warm: "text-muted-foreground",
  Real: "text-amber-300",
  Close: "text-rose",
};

export function QuestionDeck() {
  const { state, emit, senderId } = useReducedActivity(
    "questions",
    initialObState,
    obFromJson,
    reduceOb,
  );
  const partnerName = usePartnerName();
  const [draftText, setDraftText] = useState("");
  const [binPick, setBinPick] = useState<string | null>(null);
  const [swapPick, setSwapPick] = useState<string | null>(null);

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;
  const quietBtn = "rounded-full border-white/20 text-cream hover:bg-white/5";

  const playing = state.phase === "play";
  const { stage, witnessed } = useCinematic(playing, DEAL_STEPS);
  const dealRank = playing ? (witnessed ? { shuffle: 0, bins: 1, card: 2 }[stage ?? "shuffle"] ?? 0 : 2) : -1;

  const deck = state.phase === "play" || state.phase === "done" ? buildObDeck(state) : [];
  const card = deck[Math.min(state.card, Math.max(deck.length - 1, 0))];
  const onCard = playing && dealRank >= 2 && card != null;
  const typed = useTypewriter(card?.q ?? "", onCard || state.phase === "done");

  const slots = obSlots(state.target);
  const starterTurn = state.claims.length % 2 === 0;
  const iAmStarter = state.starter_id === senderId;
  const myTurn = state.phase === "draft" && (starterTurn ? iAmStarter : !iAmStarter);
  const iWrote = senderId in state.writes;
  const iVetoed = senderId in state.vetoes;
  const myVeto = state.vetoes[senderId];
  const theirVeto = Object.entries(state.vetoes).find(([uid]) => uid !== senderId)?.[1];

  const claimTopic = (id: string) => {
    const t = obTopic(id);
    if (!t || !myTurn) return;
    emit(
      "claim",
      { topic: id, q: rollTopicQuestions(t, state.seen[id] ?? []) },
      { event_type: "claimed", payload: { text: `claimed ${t.name}` } },
    );
  };

  const confirmVeto = () => {
    if (!binPick || !swapPick) return;
    const t = obTopic(swapPick);
    if (!t) return;
    emit("veto", { binned: binPick, swap: swapPick, q: rollTopicQuestions(t, state.seen[swapPick] ?? []) });
    setBinPick(null);
    setSwapPick(null);
  };

  // ── Landing / setup ──
  if (state.phase === "setup") {
    return (
      <GameLanding
        title="Open Book"
        promise="No lists to scroll. You draft topics, each one deals three questions, and the night escalates from warm to close."
        minutes="≈ 45–60 min"
        beats={[
          "Take turns claiming topics. Each topic asks three questions: an opener, a specific, a costly one.",
          `You each write one question of your own. It replaces a card, and it buys you a veto of one topic ${partnerName} chose.`,
          `One card at a time, out loud. You answer the cards ${partnerName} chose; say "That's my answer" and they rule it: answered, half of it, or dodged. Pass twice a night. Everything survives to the recap.`,
        ]}
      >
        <div className="flex gap-3">
          {[15, 21].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => emit("choose_length", { target: n })}
              className="focus-ring flex flex-col items-center gap-0.5 rounded-2xl border border-white/15 px-6 py-3 transition hover:border-primary/50 hover:bg-white/[0.04]"
            >
              <span className="font-serif text-2xl text-cream">{n}</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {n / 3} topics · {n === 15 ? "≈ 45 min" : "the long way round"}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Whoever picks the length drafts first.</p>
      </GameLanding>
    );
  }

  // ── Draft ──
  if (state.phase === "draft") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <p className="font-serif text-xl italic text-cream">
            {myTurn ? "Your topic" : `${partnerName} is choosing`}
          </p>
          <p className="text-xs text-muted-foreground">
            {slots - state.claims.length} pick{slots - state.claims.length === 1 ? "" : "s"} left between you. Each topic deals three questions.
          </p>
        </div>
        <div className="grid flex-1 grid-cols-2 content-start gap-2.5">
          {OB_TOPICS.map((t) => {
            const claim = state.claims.find((c) => c.topic === t.id);
            const byMe = claim?.user === senderId;
            const taken = claim != null;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!myTurn || taken}
                onClick={() => claimTopic(t.id)}
                className={[
                  "focus-ring flex flex-col gap-0.5 rounded-2xl border p-3 text-left transition",
                  byMe
                    ? "border-primary bg-primary/10"
                    : taken
                      ? "border-rose/50 bg-rose/5 opacity-80"
                      : "border-white/[0.10] bg-white/[0.03]",
                  myTurn && !taken ? "hover:-translate-y-0.5 hover:border-primary/50 cursor-pointer" : "",
                ].join(" ")}
              >
                <span className={["text-[9px] uppercase tracking-[0.2em]", HEAT_STYLE[t.heat]].join(" ")}>{t.heat}</span>
                <span className="font-serif text-sm text-cream leading-tight">{t.name}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">{t.note}</span>
                <span className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                  {byMe ? "yours" : taken ? `${partnerName}'s` : "3 questions"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Write ──
  if (state.phase === "write") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <p className="font-serif text-xl italic text-cream">One of your own</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            It replaces a card rather than adding one, and it buys you a veto of one of {partnerName}&apos;s topics.
          </p>
        </div>
        {iWrote ? (
          <p className="text-sm text-muted-foreground animate-pulse">sealed · waiting for {partnerName}&apos;s question…</p>
        ) : (
          <>
            <textarea
              rows={3}
              maxLength={OB_WRITE_MAX}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={`Ask ${partnerName} the thing you wouldn't put in a message…`}
              className="w-full max-w-md rounded-2xl border border-white/15 bg-secondary/60 p-4 text-sm text-cream outline-none focus:border-primary/50"
            />
            <p className="text-[10px] text-muted-foreground">{draftText.length}/{OB_WRITE_MAX}</p>
            <Button
              onClick={() => emit("write", { text: draftText })}
              disabled={draftText.trim().length < OB_WRITE_MIN}
              className={accentBtn}
              style={accentStyle}
            >
              Seal my question
            </Button>
          </>
        )}
      </div>
    );
  }

  // ── Veto ──
  if (state.phase === "veto") {
    const theirClaims = state.claims.filter((c) => c.user !== senderId);
    const takenIds = new Set([
      ...state.claims.map((c) => c.topic),
      ...Object.values(state.vetoes).map((v) => v.swap),
    ]);
    const options = OB_TOPICS.filter((t) => !takenIds.has(t.id));
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <p className="font-serif text-xl italic text-cream">
            {iVetoed ? "Veto sealed" : `Bin one of ${partnerName}'s`}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {iVetoed
              ? `waiting for ${partnerName}'s veto… one of yours goes the same way.`
              : "Writing a question bought you this. Choose what replaces it."}
          </p>
        </div>
        {!iVetoed && (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {theirClaims.map((c) => {
                const t = obTopic(c.topic)!;
                const gone = Object.values(state.vetoes).some((v) => v.binned === c.topic);
                return (
                  <button
                    key={c.topic}
                    type="button"
                    disabled={gone}
                    onClick={() => setBinPick(c.topic)}
                    className={[
                      "focus-ring rounded-full border px-3 py-1.5 text-xs transition",
                      binPick === c.topic
                        ? "border-destructive/60 text-destructive line-through"
                        : "border-white/15 text-cream hover:border-destructive/50",
                      gone ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            {binPick && (
              <>
                <p className="text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground">replace it with</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {options.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSwapPick(t.id)}
                      className={[
                        "focus-ring rounded-full border px-3 py-1.5 text-xs transition",
                        swapPick === t.id ? "border-primary text-primary" : "border-white/15 text-cream hover:border-primary/50",
                      ].join(" ")}
                    >
                      {t.name} <span className={["ml-1", HEAT_STYLE[t.heat]].join(" ")}>· {t.heat}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-center">
              <Button onClick={confirmVeto} disabled={!binPick || !swapPick} className={accentBtn} style={accentStyle}>
                Deal the night
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Done ──
  if (state.phase === "done") {
    // How each of you showed up: verdicts received on the cards you answered
    // (you answer the cards your date chose or wrote).
    const tally = (answeredByMe: boolean) => {
      const t = { answered: 0, half: 0, dodged: 0 };
      deck.forEach((c, i) => {
        const mineToAnswer = c.by !== senderId;
        if (mineToAnswer !== answeredByMe) return;
        const v = state.rulings[String(i)];
        if (v) t[v] += 1;
      });
      return t;
    };
    const myTally = tally(true);
    const theirTally = tally(false);
    const showTallies = Object.keys(state.rulings).length > 0;
    const comeBack = deck
      .map((c, i) => ({ c, i }))
      .filter(({ i }) => state.passes.includes(i) || state.rulings[String(i)] === "dodged");
    const tallyLine = (t: { answered: number; half: number; dodged: number }) =>
      `${t.answered} answered · ${t.half} half · ${t.dodged} dodged`;
    const VERDICT_CHIP: Record<string, [string, string]> = {
      answered: ["answered", "text-emerald-300"],
      half: ["half of it", "text-amber-300"],
      dodged: ["dodged", "text-destructive"],
    };
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <p className="font-serif text-2xl italic text-cream">The whole night</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {deck.length - state.passes.length} of {deck.length} answered.{" "}
            {comeBack.length
              ? "The passed and dodged ones are worth coming back to."
              : "Nothing passed, nothing dodged."}
          </p>
        </div>
        {showTallies && (
          <div className="flex shrink-0 flex-col items-center gap-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              How you showed up
            </p>
            <p className="text-xs text-cream/85">
              <span className="text-primary">You</span> · {tallyLine(myTally)}
            </p>
            <p className="text-xs text-cream/85">
              <span className="text-rose">{partnerName}</span> · {tallyLine(theirTally)}
            </p>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          {deck.map((c, i) => {
            const passed = state.passes.includes(i);
            const verdict = state.rulings[String(i)];
            const chip = verdict ? VERDICT_CHIP[verdict] : null;
            const rx = Object.values(state.reacts[String(i)] ?? {});
            return (
              <div
                key={i}
                className={[
                  "rounded-2xl border p-3",
                  passed ? "border-dashed border-white/15 opacity-70" : "border-white/[0.08] bg-white/[0.02]",
                ].join(" ")}
              >
                <p className="text-sm leading-relaxed text-cream/90">&ldquo;{c.q}&rdquo;</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span className={c.by === senderId ? "text-primary" : "text-rose"}>
                    {c.written ? `written by ${c.by === senderId ? "you" : partnerName}` : `${c.topicName} · ${c.by === senderId ? "yours" : `${partnerName}'s`}`}
                  </span>
                  {rx.map((e, j) => (
                    <span key={j} className="text-sm">{e}</span>
                  ))}
                  {chip && <span className={chip[1]}>{chip[0]}</span>}
                  {passed && <span className="text-destructive">passed</span>}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center">
          <Button
            onClick={() =>
              emit("restart", {}, {
                event_type: "night",
                payload: { text: `${deck.length - state.passes.length} of ${deck.length} answered` },
              })
            }
            className={accentBtn}
            style={accentStyle}
          >
            New night
          </Button>
        </div>
      </div>
    );
  }

  // ── Play ──
  return (
    <div className={["dr-stageroom flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in", "dr-stageroom--dim"].join(" ")}>
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex shrink-0 flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Card {Math.min(state.card + 1, deck.length)} of {deck.length}
        </p>
        <p className="font-serif text-xl italic text-cream">
          {dealRank < 2 ? "Shuffling" : card?.heat === "Close" ? "Deeper in" : card?.topicName}
        </p>
      </div>

      {dealRank < 2 ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="dr-tod-back relative h-14 w-10 animate-fade-in rounded-lg"
                style={{ position: "relative", animationDelay: `${i * 110}ms` }}
              />
            ))}
          </div>
          {dealRank >= 1 && (
            <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground animate-fade-in">
              {theirVeto && (
                <p>
                  {partnerName} binned <span className="text-rose">{obTopic(theirVeto.binned)?.name}</span> from your side.
                </p>
              )}
              {myVeto && (
                <p>
                  You binned <span className="text-primary">{obTopic(myVeto.binned)?.name}</span> from theirs.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        card && (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
            <div className="dr-beam" aria-hidden />
            <blockquote
              key={state.card}
              className={["dr-plaque w-full max-w-md text-left", typed.complete ? "dr-plaque--settled" : ""].join(" ")}
              style={card.written ? { borderColor: "color-mix(in srgb, var(--room-accent) 70%, transparent)" } : undefined}
            >
              <span className="dr-plaque-glyph" aria-hidden>{card.written ? "✍" : "?"}</span>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--room-accent)" }}>
                {card.written
                  ? `written by ${card.by === senderId ? "you" : partnerName}`
                  : `${card.topicName} · ${card.heat} · ${card.by === senderId ? "yours" : `${partnerName}'s`}`}
              </p>
              <p aria-live="polite" className="mt-2 font-serif text-lg sm:text-xl italic leading-snug text-cream">
                {typed.shown}
                {!typed.complete && <span className="dr-caret" aria-hidden />}
              </p>
            </blockquote>

            <div className="flex gap-2">
              {OB_REACTIONS.map((r) => {
                const mineNow = state.reacts[String(state.card)]?.[senderId] === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-label={`React ${r}`}
                    onClick={() => emit("react", { index: state.card, emoji: r })}
                    className={[
                      "focus-ring flex h-10 w-10 items-center justify-center rounded-full border text-lg transition hover:-translate-y-0.5",
                      mineNow ? "border-primary bg-primary/15 scale-110" : "border-white/15",
                    ].join(" ")}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            {typed.complete &&
              (card.by !== senderId ? (
                // The card is theirs — I answer it.
                !state.answered ? (
                  <div className="flex flex-col items-center gap-2 animate-fade-in">
                    <p className="text-xs text-muted-foreground">This one's for you. Out loud.</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => emit("my_answer", { index: state.card })}
                        className={accentBtn}
                        style={accentStyle}
                      >
                        That&apos;s my answer
                      </Button>
                      <Button
                        onClick={() => emit("pass", { index: state.card })}
                        disabled={state.passes.length >= OB_PASSES}
                        variant="outline"
                        className={quietBtn}
                      >
                        Pass ({OB_PASSES - state.passes.length} left)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    {partnerName} heard you. They&apos;re ruling it…
                  </p>
                )
              ) : // The card is mine — they answer, then I rule it.
              !state.answered ? (
                <p className="text-sm text-muted-foreground animate-fade-in">
                  {partnerName} answers this one. Listen.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-2 animate-fade-in">
                  <p className="text-xs text-muted-foreground">Did they? Your ruling is noticing, not scoring.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      onClick={() =>
                        emit("rule", { index: state.card, verdict: "answered" }, {
                          event_type: "ruled",
                          payload: { text: `answered · ${card.written ? "a written question" : card.topicName}` },
                        })
                      }
                      className="rounded-full border border-emerald-400/60 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                      variant="outline"
                    >
                      Answered
                    </Button>
                    <Button
                      onClick={() =>
                        emit("rule", { index: state.card, verdict: "half" }, {
                          event_type: "ruled",
                          payload: { text: `half of it · ${card.written ? "a written question" : card.topicName}` },
                        })
                      }
                      className="rounded-full border border-amber-300/50 bg-amber-300/10 text-amber-300 hover:bg-amber-300/20"
                      variant="outline"
                    >
                      Half of it
                    </Button>
                    <Button
                      onClick={() =>
                        emit("rule", { index: state.card, verdict: "dodged" }, {
                          event_type: "ruled",
                          payload: { text: `dodged · ${card.written ? "a written question" : card.topicName}` },
                        })
                      }
                      className="rounded-full border border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20"
                      variant="outline"
                    >
                      Dodged it
                    </Button>
                  </div>
                </div>
              ))}

            <ol className="flex flex-wrap justify-center gap-1" aria-hidden>
              {deck.map((c, i) => (
                <li
                  key={i}
                  className={[
                    "rounded-full",
                    c.written ? "h-2 w-2.5" : "h-1 w-2.5",
                    i === state.card
                      ? "bg-[var(--room-accent)]"
                      : state.passes.includes(i)
                        ? "bg-destructive/70"
                        : i < state.card
                          ? "bg-white/40"
                          : "bg-white/10",
                  ].join(" ")}
                />
              ))}
            </ol>
          </div>
        )
      )}
    </div>
  );
}
