import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Bookmark, BookmarkCheck, PenLine, Repeat2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getQuestions, getReactions, getLimits } from "@/lib/catalogRuntime";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { cn } from "@/lib/utils";

const CUSTOM_INDEX_BASE = 1_000_000;

type DeckState = {
  hands: Record<string, number[]>;
  next_index: number;
  revisit: number[];
  trade: { proposer: string; offered: number; at: string } | null;
  skips: Record<string, number>;
  customs: Record<string, { text: string; by: string }>;
  customs_used: Record<string, number>;
};

type FloatingEmoji = { id: number; emoji: string };

function emptyState(): DeckState {
  return {
    hands: {},
    next_index: 6,
    revisit: [],
    trade: null,
    skips: {},
    customs: {},
    customs_used: {},
  };
}

function hydrateState(raw: Record<string, unknown> | null): DeckState {
  if (!raw) return emptyState();
  return {
    hands: (raw.hands ?? {}) as Record<string, number[]>,
    next_index: typeof raw.next_index === "number" ? raw.next_index : 6,
    revisit: Array.isArray(raw.revisit) ? raw.revisit : [],
    trade: raw.trade as DeckState["trade"] ?? null,
    skips: (raw.skips ?? {}) as Record<string, number>,
    customs: (raw.customs ?? {}) as Record<string, { text: string; by: string }>,
    customs_used: (raw.customs_used ?? {}) as Record<string, number>,
  };
}

function resolveText(
  pool: string[],
  idx: number,
  customs: Record<string, { text: string; by: string }>,
): string {
  if (idx >= CUSTOM_INDEX_BASE) {
    const entry = customs[String(idx)];
    if (entry) return entry.text;
  }
  if (pool.length === 0) return "…";
  return pool[idx % pool.length];
}

