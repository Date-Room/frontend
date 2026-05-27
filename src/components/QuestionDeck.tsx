import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, SkipForward, ArrowRightLeft, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getQuestions } from "@/lib/catalogRuntime";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import {
  CUSTOM_ID_BASE,
  MAX_CUSTOMS,
  TARGET_SETUP_COUNT,
  initialQuestionsState,
  questionsFromJson,
  reduceQuestions,
  type QuestionsState,
} from "@/lib/activities/questions";

/**
 * 21 Questions — full mobile-parity state machine (setup → swap → play → done).
 * Event-driven: every broadcast event (own echo included) runs through the
 * shared reducer; members persist the result for late-join. See lib/activities/
 * questions.ts.
 */
export function QuestionDeck() {
  const room = useRoomSession();
  const me = room.senderId;
  const { session, state: durable } = useActivitySession("questions");
  const pool = useMemo(() => getQuestions(), []);

  const [state, setState] = useState<QuestionsState>(initialQuestionsState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const seeded = useRef(false);
  const [customText, setCustomText] = useState("");

  // Seed once from the persisted snapshot (initial hydrate / late join).
  useEffect(() => {
    if (seeded.current || !durable) return;
    const init = questionsFromJson(durable);
    stateRef.current = init;
    setState(init);
    seeded.current = true;
  }, [durable]);

  // Every event (incl. self-echo) drives state through the reducer.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      const next = reduceQuestions(stateRef.current, {
        type: e.type,
        payload: e.payload,
        userId: e.userId,
      });
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      if (room.canPersist) void session.persist(next as unknown as Record<string, unknown>);
    });
  }, [session, room.canPersist]);

  function emit(type: string, payload: Record<string, unknown> = {}) {
    void session?.sendEvent(type, payload);
  }

  const resolveCard = (id: number): string =>
    id >= CUSTOM_ID_BASE ? state.customs[String(id)] ?? "(custom)" : pool[id] ?? `Question ${id + 1}`;

  // ── Setup phase ──────────────────────────────────────────────────────────
  if (state.phase === "setup") {
    const mine = state.setup[me] ?? [];
    const count = mine.length;
    const customsUsed = state.customs_used[me] ?? 0;
    const iSent = state.sent[me] === true;

    if (iSent) {
      return (
        <div className="flex flex-col h-full items-center justify-center p-8 text-center gap-3">
          <Sparkles className="w-8 h-8 text-rosegold" aria-hidden />
          <p className="font-serif italic text-cream text-xl">Deck sent</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Waiting for your partner to finish their 24 — then you'll each play the other's deck.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full p-4 sm:p-6 gap-3 min-h-0">
        <div className="flex items-center justify-between">
          <p className="font-serif italic text-cream text-lg">Build their deck</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {count}/{TARGET_SETUP_COUNT}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Pick {TARGET_SETUP_COUNT} questions (+ up to {MAX_CUSTOMS} of your own). Your partner answers these.
        </p>

        <div className="flex gap-2">
          <Input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Write your own question…"
            className="bg-secondary border-border"
            disabled={customsUsed >= MAX_CUSTOMS || count >= TARGET_SETUP_COUNT}
          />
          <Button
            type="button"
            onClick={() => {
              const text = customText.trim();
              if (!text) return;
              emit("add_custom", { custom_id: CUSTOM_ID_BASE + customsUsed, text });
              setCustomText("");
            }}
            disabled={!customText.trim() || customsUsed >= MAX_CUSTOMS || count >= TARGET_SETUP_COUNT}
            className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90 shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-secondary/40 border border-border p-2 flex flex-col gap-1.5">
          {pool.map((q, idx) => {
            const selected = mine.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => emit("toggle_card", { card_id: idx })}
                disabled={!selected && count >= TARGET_SETUP_COUNT}
                className={`flex items-center gap-3 rounded-xl border p-2.5 text-left text-sm transition ${
                  selected
                    ? "border-amber bg-amber/10 text-cream"
                    : "border-border bg-card/60 text-cream/80 hover:border-amber/40 disabled:opacity-40"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    selected ? "bg-amber border-amber text-primary-foreground" : "border-muted-foreground/40"
                  }`}
                >
                  {selected && <Check className="w-3 h-3" />}
                </span>
                <span className="min-w-0">{q}</span>
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          onClick={() => emit("send_deck")}
          disabled={count !== TARGET_SETUP_COUNT}
          className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90 disabled:opacity-50"
        >
          {count === TARGET_SETUP_COUNT ? "Send deck" : `Pick ${TARGET_SETUP_COUNT - count} more`}
        </Button>
      </div>
    );
  }

  // ── Done phase ───────────────────────────────────────────────────────────
  if (state.phase === "done") {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center gap-3">
        <div className="text-4xl">🎉</div>
        <p className="font-serif italic text-cream text-2xl">You made it through all 21</p>
        <p className="text-sm text-muted-foreground max-w-xs">That's the whole deck, both ways. Nicely done.</p>
      </div>
    );
  }

  // ── Play phase ───────────────────────────────────────────────────────────
  const asker = state.turn;
  const myTurn = asker === me;
  const currentDeck = asker ? state.deck[asker] ?? [] : [];
  const currentCardId = currentDeck[0];
  const cardText = currentCardId != null ? resolveCard(currentCardId) : "…";
  const cardsLeft = Object.values(state.deck).reduce((n, d) => n + d.length, 0);
  const trade = state.trade;
  const iAmProposer = trade?.proposer_id === me;

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 gap-4 min-h-0">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>{myTurn ? "Your turn to ask" : "Their turn to ask"}</span>
        <span className="tabular-nums">{cardsLeft} left</span>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center rounded-3xl border-2 border-amber/30 bg-amber/5 p-6 text-center">
        <p className="font-serif italic text-cream text-2xl leading-snug">{cardText}</p>
      </div>

      {trade && (
        <div className="rounded-2xl border border-rosegold/30 bg-rosegold/10 p-4 text-center space-y-3">
          {iAmProposer ? (
            <p className="text-sm text-cream">Trade proposed — waiting for your partner…</p>
          ) : (
            <>
              <p className="text-sm text-cream">Your partner wants to swap the top cards.</p>
              <div className="flex gap-2 justify-center">
                <Button type="button" onClick={() => emit("accept_trade")} className="rounded-full bg-amber text-primary-foreground">
                  Accept
                </Button>
                <Button type="button" variant="outline" onClick={() => emit("decline_trade")} className="rounded-full border-border">
                  Decline
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {myTurn && (
          <Button type="button" onClick={() => emit("answered")} className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90">
            <Check className="w-4 h-4 mr-1.5" /> Answered — next
          </Button>
        )}
        {myTurn && (
          <Button
            type="button"
            variant="outline"
            onClick={() => emit("skip")}
            disabled={state.skips_left <= 0}
            className="rounded-full border-border"
          >
            <SkipForward className="w-4 h-4 mr-1.5" /> Skip ({state.skips_left})
          </Button>
        )}
        {!trade && (
          <Button
            type="button"
            variant="outline"
            onClick={() => emit("propose_trade")}
            disabled={state.trades_left <= 0}
            className="rounded-full border-border"
          >
            <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Trade ({state.trades_left})
          </Button>
        )}
      </div>
    </div>
  );
}
