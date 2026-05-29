import { Button } from "@/components/ui/button";
import { Check, SkipForward, ArrowRightLeft } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  SKIPS_PER_PLAYER,
  lookupTodCard,
  makeDeal,
  initialTodState,
  todFromJson,
  reduceTod,
} from "@/lib/activities/truthOrDare";

/** Truth or Dare — mobile `truth_or_dare`. */
export function TruthOrDare() {
  const room = useRoomSession();
  const { state, emit, senderId } = useReducedActivity("truth_or_dare", initialTodState, todFromJson, reduceTod);

  const partnerId = room.presence.map((p) => (typeof p.sender_id === "string" ? p.sender_id : "")).find((s) => s && s !== senderId);
  const dealt = state.deck_order.length > 0;

  // Pre-deal.
  if (!dealt) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 gap-5 text-center">
        <p className="font-serif italic text-cream text-xl">Truth or Dare</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Three cards each — a mix of truths and dares. Two skips, and you can trade your top card.
        </p>
        {partnerId ? (
          <Button
            onClick={() => emit("deal", makeDeal([senderId, partnerId]))}
            className="rounded-full bg-amber text-primary-foreground"
          >
            Deal the cards
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Waiting for your partner to join…</p>
        )}
      </div>
    );
  }

  const hand = state.hands[senderId];
  const topId = hand?.cards[0];
  const card = topId != null ? lookupTodCard(topId) : null;
  const revealed = state.revealed.includes(senderId);
  const skipsLeft = SKIPS_PER_PLAYER - (hand?.skips_used ?? 0);
  const trade = state.trade;
  const iAmProposer = trade?.proposer_id === senderId;
  const cardsLeftInDeck = state.deck_order.length - state.deck_cursor;

  if (!card) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center gap-3">
        <div className="text-3xl">🃏</div>
        <p className="font-serif italic text-cream text-xl">You're out of cards</p>
        <p className="text-sm text-muted-foreground">That's the deck. Nicely played.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 gap-4 min-h-0">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>Your card</span>
        <span className="tabular-nums">{cardsLeftInDeck} left in deck</span>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        {revealed ? (
          <div
            className={`w-full max-w-sm rounded-3xl border-2 p-6 text-center ${
              card.kind === "dare" ? "border-rose/40 bg-rose/5" : "border-amber/40 bg-amber/5"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-[0.3em] mb-3 ${card.kind === "dare" ? "text-rose" : "text-amber"}`}>
              {card.kind}
            </p>
            <p className="font-serif italic text-cream text-2xl leading-snug">{card.text}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              emit(
                "draw",
                {},
                card
                  ? {
                      event_type: card.kind === "dare" ? "dare" : "truth",
                      payload: { text: card.text },
                    }
                  : undefined,
              )
            }
            className="w-full max-w-sm aspect-[3/4] rounded-3xl border-2 border-dashed border-white/15 bg-card/40 flex flex-col items-center justify-center gap-3 hover:border-amber/40 transition"
          >
            <span className="text-4xl">🂠</span>
            <span className="font-serif italic text-cream/70">Tap to flip your card</span>
          </button>
        )}
      </div>

      {trade && (
        <div className="rounded-2xl border border-rosegold/30 bg-rosegold/10 p-4 text-center space-y-3">
          {iAmProposer ? (
            <p className="text-sm text-cream">Trade proposed — waiting for your partner…</p>
          ) : (
            <>
              <p className="text-sm text-cream">Your partner wants to swap top cards.</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => emit("accept_trade")} className="rounded-full bg-amber text-primary-foreground">
                  Accept
                </Button>
                <Button variant="outline" onClick={() => emit("decline_trade")} className="rounded-full border-border">
                  Decline
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {revealed && (
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            onClick={() =>
              emit(
                "done",
                {},
                card ? { event_type: "done", payload: { text: card.text } } : undefined,
              )
            }
            className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90"
          >
            <Check className="w-4 h-4 mr-1.5" /> Done — next card
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              emit(
                "skip",
                {},
                card ? { event_type: "skipped", payload: { text: card.text } } : undefined,
              )
            }
            disabled={skipsLeft <= 0}
            className="rounded-full border-border"
          >
            <SkipForward className="w-4 h-4 mr-1.5" /> Skip ({skipsLeft})
          </Button>
          {!trade && (
            <Button variant="outline" onClick={() => emit("propose_trade")} className="rounded-full border-border">
              <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Trade
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
