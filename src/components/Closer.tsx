import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  CL_EYES_SECONDS,
  CL_EYES_UNLOCK,
  CL_NOTE_MAX,
  CL_QUESTIONS,
  CL_SET_NAMES,
  CL_SPEAK_SECONDS,
  CL_TOTAL,
  clAnswererIsStarter,
  clAtEnd,
  clEngagement,
  clFromJson,
  clStretchWindow,
  initialClState,
  reduceCloser,
  type ClVerdict,
} from "@/lib/activities/closer";
import { GameLanding } from "@/lib/stagecraft/GameLanding";
import { useTypewriter } from "@/lib/stagecraft/typewriter";
import { setHelpNow } from "@/lib/activityHelpNow";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";
import { TRY_CAPS, useTryRoom } from "@/lib/tryDemo";
import { TryCurtain } from "@/components/TryCurtain";

/**
 * Closer (activity id "the_36") — the 36 questions in stoppable stretches.
 * The answerer declares "That's my answer"; the listener rules it Answered /
 * Half of it / Dodged it. Stopping saves your place; the night can end on
 * four minutes of silence.
 */

const mmss = (s: number) => {
  const v = Math.max(s, 0);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

const SET_TONE: Record<number, string> = {
  1: "text-muted-foreground",
  2: "text-amber-300",
  3: "text-rose",
};

export function Closer() {
  const { state, emit, senderId } = useReducedActivity(
    "the_36",
    initialClState,
    clFromJson,
    reduceCloser,
  );
  const partnerName = usePartnerName();
  const tryRoom = useTryRoom();

  const [stretchPick, setStretchPick] = useState<3 | 6 | 12>(3);
  const [startAt, setStartAt] = useState(0);
  const [keepPick, setKeepPick] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;
  const quietBtn = "rounded-full border-white/20 text-cream hover:bg-white/5";

  const q = CL_QUESTIONS[Math.min(state.n, CL_TOTAL - 1)];
  const inTurns = state.phase === "turns";
  const typed = useTypewriter(q.q, inTurns);
  const iAnswer = inTurns && state.sub === "answering" &&
    (clAnswererIsStarter(state) ? senderId === state.starter_id : senderId !== state.starter_id);
  const iRule = inTurns && state.sub === "ruling" && state.answerer_id != null && state.answerer_id !== senderId;

  // "Right now" help snapshot (see lib/activityHelpNow).
  useEffect(() => {
    const snap =
      state.phase === "setup"
        ? { now: "Pick a stretch: 3, 6 or 12 questions. Stopping later saves your place.", step: 0 }
        : state.phase === "turns"
          ? state.sub === "answering"
            ? iAnswer
              ? { now: "Your turn. Answer out loud, then tap That's my answer.", step: 1 }
              : { now: `Listen — ${partnerName} is answering.`, step: 1 }
            : iRule
              ? { now: "Rule what you heard: Answered, Half of it, or Dodged it.", step: 2 }
              : { now: `${partnerName} is ruling what they heard.`, step: 2 }
          : state.phase === "keep"
            ? { now: `Save one line you heard from ${partnerName}.`, step: 3 }
            : state.phase === "eyes"
              ? { now: "Four minutes. Just look.", step: 3 }
              : { now: "Continue together, or stop here — stopping saves your place.", step: 3 };
    setHelpNow("the_36", snap);
  }, [state.phase, state.sub, iAnswer, iRule, partnerName]);

  // The loose clock: counts, never cuts anyone off. Local per turn.
  const [clock, setClock] = useState(CL_SPEAK_SECONDS);
  useEffect(() => {
    if (!inTurns) return;
    setClock(CL_SPEAK_SECONDS);
    const id = window.setInterval(() => setClock((c) => c - 1), 1000);
    return () => window.clearInterval(id);
  }, [inTurns, state.n, state.turn]);

  // The four minutes, derived from the shared start timestamp.
  const [eyesLeft, setEyesLeft] = useState(CL_EYES_SECONDS);
  useEffect(() => {
    if (state.phase !== "eyes" || !state.eyes_started_at) return;
    const started = Date.parse(state.eyes_started_at);
    const tick = () => setEyesLeft(Math.max(0, CL_EYES_SECONDS - Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state.phase, state.eyes_started_at]);
  useEffect(() => {
    if (state.phase === "eyes" && eyesLeft <= 0) emit("end_eyes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eyesLeft, state.phase]);

  useEffect(() => {
    setKeepPick(null);
    setNote("");
  }, [state.phase]);

  // ── Setup ──
  if (state.phase === "setup") {
    return (
      <GameLanding
        title="Closer"
        promise="The 36 questions from a 1997 closeness study, in short stoppable stretches. You never have to finish it, and stopping saves your place."
        minutes="≈ 10 min per stretch of 3"
        beats={[
          "Pick a stretch: 3, 6 or 12 questions. Every stretch ends on a real off-ramp.",
          `You both answer each question out loud, in turns. When you finish, ${partnerName} rules it: answered, half of it, or dodged it. That's noticing, not scoring.`,
          "Each stretch, you both keep one line you heard. The night can close on four minutes of silent eye contact.",
        ]}
      >
        <div className="flex gap-2.5">
          {(tryRoom ? ([3] as const) : ([3, 6, 12] as const)).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setStretchPick(v)}
              className={[
                "focus-ring flex flex-col items-center gap-0.5 rounded-2xl border px-5 py-3 transition",
                stretchPick === v ? "border-primary bg-primary/10" : "border-white/15 hover:border-primary/50",
              ].join(" ")}
            >
              <span className="font-serif text-2xl text-cream">{v}</span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {v === 3 ? "a taste · 10 min" : v === 6 ? "a stretch · 25 min" : "a full set · the long one"}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Start at question</span>
          <button type="button" onClick={() => setStartAt((v) => Math.max(0, v - 1))} className="focus-ring h-7 w-7 rounded-full border border-white/15 text-cream">−</button>
          <span className="w-6 text-center font-serif text-base text-cream tabular-nums">{startAt + 1}</span>
          <button type="button" onClick={() => setStartAt((v) => Math.min(CL_TOTAL - 1, v + 1))} className="focus-ring h-7 w-7 rounded-full border border-white/15 text-cream">+</button>
          <span className="text-muted-foreground/70">(picked up from a past date)</span>
        </div>
        <Button onClick={() => emit("begin", { stretch: stretchPick, start_at: startAt })} className={accentBtn} style={accentStyle}>
          Begin at question {startAt + 1}
        </Button>
        <p className="text-[10px] text-muted-foreground/70">After Aron et al. (1997).</p>
      </GameLanding>
    );
  }

  // ── Done ──
  if (state.phase === "done") {
    const mine = clEngagement(state, senderId);
    const theirsId = state.rulings.find((r) => r.answerer !== senderId)?.answerer;
    const theirs = theirsId ? clEngagement(state, theirsId) : null;
    const dodged = state.rulings.filter((r) => r.verdict === "dodged");
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <p className="font-serif text-2xl italic text-cream">{state.banked ? "Banked" : "The whole thing"}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {state.banked
              ? `You stopped at question ${state.n + 1} on purpose. Set ${q.set}, ${CL_SET_NAMES[q.set]}, is where you pick up next date.`
              : state.did_eyes
                ? "You went all the way through, and sat in the silence."
                : "All thirty-six, answered."}
          </p>
        </div>

        {state.keeps.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--room-accent)" }}>What you kept</p>
            {state.keeps.map((k, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{CL_QUESTIONS[k.q]?.q}</p>
                <p className="mt-1 text-sm italic text-cream/90">
                  &ldquo;{k.note}&rdquo;
                  <span className="ml-2 text-[10px] not-italic uppercase tracking-[0.16em] text-muted-foreground">
                    kept by {k.by === senderId ? "you" : partnerName}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--room-accent)" }}>How you showed up</p>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            {[{ name: "You", e: mine }, theirs ? { name: partnerName, e: theirs } : null].map(
              (row) =>
                row && (
                  <div key={row.name} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{row.name}</p>
                    <p className="mt-1 text-cream/90">
                      {row.e.answered} answered · {row.e.half} half · {row.e.dodged} dodged
                    </p>
                  </div>
                ),
            )}
          </div>
          {dodged.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Worth returning to: {dodged.map((r) => `"${CL_QUESTIONS[r.q]?.q}"`).join("  ")}
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <Button onClick={() => emit("restart")} variant="outline" className={quietBtn}>
            Start again
          </Button>
        </div>
      </div>
    );
  }

  // ── Eyes ──
  if (state.phase === "eyes") {
    return (
      <div className="dr-stageroom dr-stageroom--dim flex h-full min-h-0 flex-col items-center justify-center gap-6 p-6 animate-fade-in">
        <div className="dr-stageroom-shade" aria-hidden />
        <div className="relative flex shrink-0 flex-col items-center gap-1 text-center">
          <p className="font-serif text-2xl italic text-cream">Four minutes</p>
          <p className="text-xs text-muted-foreground">No talking. Look at each other until the time runs out.</p>
        </div>
        <div className="dr-breathe relative flex h-44 w-44 items-center justify-center rounded-full border border-white/15" aria-hidden>
          <span className="h-24 w-24 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--room-accent) 35%, transparent), transparent 70%)" }} />
        </div>
        <p className="relative font-serif text-3xl text-cream tabular-nums">{mmss(eyesLeft)}</p>
        <Button onClick={() => emit("end_eyes")} variant="outline" className={quietBtn + " relative"}>
          End it early
        </Button>
      </div>
    );
  }

  // ── Keep ──
  if (state.phase === "keep") {
    const iKept = state.keep_done.includes(senderId);
    const window_ = clStretchWindow(state);
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <p className="font-serif text-xl italic text-cream">{iKept ? "Kept" : "Keep one"}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {iKept
              ? `waiting for ${partnerName} to keep one…`
              : `One answer of ${partnerName}'s from this stretch stays with you. Note what you heard.`}
          </p>
        </div>
        {!iKept && (
          <>
            <div className="flex flex-col gap-2">
              {window_.map((qi) => (
                <button
                  key={qi}
                  type="button"
                  onClick={() => setKeepPick(qi)}
                  className={[
                    "focus-ring rounded-2xl border p-3 text-left text-sm transition",
                    keepPick === qi ? "border-primary bg-primary/10 text-cream" : "border-white/[0.10] text-cream/85 hover:border-primary/50",
                  ].join(" ")}
                >
                  {CL_QUESTIONS[qi].q}
                </button>
              ))}
            </div>
            {keepPick != null && (
              <>
                <textarea
                  rows={2}
                  maxLength={CL_NOTE_MAX}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={`What ${partnerName} said, as you heard it…`}
                  className="w-full rounded-2xl border border-white/15 bg-secondary/60 p-3 text-sm text-cream outline-none focus:border-primary/50"
                />
                <div className="flex justify-center">
                  <Button
                    onClick={() => emit("keep", { q: keepPick, note })}
                    disabled={note.trim().length < 2}
                    className={accentBtn}
                    style={accentStyle}
                  >
                    Keep this one
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Landing ──
  if (state.phase === "landing") {
    const atEnd = clAtEnd(state);
    const iVoted = state.continue_votes.includes(senderId);
    const next = CL_QUESTIONS[Math.min(state.n + 1, CL_TOTAL - 1)];
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in text-center">
        <p className="font-serif text-xl italic text-cream">
          {atEnd ? "That's all thirty-six" : `Stop here, or ${state.stretch} more`}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {state.n + 1} of {CL_TOTAL} asked · {state.keeps.length} kept.{" "}
          {atEnd
            ? "There's one thing left, and it isn't a question."
            : `This is a real stopping point. Next up: set ${next.set}, ${CL_SET_NAMES[next.set]}.${next.set === 3 && q.set !== 3 ? " Set three goes to heavy places; go there on purpose." : ""}`}
        </p>
        {state.keeps.slice(-2).map((k, i) => (
          <p key={i} className="max-w-sm text-xs italic text-cream/80">
            &ldquo;{k.note}&rdquo; <span className="not-italic text-muted-foreground">· kept by {k.by === senderId ? "you" : partnerName}</span>
          </p>
        ))}
        <div className="flex flex-wrap justify-center gap-2">
          {!atEnd && tryRoom ? (
            <TryCurtain line="Your place is saved at this question. The next stretch continues in a date room." />
          ) : !atEnd ? (
            <Button onClick={() => emit("continue")} disabled={iVoted} className={accentBtn} style={accentStyle}>
              {iVoted ? `waiting for ${partnerName}…` : `${state.stretch} more`}
            </Button>
          ) : null}
          {atEnd ? (
            <Button onClick={() => emit("start_eyes", { at: new Date().toISOString() })} className={accentBtn} style={accentStyle}>
              The last four minutes
            </Button>
          ) : (
            <Button onClick={() => emit("stop", {}, { event_type: "banked", payload: { text: `stopped at question ${state.n + 1}, set ${q.set}` } })} variant="outline" className={quietBtn}>
              Stop here — save our place
            </Button>
          )}
        </div>
        {!atEnd && state.n + 1 >= CL_EYES_UNLOCK && (
          <button
            type="button"
            onClick={() => emit("start_eyes", { at: new Date().toISOString() })}
            className="text-xs text-muted-foreground underline hover:text-cream"
          >
            Skip to the four minutes of silence
          </button>
        )}
      </div>
    );
  }

  // ── Turns ──
  const answererName = state.sub === "ruling"
    ? state.answerer_id === senderId ? "you" : partnerName
    : iAnswer ? "you" : partnerName;

  return (
    <div className="dr-stageroom dr-stageroom--dim flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex shrink-0 flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Question {state.n + 1} of {CL_TOTAL} · <span className={SET_TONE[q.set]}>Set {q.set} · {CL_SET_NAMES[q.set]}</span>
        </p>
        <p className="font-serif text-xl italic text-cream">
          {state.sub === "ruling" ? `${answererName === "you" ? "Your" : `${partnerName}'s`} answer, ${answererName === "you" ? `${partnerName} rules` : "your call"}` : iAnswer ? "Your turn to answer" : `${partnerName} answers`}
        </p>
        <p aria-live="polite" className="min-h-[1rem] text-xs text-muted-foreground">
          {state.sub === "ruling"
            ? answererName === "you"
              ? "Noticing, not scoring."
              : "Did they really go there? Rule it honestly."
            : iAnswer
              ? "Out loud, and take longer than feels comfortable. The clock is a suggestion."
              : `Don't plan your next answer while ${partnerName} is talking.`}
        </p>
      </div>

      {/* Depth gauge */}
      <div className="relative flex items-end justify-center gap-[2px]" aria-hidden>
        {CL_QUESTIONS.map((x, i) => (
          <span
            key={i}
            className={[
              "w-1 rounded-sm transition-all",
              x.set === 1 ? "h-2" : x.set === 2 ? "h-3" : "h-4",
              i === state.n ? "" : i < state.n ? "bg-white/40" : "bg-white/10",
            ].join(" ")}
            style={i === state.n ? { backgroundColor: "var(--room-accent)", boxShadow: "0 0 10px var(--room-accent)" } : undefined}
          />
        ))}
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
        <div className="dr-beam" aria-hidden />
        <blockquote key={state.n} className={["dr-plaque w-full max-w-md text-left", typed.complete ? "dr-plaque--settled" : ""].join(" ")}>
          <span className="dr-plaque-glyph" aria-hidden>{state.n + 1}</span>
          <p className="font-serif text-lg sm:text-xl italic leading-snug text-cream">
            {typed.shown}
            {!typed.complete && <span className="dr-caret" aria-hidden />}
          </p>
        </blockquote>

        <div className="flex items-center gap-3">
          <span className={["rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em]", iAnswer || (state.sub === "ruling" && state.answerer_id === senderId) ? "border-primary text-primary" : "border-white/15 text-muted-foreground"].join(" ")}>
            You
          </span>
          <span className={["font-serif text-xl tabular-nums", clock < 0 ? "text-amber-300" : "text-cream"].join(" ")}>
            {clock < 0 ? `+${mmss(-clock)} over` : mmss(clock)}
          </span>
          <span className={["rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em]", !iAnswer && state.sub === "answering" ? "border-rose text-rose" : state.sub === "ruling" && state.answerer_id !== senderId ? "border-rose text-rose" : "border-white/15 text-muted-foreground"].join(" ")}>
            {partnerName}
          </span>
        </div>

        {typed.complete && iAnswer && (
          <Button onClick={() => emit("my_answer")} className={accentBtn + " animate-fade-in"} style={accentStyle}>
            That&apos;s my answer
          </Button>
        )}

        {typed.complete && iRule && (
          <div className="flex flex-wrap justify-center gap-2 animate-fade-in">
            {([
              ["answered", "Answered"],
              ["half", "Half of it"],
              ["dodged", "Dodged it"],
            ] as [ClVerdict, string][]).map(([v, label]) => (
              <Button
                key={v}
                onClick={() =>
                  emit("rule", { verdict: v }, {
                    event_type: "ruled",
                    payload: { text: `q${state.n + 1} · ${label.toLowerCase()}` },
                  })
                }
                variant={v === "answered" ? undefined : "outline"}
                className={v === "answered" ? accentBtn : quietBtn}
                style={v === "answered" ? accentStyle : undefined}
              >
                {label}
              </Button>
            ))}
          </div>
        )}

        {state.sub === "ruling" && state.answerer_id === senderId && (
          <p className="text-sm text-muted-foreground animate-pulse">{partnerName} is ruling it…</p>
        )}
        {state.sub === "answering" && !iAnswer && (
          <p className="text-sm text-muted-foreground animate-pulse">listening…</p>
        )}
      </div>
    </div>
  );
}
