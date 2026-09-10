import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  GUAC_ACTIONS,
  GUAC_BOWL_TARGET,
  GUAC_COUNTDOWN_MS,
  GUAC_FREEZE_MS,
  GUAC_PEEK_MS,
  GUAC_PEEKS_PER_BATCH,
  GUAC_ROUND_MS,
  guacDeadlineMs,
  guacFromJson,
  guacStealWindow,
  guacStream,
  initialGuacState,
  reduceGuac,
  type GuacAction,
} from "@/lib/activities/guacamole";
import { setHelpNow } from "@/lib/activityHelpNow";
import { GameLanding } from "@/lib/stagecraft/GameLanding";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";
import { useRoomSession } from "@/context/RoomSessionContext";
import { TRY_CAPS, useTryRoom } from "@/lib/tryDemo";
import { TryCurtain } from "@/components/TryCurtain";

/**
 * Guacamole Panic — see lib/activities/guacamole.ts for the design. The
 * shared reducer runs the ceremony; everything under your fingers (the
 * ingredient stream, deadlines, splats, freezes) is local, deterministic
 * from the shared seed, and only coarse facts go over the wire.
 */

type Banner = { id: number; text: string; tone: "good" | "bad" };

export function GuacamolePanic() {
  const room = useRoomSession();
  const { state, emit, senderId } = useReducedActivity(
    "guacamole",
    initialGuacState,
    guacFromJson,
    reduceGuac,
  );
  const partnerName = usePartnerName();
  const tryRoom = useTryRoom();

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;

  const otherId = Object.keys({ ...state.progress, ...state.results, ...state.peeks })
    .concat(state.ready, state.steals)
    .find((u) => u && u !== senderId);

  const stream = useMemo(() => guacStream(room.roomId, state.batch), [room.roomId, state.batch]);
  const stealWin = useMemo(
    () => guacStealWindow(room.roomId, state.batch, senderId),
    [room.roomId, state.batch, senderId],
  );

  // ── Local cooking engine ──
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [made, setMade] = useState(0);
  const [splats, setSplats] = useState(0);
  const [splatFlash, setSplatFlash] = useState(false);
  const streakRef = useRef(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const deadlineRef = useRef(0);
  const frozenUntilRef = useRef(0);
  const peekUntilRef = useRef(0);
  const doneRef = useRef(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const bannerSeq = useRef(0);

  const startAt = state.start_at ? Date.parse(state.start_at) : null;
  const cookEnd = startAt != null ? startAt + GUAC_ROUND_MS : null;
  const cooking = state.phase === "cooking" && startAt != null && nowMs >= startAt;
  const inCountdown =
    (state.phase === "countdown" || state.phase === "cooking") && startAt != null && nowMs < startAt;
  const frozen = nowMs < frozenUntilRef.current;
  const peeking = nowMs < peekUntilRef.current;

  function toast(text: string, tone: Banner["tone"]) {
    const id = ++bannerSeq.current;
    setBanners((b) => [...b, { id, text, tone }]);
    window.setTimeout(() => setBanners((b) => b.filter((x) => x.id !== id)), 2600);
  }

  // Reset the local engine whenever a batch arms.
  useEffect(() => {
    setIdx(0);
    setScore(0);
    setMade(0);
    setSplats(0);
    streakRef.current = 0;
    frozenUntilRef.current = 0;
    peekUntilRef.current = 0;
    doneRef.current = false;
    deadlineRef.current = 0;
  }, [state.batch]);

  // The clock: one 60ms tick drives countdown, deadlines and the round end.
  useEffect(() => {
    if (state.phase !== "countdown" && state.phase !== "cooking") return;
    const t = window.setInterval(() => setNowMs(Date.now()), 60);
    return () => window.clearInterval(t);
  }, [state.phase]);

  // Countdown flips to cooking on the shared clock (either player's begin
  // is accepted once; it makes the flip durable for late joiners).
  useEffect(() => {
    if (state.phase !== "countdown" || startAt == null || nowMs < startAt) return;
    emit("begin", { batch: state.batch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, nowMs >= (startAt ?? Infinity)]);

  // Arm the first ingredient's deadline when cooking starts.
  useEffect(() => {
    if (!cooking || deadlineRef.current !== 0) return;
    deadlineRef.current = Date.now() + guacDeadlineMs(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooking]);

  function advance(hit: boolean) {
    if (hit) {
      streakRef.current += 1;
      setMade((m) => m + 1);
      setScore((s) => s + 10 + (streakRef.current >= 5 ? 5 : 0));
    } else {
      streakRef.current = 0;
      setSplats((s) => s + 1);
      setSplatFlash(true);
      window.setTimeout(() => setSplatFlash(false), 450);
    }
    setIdx((i) => {
      const next = i + 1;
      deadlineRef.current = Date.now() + guacDeadlineMs(next);
      return next;
    });
  }

  // Missed deadlines splat (paused while frozen or peeking — those extend).
  useEffect(() => {
    if (!cooking || doneRef.current) return;
    if (frozen || peeking) {
      deadlineRef.current = Math.max(deadlineRef.current, nowMs + 600);
      return;
    }
    if (deadlineRef.current > 0 && nowMs > deadlineRef.current) advance(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, cooking, frozen, peeking]);

  // Throttled progress pulse — broadcast, hidden, peekable.
  useEffect(() => {
    if (!cooking) return;
    const t = window.setInterval(() => {
      emit("pulse", { batch: state.batch, pct: Math.min(1, made / GUAC_BOWL_TARGET) });
    }, 4000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooking, made, state.batch]);

  // Round end → hands up, one finish per player.
  useEffect(() => {
    if (!cooking || cookEnd == null || nowMs < cookEnd || doneRef.current) return;
    doneRef.current = true;
    emit("finish", {
      batch: state.batch,
      score,
      made,
      splats,
      pct: Math.min(1, made / GUAC_BOWL_TARGET),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, cooking, cookEnd]);

  // Loud sneaking: react to steals/peeks arriving in shared state.
  const prevSteals = useRef(0);
  useEffect(() => {
    const fresh = state.steals.slice(prevSteals.current);
    prevSteals.current = state.steals.length;
    for (const by of fresh) {
      if (by === senderId) {
        toast(`You stole ${partnerName}'s lime 😈`, "good");
      } else {
        frozenUntilRef.current = Date.now() + GUAC_FREEZE_MS;
        toast(`😱 ${partnerName} stole your lime — frozen!`, "bad");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.steals.length]);
  const prevTheirPeeks = useRef(0);
  useEffect(() => {
    const theirs = otherId ? (state.peeks[otherId] ?? 0) : 0;
    if (theirs > prevTheirPeeks.current) toast(`👀 ${partnerName} peeked at your bowl!`, "bad");
    prevTheirPeeks.current = theirs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherId ? state.peeks[otherId] : 0]);

  // "Right now" help snapshot.
  useEffect(() => {
    const snap =
      state.phase === "prep"
        ? state.ready.includes(senderId)
          ? { now: `Waiting for ${partnerName} to tap I'm ready.`, step: 0 }
          : { now: "Tap I'm ready to cook. Same ingredients, same clock, two bowls.", step: 0 }
        : state.phase === "countdown"
          ? { now: "Fingers ready — the ingredients are coming.", step: 1 }
          : state.phase === "cooking"
            ? { now: "Match the button to each ingredient: chop, smash, squeeze or stir. Wrong press = splat.", step: 1 }
            : { now: "Bowls on the table. Compare, laugh, then cook another batch.", step: 3 };
    setHelpNow("guacamole", snap);
  }, [state.phase, state.ready, senderId, partnerName]);

  const press = (action: GuacAction) => {
    if (!cooking || doneRef.current || frozen || peeking) return;
    const current = stream[idx];
    if (!current) return;
    advance(action === current.action);
  };

  const doPeek = () => {
    if (!cooking || (state.peeks[senderId] ?? 0) >= GUAC_PEEKS_PER_BATCH) return;
    peekUntilRef.current = Date.now() + GUAC_PEEK_MS;
    emit("peek", { batch: state.batch });
  };

  const stealOpen =
    cooking &&
    startAt != null &&
    nowMs - startAt >= stealWin.openMs &&
    nowMs - startAt <= stealWin.closeMs &&
    !state.steals.includes(senderId);

  const myPct = Math.min(1, made / GUAC_BOWL_TARGET);
  const theirPct = otherId ? (state.progress[otherId] ?? 0) : 0;
  const peeksLeft = GUAC_PEEKS_PER_BATCH - (state.peeks[senderId] ?? 0);
  const secondsLeft = cookEnd != null ? Math.max(0, Math.ceil((cookEnd - nowMs) / 1000)) : 0;
  const ingredient = stream[idx];

  const bannersEl = (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-1.5">
      {banners.map((b) => (
        <p
          key={b.id}
          className={[
            "rounded-full px-4 py-1.5 text-xs font-semibold shadow-lg animate-fade-in",
            b.tone === "bad" ? "bg-rose text-white" : "bg-emerald-500/90 text-white",
          ].join(" ")}
        >
          {b.text}
        </p>
      ))}
    </div>
  );

  // ── Prep / landing ──
  if (state.phase === "prep") {
    const iReady = state.ready.includes(senderId);
    return (
      <GameLanding
        title="Guacamole Panic"
        promise="Same ingredients, same clock, two bowls. Yours fills only if your fingers keep up."
        minutes="≈ 2 min a batch"
        beats={[
          "Ingredients fly in. Each wants ONE button: chop, smash, squeeze or stir. Wrong press = splat.",
          `You can't see ${partnerName}'s bowl — their face is the progress bar. Peeking costs you time, and they'll know.`,
          "Once a batch, a lime-steal appears. Use it and they freeze for 3 seconds. It is not subtle.",
        ]}
      >
        {iReady ? (
          <p className="text-sm text-muted-foreground animate-pulse">
            waiting for {partnerName} to be ready…
          </p>
        ) : (
          <Button
            onClick={() =>
              emit(
                "ready",
                {
                  batch: state.batch,
                  start_at: new Date(Date.now() + GUAC_COUNTDOWN_MS).toISOString(),
                },
                { event_type: "cooking", payload: { text: `batch ${state.batch + 1} armed` } },
              )
            }
            className={accentBtn}
            style={accentStyle}
          >
            I&apos;m ready to cook
          </Button>
        )}
      </GameLanding>
    );
  }

  // ── Reveal ──
  if (state.phase === "reveal") {
    const mine = state.results[senderId];
    const theirs = otherId ? state.results[otherId] : undefined;
    const iWon = mine && theirs ? mine.score > theirs.score : false;
    const tie = mine && theirs ? mine.score === theirs.score : false;
    const verdict = !theirs
      ? "The other bowl never made it to the table."
      : tie
        ? "Two head chefs. The kitchen isn't big enough."
        : `${iWon ? "You run" : `${partnerName} runs`} this kitchen — tonight.`;
    const confessions: string[] = [];
    for (const by of state.steals) {
      confessions.push(by === senderId ? "You stole the lime 😈" : `${partnerName} stole your lime 😈`);
    }
    const myPeeks = state.peeks[senderId] ?? 0;
    const theirPeeks = otherId ? (state.peeks[otherId] ?? 0) : 0;
    if (myPeeks) confessions.push(`You peeked ${myPeeks === 1 ? "once" : `${myPeeks} times`} 👀`);
    if (theirPeeks) confessions.push(`${partnerName} peeked ${theirPeeks === 1 ? "once" : `${theirPeeks} times`} 👀`);
    const capped = tryRoom && state.batches_played + 1 >= TRY_CAPS.guacamole_batches;
    return (
      <div className="flex h-full min-h-0 flex-col items-center gap-5 overflow-y-auto p-5 sm:p-6 text-center animate-fade-in">
        <p className="font-serif text-2xl italic text-cream">{verdict}</p>
        <div className="flex items-end justify-center gap-8">
          {[
            { label: "You", r: mine, pct: state.progress[senderId] ?? 0, cls: "text-primary" },
            { label: partnerName, r: theirs, pct: theirPct, cls: "text-rose" },
          ].map((side) => (
            <div key={side.label} className="flex flex-col items-center gap-2">
              <div className="dr-guac-bowl" aria-hidden>
                <div className="dr-guac-fill" style={{ height: `${Math.round(side.pct * 100)}%` }} />
                <span className="dr-guac-face">🥑</span>
              </div>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${side.cls}`}>{side.label}</p>
              <p className="font-serif text-xl text-cream">{side.r?.score ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">
                {side.r ? `${side.r.made} in · ${side.r.splats} splat${side.r.splats === 1 ? "" : "s"}` : "no result"}
              </p>
            </div>
          ))}
        </div>
        {confessions.length > 0 && (
          <div className="flex flex-col gap-1">
            {confessions.map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground">{c}</p>
            ))}
          </div>
        )}
        {capped ? (
          <TryCurtain line="Every batch deals a new stream, faster hands, fresh chaos — in a date room." />
        ) : (
          <Button onClick={() => emit("next_batch", { batch: state.batch })} className={accentBtn} style={accentStyle}>
            Cook another batch
          </Button>
        )}
      </div>
    );
  }

  // ── Countdown + cooking ──
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
      {bannersEl}

      <div className="flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Batch {state.batch + 1} · {secondsLeft}s
        </p>
        <div className="flex items-center gap-2">
          {stealOpen && (
            <button
              type="button"
              onClick={() => emit("steal", { batch: state.batch })}
              className="dr-guac-steal focus-ring rounded-full border border-amber-300/60 bg-amber-300/15 px-3 py-1 text-[11px] font-semibold text-amber-300"
            >
              Steal their lime 😈
            </button>
          )}
          <button
            type="button"
            onClick={doPeek}
            disabled={!cooking || peeksLeft <= 0}
            className="focus-ring rounded-full border border-white/20 px-3 py-1 text-[11px] text-cream disabled:opacity-40"
          >
            👀 Peek ({peeksLeft})
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
        {inCountdown ? (
          <p className="font-serif text-[84px] leading-none text-cream animate-fade-in" aria-live="assertive">
            {Math.max(1, Math.ceil(((startAt ?? 0) - nowMs) / 1000))}
          </p>
        ) : doneRef.current ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="font-serif text-2xl italic text-cream">Hands up! 🥑</p>
            <p className="text-sm text-muted-foreground">waiting for {partnerName}&apos;s bowl…</p>
            <Button
              onClick={() => emit("force_reveal", { batch: state.batch })}
              variant="outline"
              className="rounded-full border-white/20 text-cream hover:bg-white/5"
            >
              Show the bowls
            </Button>
          </div>
        ) : (
          <>
            {ingredient && (
              <div
                key={idx}
                className={["dr-guac-card", splatFlash ? "dr-guac-card--splat" : ""].join(" ")}
              >
                <span className="text-6xl" aria-hidden>{ingredient.emoji}</span>
                <p className="font-serif text-lg text-cream">{ingredient.name}</p>
                <div className="dr-guac-timer" aria-hidden>
                  <div
                    className="dr-guac-timer-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((deadlineRef.current - nowMs) / guacDeadlineMs(idx)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {frozen && (
              <div className="dr-guac-freeze" aria-live="assertive">
                <span className="text-4xl" aria-hidden>🧊</span>
                <p className="text-sm font-semibold text-cream">Frozen!</p>
              </div>
            )}
            {peeking && otherId != null && (
              <div className="dr-guac-freeze" style={{ background: "rgb(0 0 0 / 0.75)" }}>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{partnerName}&apos;s bowl</p>
                <div className="dr-guac-bowl dr-guac-bowl--mini" aria-hidden>
                  <div className="dr-guac-fill" style={{ height: `${Math.round(theirPct * 100)}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">your bowl waits while you snoop…</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-end justify-between gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="dr-guac-bowl dr-guac-bowl--mini" aria-hidden>
            <div className="dr-guac-fill" style={{ height: `${Math.round(myPct * 100)}%` }} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">your bowl</p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {GUAC_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => press(a.id)}
              disabled={!cooking || frozen || peeking || doneRef.current}
              className="dr-guac-btn focus-ring flex flex-col items-center gap-1 rounded-2xl border border-white/[0.12] py-3 disabled:opacity-40"
            >
              <span className="text-3xl" aria-hidden>{a.emoji}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream">{a.label}</span>
            </button>
          ))}
        </div>
        <div className="flex w-14 flex-col items-center gap-0.5">
          <p className="font-serif text-2xl text-cream">{score}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">pts</p>
        </div>
      </div>
    </div>
  );
}
