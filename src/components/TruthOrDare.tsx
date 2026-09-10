import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  TOD_BURNS_PER_NIGHT,
  TOD_HEATS,
  TOD_NIGHT_TURNS,
  initialTodState,
  lookupTodCard,
  heatOfCard,
  nextTodCard,
  reduceTod,
  todFromJson,
  todHeatForTurn,
  type TodKind,
} from "@/lib/activities/truthOrDare";
import { prefersReducedMotion } from "@/lib/stagecraft/cinematic";
import { Scoreboard } from "@/lib/stagecraft/Scoreboard";
import { useTypewriter } from "@/lib/stagecraft/typewriter";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";

/**
 * Truth or Dare — the night. Your date deals and decides truth or dare for
 * you (the coin spins until they really choose); the card rises and types
 * itself; you take it, double it, or burn it; your date rules delivered or
 * dodged. Three heats, Warm → Bold → Bare. Everything avoided lands in the
 * Vault, which reopens at the end of the night.
 */

const PERFORM_SECONDS = 40;

export function TruthOrDare() {
  const { state, emit, senderId } = useReducedActivity(
    "truth_or_dare",
    initialTodState,
    todFromJson,
    reduceTod,
  );
  const partnerName = usePartnerName();

  const heat = todHeatForTurn(state.turn);
  const iPerform = state.performer_id === senderId;
  const card = state.card_id != null ? lookupTodCard(state.card_id) : null;
  const myTokens = state.tokens[senderId] ?? 0;
  const theirTokens = Object.entries(state.tokens).reduce((n, [k, v]) => (k === senderId ? n : n + v), 0);
  const myBurnsLeft = TOD_BURNS_PER_NIGHT - (state.burns_used[senderId] ?? 0);

  const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  const accentStyle = { backgroundColor: "var(--room-accent)" } as const;
  const quietBtn = "rounded-full border-white/20 text-cream hover:bg-white/5";

  const tokensBar = (
    <div className="flex flex-col items-center gap-1.5">
      <Scoreboard
        label="Tokens"
        entries={[
          { name: "You", value: myTokens, accent: true },
          { name: partnerName, value: theirTokens },
        ]}
      />
      {state.vault.length > 0 && (
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Vault · {state.vault.length}
        </span>
      )}
    </div>
  );

  // The performer's coin settles for a beat when the judge's choice lands.
  const [coinSettled, setCoinSettled] = useState(true);
  const prevPhase = useRef(state.phase);
  useEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = state.phase;
    if (was === "decide" && state.phase === "stakes" && iPerform && !prefersReducedMotion()) {
      setCoinSettled(false);
      const t = window.setTimeout(() => setCoinSettled(true), 1300);
      return () => window.clearTimeout(t);
    }
    setCoinSettled(true);
  }, [state.phase, iPerform]);

  // The spoken-beat ring: local presentation only, the judge always rules.
  const [left, setLeft] = useState(PERFORM_SECONDS);
  useEffect(() => {
    if (state.phase !== "perform") {
      setLeft(PERFORM_SECONDS);
      return;
    }
    const id = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [state.phase, state.turn]);

  const cardVisible = (state.phase === "stakes" || state.phase === "perform" || state.phase === "judged") && card != null && coinSettled;
  const typed = useTypewriter(card?.text ?? "", cardVisible);
  const dimmed = state.phase !== "deck" && state.phase !== "done";

  const chooseKind = (kind: TodKind) => {
    const cardId = nextTodCard(state.used, heat, kind);
    if (cardId == null) return;
    emit("choose_kind", { kind, card_id: cardId });
  };

  const rule = (delivered: boolean) => {
    const heatName = TOD_HEATS[card ? heatOfCard(card.id) : heat].name;
    emit(
      "rule",
      { delivered },
      {
        event_type: "card",
        payload: {
          text: `${heatName} ${state.kind ?? "card"} · ${delivered ? "delivered" : "dodged"}${state.doubled ? " · double" : ""}`,
        },
      },
    );
  };

  const burn = () =>
    emit("burn", {}, {
      event_type: "card",
      payload: { text: `${TOD_HEATS[heat].name} ${state.kind ?? "card"} · burned to the vault` },
    });

  const title =
    state.phase === "deck"
      ? "Truth or Dare"
      : state.phase === "decide"
        ? iPerform
          ? `${partnerName} is deciding`
          : "You deal this one"
        : state.phase === "stakes"
          ? !coinSettled
            ? state.kind === "truth" ? "Truth" : "Dare"
            : iPerform
              ? state.kind === "truth" ? "Your truth" : "Your dare"
              : `${partnerName}'s ${state.kind}`
          : state.phase === "perform"
            ? "The room is listening"
            : state.phase === "judged"
              ? state.delivered
                ? "Delivered"
                : "Into the vault"
              : "How the night went";

  const status =
    state.phase === "deck"
      ? "They deal, they decide, they rule. You just face the card."
      : state.phase === "decide"
        ? iPerform
          ? "You don't choose your own. They do."
          : `Truth or dare for ${partnerName}? ${TOD_HEATS[heat].note}`
        : state.phase === "stakes"
          ? !coinSettled
            ? state.kind === "truth" ? `${partnerName} wants the answer.` : `${partnerName} wants to watch.`
            : iPerform
              ? "Take it as it stands, double it, or burn it."
              : `Waiting for ${partnerName} to set the stakes…`
          : state.phase === "perform"
            ? iPerform
              ? left > 0
                ? state.doubled ? "Double stakes. Say it out loud." : "Say it out loud."
                : `Time's up · ${partnerName}'s call.`
              : `Your call: did ${partnerName} deliver?`
            : state.phase === "judged"
              ? state.delivered
                ? state.doubled ? "Ruled good. Two tokens." : "Ruled good. One token."
                : "It comes back at the end of the night."
              : "";

  if (state.phase === "done") {
    const verdict =
      myTokens === theirTokens
        ? "Even night. Nobody blinked more."
        : myTokens > theirTokens
          ? `You out-delivered ${partnerName} tonight.`
          : `${partnerName} out-delivered you tonight.`;
    return (
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in">
        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Truth or Dare</p>
          <p className="font-serif text-2xl italic text-cream">How the night went</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <p className="max-w-sm text-center font-serif text-base italic leading-relaxed text-cream/90">{verdict}</p>
          {tokensBar}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--room-accent)" }}>
            The vault · {state.vault.length === 0 ? "empty" : "pick one and answer it now"}
          </p>
          {state.vault.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing got away from either of you.</p>
          ) : (
            state.vault.map((id) => {
              const c = lookupTodCard(id);
              if (!c) return null;
              return (
                <div key={id} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <span className="w-5 text-center font-serif text-lg" style={{ color: "var(--room-accent)" }}>
                    {c.kind === "truth" ? "T" : "D"}
                  </span>
                  <span className="flex-1 text-sm text-cream/90">{c.text}</span>
                  <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {TOD_HEATS[heatOfCard(id)].name}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div className="flex justify-center">
          <Button onClick={() => emit("restart")} className={accentBtn} style={accentStyle}>
            Shuffle a new night
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={["dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in", dimmed ? "dr-stageroom--dim" : ""].join(" ")}>
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex shrink-0 flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Card {Math.min(state.turn + 1, TOD_NIGHT_TURNS)} of {TOD_NIGHT_TURNS} · {TOD_HEATS[heat].name}
        </p>
        <p key={title} className="font-serif text-xl italic text-cream animate-fade-in">{title}</p>
        <p key={status} aria-live="polite" className="min-h-[1rem] text-xs text-muted-foreground animate-fade-in">{status}</p>
      </div>

      {/* Heat dial */}
      <div className="relative flex justify-center gap-2" aria-label="Heat">
        {([1, 2, 3] as const).map((h) => (
          <span
            key={h}
            className={[
              "rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em]",
              h === heat
                ? "border-transparent text-primary-foreground"
                : h < heat
                  ? "border-white/10 text-muted-foreground/50"
                  : "border-white/15 text-muted-foreground",
            ].join(" ")}
            style={h === heat ? { backgroundColor: "var(--room-accent)" } : undefined}
          >
            {TOD_HEATS[h].name}
          </span>
        ))}
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
        {state.phase === "deck" && (
          <>
            <div className="dr-tod-deck" aria-hidden>
              <span className="dr-tod-back dr-tod-back--3" />
              <span className="dr-tod-back dr-tod-back--2" />
              <span className="dr-tod-back dr-tod-back--1" />
            </div>
            <Button onClick={() => emit("start_night")} className={accentBtn} style={accentStyle}>
              I&apos;ll face the first card
            </Button>
            {tokensBar}
          </>
        )}

        {state.phase === "decide" && iPerform && (
          <>
            <div className="dr-coin dr-coin--spin" aria-hidden>
              <span className="dr-coin-face">Truth</span>
              <span className="dr-coin-face dr-coin-face--dare">Dare</span>
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">the coin is in {partnerName}&apos;s hand…</p>
          </>
        )}

        {state.phase === "decide" && !iPerform && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <Button onClick={() => chooseKind("truth")} variant="outline" className={quietBtn + " px-8 py-6 font-serif text-lg italic"}>
                Truth
              </Button>
              <Button onClick={() => chooseKind("dare")} className={accentBtn + " px-8 py-6 font-serif text-lg italic"} style={accentStyle}>
                Dare
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{partnerName} doesn&apos;t get a vote.</p>
          </div>
        )}

        {state.phase === "stakes" && !coinSettled && (
          <div className={["dr-coin", state.kind === "dare" ? "dr-coin--dare" : "dr-coin--truth"].join(" ")} aria-hidden>
            <span className="dr-coin-face">Truth</span>
            <span className="dr-coin-face dr-coin-face--dare">Dare</span>
          </div>
        )}

        {cardVisible && card && (
          <div className="flex w-full flex-col items-center gap-4">
            <div className="dr-beam" aria-hidden />
            <blockquote
              className={[
                "dr-plaque w-full max-w-md text-left",
                state.phase === "judged" && state.delivered === false ? "opacity-70 grayscale-[0.4]" : "",
                typed.complete ? "dr-plaque--settled" : "",
              ].join(" ")}
            >
              <span className="dr-plaque-glyph" aria-hidden>{card.kind === "truth" ? "T" : "D"}</span>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--room-accent)" }}>
                {card.kind} · {TOD_HEATS[heatOfCard(card.id)].name}
                {state.doubled && (
                  <span className="rounded-full border px-2 py-0.5" style={{ borderColor: "var(--room-accent)" }}>double</span>
                )}
              </p>
              <p className="mt-2 font-serif text-lg sm:text-xl italic leading-snug text-cream">
                {typed.shown}
                {!typed.complete && <span className="dr-caret" aria-hidden />}
              </p>
            </blockquote>

            {state.phase === "stakes" && typed.complete && iPerform && (
              <div className="flex flex-wrap items-center justify-center gap-2 animate-fade-in">
                <Button onClick={() => emit("take", { doubled: false })} className={accentBtn} style={accentStyle}>
                  I&apos;ll take it
                </Button>
                <Button onClick={() => emit("take", { doubled: true })} variant="outline" className={quietBtn} style={{ borderColor: "var(--room-accent)", color: "var(--room-accent)" }}>
                  Double it
                </Button>
                <Button onClick={burn} disabled={myBurnsLeft <= 0} variant="outline" className={quietBtn}>
                  Burn it ({myBurnsLeft})
                </Button>
                <p className="w-full text-center text-[11px] text-muted-foreground">
                  Doubling pays two tokens. Burning locks it in the vault for the end of the night.
                </p>
              </div>
            )}

            {state.phase === "perform" && (
              <div className="flex flex-col items-center gap-3 animate-fade-in">
                <div className="dr-ring" style={{ ["--p" as string]: left / PERFORM_SECONDS }}>
                  <span className="font-serif">{left}</span>
                </div>
                {!iPerform && (
                  <div className="flex gap-2">
                    <Button onClick={() => rule(true)} className={accentBtn} style={accentStyle}>
                      Delivered
                    </Button>
                    <Button onClick={() => rule(false)} variant="outline" className={quietBtn}>
                      Dodged
                    </Button>
                  </div>
                )}
              </div>
            )}

            {state.phase === "judged" && (
              <div className="flex flex-col items-center gap-3 animate-fade-in">
                {tokensBar}
                <div className="flex gap-2">
                  <Button onClick={() => emit("next_turn")} className={accentBtn} style={accentStyle}>
                    {state.turn + 1 >= TOD_NIGHT_TURNS ? "See the night" : "Next card"}
                  </Button>
                  {state.turn + 1 < TOD_NIGHT_TURNS && (
                    <Button onClick={() => emit("end_night")} variant="outline" className={quietBtn}>
                      End the night
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
