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
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-serif text-2xl text-cream">Truth or Dare</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Three cards each — a mix of truths and dares. Two skips, and you can trade your top card.
        </p>
        {partnerId ? (
          <Button
            onClick={() => emit("deal", makeDeal([senderId, partnerId]))}
            className="rounded-full px-6 text-primary-foreground hover:opacity-90"
            style={{ backgroundColor: "var(--room-accent)" }}
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
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-3xl">🃏</div>
        <p className="font-serif text-2xl text-cream">You're out of cards</p>
        <p className="text-sm text-muted-foreground">That's the deck. Nicely played.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <span>Your card</span>
        <span className="tabular-nums">{cardsLeftInDeck} left in deck</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        {revealed ? (
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 text-center animate-scale-in ${
              card.kind === "dare" ? "border-rose/40 bg-rose/[0.06]" : "border-primary/40 bg-primary/[0.06]"
            }`}
          >
            <p
              className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                card.kind === "dare" ? "text-rose" : "text-primary"
              }`}
            >
              {card.kind}
            </p>
            <p className="text-xl font-medium leading-snug text-cream">{card.text}</p>
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
            className="focus-ring flex aspect-[3/4] w-full max-w-sm flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-white/[0.04]"
          >
            <span className="text-4xl">🂠</span>
            <span className="text-sm text-cream/70">Tap to flip your card</span>
          </button>
        )}
      </div>

      {trade && (
        <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 text-center animate-float-up">
          {iAmProposer ? (
            <p className="text-sm text-cream">Trade proposed — waiting for your partner…</p>
          ) : (
            <>
              <p className="text-sm text-cream">Your partner wants to swap top cards.</p>
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => emit("accept_trade")}
                  className="rounded-full text-primary-foreground hover:opacity-90"
                  style={{ backgroundColor: "var(--room-accent)" }}
                >
                  Accept
                </Button>
                <Button
                  variant="outline"
                  onClick={() => emit("decline_trade")}
                  className="rounded-full border-white/10 text-cream hover:bg-white/5"
                >
                  Decline
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {revealed && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() =>
              emit("done", {}, card ? { event_type: "done", payload: { text: card.text } } : undefined)
            }
            className="rounded-full text-primary-foreground hover:opacity-90"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            <Check className="mr-1.5 h-4 w-4" /> Done — next card
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              emit("skip", {}, card ? { event_type: "skipped", payload: { text: card.text } } : undefined)
            }
            disabled={skipsLeft <= 0}
            className="rounded-full border-white/10 text-cream hover:bg-white/5"
          >
            <SkipForward className="mr-1.5 h-4 w-4" /> Skip ({skipsLeft})
          </Button>
          {!trade && (
            <Button
              variant="outline"
              onClick={() => emit("propose_trade")}
              className="rounded-full border-white/10 text-cream hover:bg-white/5"
            >
              <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Trade
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