export function QuestionDeck() {
  const room = useRoomSession();
  const me = room.senderId;
  const { session, state: durable, ready } = useActivitySession("questions");
  const pool = useMemo(() => getQuestions(), []);
  const limits = useMemo(() => getLimits(), []);
  const reactions = useMemo(() => [...getReactions()], []);

  const [state, setState] = useState<DeckState>(emptyState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const seeded = useRef(false);

  const [floats, setFloats] = useState<FloatingEmoji[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  // Seed from persisted state, or from empty once hydration resolves (new room)
  useEffect(() => {
    if (seeded.current) return;
    if (!ready) return;
    const init = durable ? hydrateState(durable) : emptyState();
    stateRef.current = init;
    setState(init);
    seeded.current = true;
  }, [durable, ready]);

  // Deal initial hand if we don't have one yet
  useEffect(() => {
    if (!seeded.current) return;
    const s = stateRef.current;
    if (s.hands[me] && s.hands[me].length > 0) return;
    const others = Object.keys(s.hands);
    const taken = new Set(others.flatMap((k) => s.hands[k] ?? []));
    let nextIdx = s.next_index;
    const hand: number[] = [];
    for (let i = 0; hand.length < 3 && i < 100; i++) {
      if (!taken.has(nextIdx)) hand.push(nextIdx);
      else hand.push(nextIdx);
      nextIdx++;
    }
    const next: DeckState = {
      ...s,
      hands: { ...s.hands, [me]: hand },
      next_index: nextIdx,
    };
    stateRef.current = next;
    setState(next);
    persist(next);
  }, [seeded.current, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for state_sync events from the other side
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.type === "state_sync" && e.userId !== me) {
        const synced = hydrateState(e.payload as Record<string, unknown>);
        // Merge: keep our own hand if it exists, take their updates
        const merged: DeckState = {
          ...synced,
          hands: { ...synced.hands, ...(stateRef.current.hands[me] ? { [me]: stateRef.current.hands[me] } : {}) },
        };
        // Accept trade-related changes fully from syncer
        if (synced.trade !== undefined) merged.trade = synced.trade;
        stateRef.current = merged;
        setState(merged);
      }
    });
  }, [session, me]);

  // Listen for reactions
  useEffect(() => {
    if (!session) return;
    return session.onReaction((r) => {
      if (r.from === me) return;
      spawnFloat(r.kind);
    });
  }, [session, me]);

  function persist(s: DeckState) {
    void session?.persist(s as unknown as Record<string, unknown>);
  }

  function sync(s: DeckState) {
    stateRef.current = s;
    setState(s);
    persist(s);
    void session?.sendEvent("state_sync", s as unknown as Record<string, unknown>);
  }

  function spawnFloat(emoji: string) {
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, emoji }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2200);
  }

  function sendReaction(emoji: string) {
    if (emoji === "🤔") {
      const s = stateRef.current;
      const hand = s.hands[me] ?? [];
      const cur = hand[0];
      if (cur != null && !s.revisit.includes(cur)) {
        sync({ ...s, revisit: [...s.revisit, cur] });
      }
      return;
    }
    spawnFloat(emoji);
    void session?.sendReaction(emoji);
  }

  function handleAnswered() {
    const s = stateRef.current;
    const hand = s.hands[me] ?? [];
    const drawn = s.next_index;
    const newHand = [hand[1], hand[2], drawn].filter((v) => v != null) as number[];
    sync({
      ...s,
      hands: { ...s.hands, [me]: newHand },
      next_index: drawn + 1,
    });
  }

  function handleSkip() {
    const s = stateRef.current;
    const skipsUsed = s.skips[me] ?? 0;
    if (skipsUsed >= limits.skipLimit) return;
    const hand = s.hands[me] ?? [];
    const drawn = s.next_index;
    const newHand = [hand[1], hand[2], drawn].filter((v) => v != null) as number[];
    sync({
      ...s,
      hands: { ...s.hands, [me]: newHand },
      next_index: drawn + 1,
      skips: { ...s.skips, [me]: skipsUsed + 1 },
    });
  }

  function proposeTrade() {
    const s = stateRef.current;
    if (s.trade) return;
    const hand = s.hands[me] ?? [];
    sync({
      ...s,
      trade: { proposer: me, offered: hand[0], at: new Date().toISOString() },
    });
  }

  function declineTrade() {
    sync({ ...stateRef.current, trade: null });
  }

  function acceptTradeWith(slotIndex: number) {
    const s = stateRef.current;
    if (!s.trade) return;
    const myHand = [...(s.hands[me] ?? [])];
    const myCard = myHand[slotIndex];
    myHand[slotIndex] = s.trade.offered;
    const proposerHand = [...(s.hands[s.trade.proposer] ?? [])];
    proposerHand[0] = myCard;
    sync({
      ...s,
      hands: { ...s.hands, [me]: myHand, [s.trade.proposer]: proposerHand },
      trade: null,
    });
  }

  function bringBack(qIdx: number) {
    const s = stateRef.current;
    const hand = s.hands[me] ?? [];
    const newHand = [qIdx, hand[1], hand[2]].filter((v) => v != null) as number[];
    sync({ ...s, hands: { ...s.hands, [me]: newHand } });
    setDrawerOpen(false);
  }

  function submitCustomQuestion() {
    const text = customDraft.trim();
    if (!text) { setCustomError("Type something first."); return; }
    if (text.length > 240) { setCustomError("Keep it under 240 characters."); return; }
    const s = stateRef.current;
    const used = s.customs_used[me] ?? 0;
    if (used >= limits.customQuestionLimit) {
      setCustomError(`You've used all ${limits.customQuestionLimit}.`);
      return;
    }
    const customId = CUSTOM_INDEX_BASE + Date.now();
    const otherIds = Object.keys(s.hands).filter((k) => k !== me);
    const otherId = otherIds[0];
    if (!otherId) { setCustomError("No partner in the room yet."); return; }
    const otherHand = [...(s.hands[otherId] ?? [])];
    const newOtherHand = [customId, otherHand[1], otherHand[2]].filter((v) => v != null) as number[];
    sync({
      ...s,
      hands: { ...s.hands, [otherId]: newOtherHand },
      customs: { ...s.customs, [String(customId)]: { text, by: me } },
      customs_used: { ...s.customs_used, [me]: used + 1 },
    });
    setCustomDraft("");
    setCustomError(null);
    setCustomOpen(false);
  }

  // Derived
  const myHand = state.hands[me] ?? [];
  const current = myHand[0] ?? 0;
  const upcoming = myHand.slice(1, 3);
  const skipsUsed = state.skips[me] ?? 0;
  const skipsLeft = Math.max(0, limits.skipLimit - skipsUsed);
  const customsUsed = state.customs_used[me] ?? 0;
  const customLeft = Math.max(0, limits.customQuestionLimit - customsUsed);
  const incomingTrade = state.trade && state.trade.proposer !== me;
  const outgoingTrade = state.trade && state.trade.proposer === me;

  const otherIds = Object.keys(state.hands).filter((k) => k !== me);
  const proposerName = state.trade
    ? (otherIds[0] ? "Your partner" : "Someone")
    : "";

  const isCustomFromOther = current >= CUSTOM_INDEX_BASE && state.customs[String(current)]?.by !== me;
  const customAuthor = isCustomFromOther ? "your partner" : null;

  if (!seeded.current) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        warming the deck…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5 sm:p-6">
      {/* Top actions: custom question + revisit */}
      <div className="flex items-center justify-between gap-2">
        <Sheet open={customOpen} onOpenChange={setCustomOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCustomError(null); setCustomDraft(""); setCustomOpen(true); }}
              disabled={customLeft <= 0}
              className="rounded-full border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <PenLine className="w-3.5 h-3.5 mr-1.5" />
              Write your own ({customLeft})
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-card border-border">
            <SheetHeader>
              <SheetTitle className="font-serif text-cream">Write a question for them</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <Textarea
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                placeholder="Type the question you want them to answer…"
                rows={3}
                maxLength={240}
                className="bg-secondary border-border"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.max(0, customLeft - 1)} more after this one</span>
                <span>{customDraft.length}/240</span>
              </div>
              {customError && <p className="text-rose text-sm">{customError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCustomOpen(false)} className="rounded-full">Cancel</Button>
                <Button
                  onClick={submitCustomQuestion}
                  disabled={!customDraft.trim() || customLeft <= 0}
                  className="rounded-full text-primary-foreground hover:opacity-90"
                  style={{ backgroundColor: "var(--room-accent)" }}
                >
                  Send to them
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                It'll replace their current card. They'll see it's from you.
              </p>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              <Bookmark className="w-3.5 h-3.5 mr-1.5" />
              Revisit ({state.revisit.length})
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-card border-border">
            <SheetHeader>
              <SheetTitle className="font-serif text-cream">Saved to revisit</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-3 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {state.revisit.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Tap 🤔 on a question to save it for later.
                </p>
              )}
              {state.revisit.map((qIdx) => (
                <div key={qIdx} className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <p className="font-serif italic text-cream leading-snug">
                    "{resolveText(pool, qIdx, state.customs)}"
                  </p>
                  <Button
                    size="sm"
                    onClick={() => bringBack(qIdx)}
                    className="self-start rounded-full text-primary-foreground hover:opacity-90"
                    style={{ backgroundColor: "var(--room-accent)" }}
                  >
                    Bring it back
                  </Button>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main card area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 relative">
        {/* Current card */}
        <div className="relative w-full max-w-md">
          <div
            className={cn(
              "relative flex min-h-[220px] items-center justify-center rounded-3xl border border-white/[0.08] bg-card/60 p-6 text-center transition-opacity duration-300 sm:min-h-[260px] sm:p-10",
              incomingTrade && "opacity-40",
            )}
          >
            {state.revisit.includes(current) && (
              <BookmarkCheck className="absolute top-3 right-3 w-4 h-4 text-primary" />
            )}
            {isCustomFromOther && (
              <div className="absolute left-3 top-3 flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-primary">
                <PenLine className="w-3 h-3" />
                from {customAuthor}
              </div>
            )}
            <p className="font-serif text-xl leading-snug text-cream italic sm:text-3xl">
              "{resolveText(pool, current, state.customs)}"
            </p>

            {/* Floating reactions */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full overflow-hidden">
              {floats.map((f) => (
                <span
                  key={f.id}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 text-3xl animate-float-up"
                  style={{ left: `${30 + Math.random() * 40}%` }}
                >
                  {f.emoji}
                </span>
              ))}
            </div>
          </div>

          {/* Incoming trade overlay */}
          {incomingTrade && state.trade && (
            <div className="absolute inset-0 rounded-3xl bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-sm text-cream">{proposerName} wants to swap.</p>
              <p className="font-serif italic text-cream/80 text-sm">
                "{resolveText(pool, state.trade.offered, state.customs)}"
              </p>
              <p className="text-xs text-muted-foreground">Pick one of your cards to send.</p>
              <Button variant="outline" size="sm" onClick={declineTrade} className="rounded-full mt-1">
                <X className="w-3.5 h-3.5 mr-1.5" /> Not this one
              </Button>
            </div>
          )}
        </div>

        {/* Reactions row */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tap to react</p>
          <div className="flex gap-2">
            {reactions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.03] text-xl transition hover:bg-white/[0.06]"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming hand */}
        <div className="w-full max-w-md grid grid-cols-2 gap-3">
          {upcoming.map((qIdx, slot) => {
            const handSlot = slot + 1;
            const tappable = !!incomingTrade;
            return (
              <button
                key={`${qIdx}-${slot}`}
                disabled={!tappable}
                onClick={() => tappable && acceptTradeWith(handSlot)}
                className={cn(
                  "relative min-h-[80px] rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-left font-serif text-xs italic text-cream/80 transition sm:text-sm",
                  tappable && "cursor-pointer hover:border-primary/50 hover:bg-primary/10",
                  !tappable && "opacity-70",
                )}
              >
                {state.revisit.includes(qIdx) && (
                  <BookmarkCheck className="absolute top-2 right-2 w-3 h-3 text-primary" />
                )}
                "{resolveText(pool, qIdx, state.customs)}"
              </button>
            );
          })}
        </div>
        {incomingTrade && (
          <button onClick={() => acceptTradeWith(0)} className="text-xs text-primary underline">
            Send my current card instead
          </button>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex gap-3 justify-center flex-wrap items-center">
        <Button variant="outline" onClick={proposeTrade} disabled={!!state.trade} className="rounded-full">
          <Repeat2 className="w-4 h-4 mr-2" />
          {outgoingTrade ? "Waiting for swap…" : "Propose trade"}
        </Button>
        <div className="flex flex-col items-center gap-0.5">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={!!incomingTrade || skipsLeft <= 0}
            className={cn("rounded-full", skipsLeft <= 0 && "opacity-50")}
          >
            Skip {skipsLeft > 0 ? `(${skipsLeft} left)` : ""}
          </Button>
          {skipsLeft <= 0 && <span className="text-[10px] text-muted-foreground">No skips left</span>}
        </div>
        <Button
          onClick={handleAnswered}
          disabled={!!incomingTrade}
          className="rounded-full text-primary-foreground hover:opacity-90"
          style={{ backgroundColor: "var(--room-accent)" }}
        >
          <Check className="w-4 h-4 mr-2" /> Answered
        </Button>
      </div>
    </div>
  );
}
