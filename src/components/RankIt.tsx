import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useReducedActivity } from "@/lib/activities/useReducedActivity";
import {
  RANK_ROUNDS,
  initialRankItState,
  rankInsights,
  rankItFromJson,
  rankItIsFinished,
  rankOf,
  rankRevealSteps,
  reduceRankIt,
} from "@/lib/activities/rankIt";
import { useCinematic } from "@/lib/stagecraft/cinematic";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";

/**
 * Rank It — hosted reveal. Order by real drag (arrows stay as the keyboard
 * path), lock in, then the result plays as chapters: their order counted up
 * from last place, the clashes, the agreements — landing on one flip-board
 * that re-sorts between the two orders. The movement IS the summary: rows
 * that barely shift are agreements, the row that leaps is the conversation.
 *
 * Presentation only over the shared reducer; reload mid-reveal lands
 * straight on the board (stagecraft witnessed-live rule).
 */

const accentBtn = "rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
const accentStyle = { backgroundColor: "var(--room-accent)" } as const;
const ROW_GAP = 10;

export function RankIt() {
  const { state, emit, senderId } = useReducedActivity(
    "rank_it",
    initialRankItState,
    rankItFromJson,
    reduceRankIt,
  );
  const partnerName = usePartnerName();

  const round = RANK_ROUNDS[state.round];
  const mine = state.rankings[senderId];
  const otherEntry = Object.entries(state.rankings).find(([uid]) => uid !== senderId);
  const theirs = otherEntry?.[1];
  const revealing = !rankItIsFinished(state) && state.phase === "revealing" && !!mine && !!theirs;

  const insights = useMemo(
    () => (mine && theirs ? rankInsights(mine, theirs) : null),
    [mine, theirs],
  );
  const steps = useMemo(
    () => rankRevealSteps(round?.items.length ?? 0, insights?.clashes.length ?? 0, insights?.agreements.length ?? 0),
    [round, insights],
  );
  const { stage, witnessed } = useCinematic(revealing, steps);

  if (rankItIsFinished(state)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center animate-fade-in">
        <p className="font-serif text-2xl italic text-cream">{RANK_ROUNDS.length} rounds of priorities</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          You&apos;ve each seen what the other puts first. That&apos;s more than most first dates manage.
        </p>
        <Button onClick={() => emit("restart")} className={accentBtn} style={accentStyle}>
          Play again
        </Button>
      </div>
    );
  }

  const submitted = mine != null;
  const onBoard = revealing && (!witnessed || stage === "board");
  const [chapter, chapterStep] = stage?.includes(":")
    ? (stage.split(":") as [string, string])
    : [stage ?? "", "0"];
  const dimmed = revealing && witnessed;

  const status = !revealing
    ? submitted
      ? "Locked in · waiting for them…"
      : "Drag them into your order. Best at the top."
    : onBoard
      ? "The whole board. Flip it and watch what moves."
      : chapter === "dim"
        ? "Both orders are in. Nobody can change their mind now."
        : chapter === "theirs"
          ? `${partnerName}'s order, last place first.`
          : chapter === "clash"
            ? "Where you're furthest apart."
            : "Where you already agree.";

  return (
    <div className={["dr-stageroom flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in", dimmed && !onBoard ? "dr-stageroom--dim" : ""].join(" ")}>
      <div className="dr-stageroom-shade" aria-hidden />

      <div className="relative flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Round {state.round + 1} of {RANK_ROUNDS.length} · {round.title}
        </p>
        <p className="font-serif text-xl italic text-cream">
          {!revealing ? round.prompt : onBoard ? "Side by side" : chapter === "theirs" ? `${partnerName}'s order` : chapter === "clash" ? "Furthest apart" : chapter === "agree" ? "Closest agreement" : "The order is set"}
        </p>
        <p key={status} className="text-xs text-muted-foreground animate-fade-in">{status}</p>
      </div>

      {!revealing && (
        <OrderPhase
          key={state.round}
          submitted={submitted}
          partnerName={partnerName}
          roundIndex={state.round}
          onLock={(order) =>
            emit(
              "submit_ranking",
              { round: state.round, order },
              { event_type: "ranked", payload: { text: `${round.title} · #1 ${round.items[order[0]].label}` } },
            )
          }
        />
      )}

      {revealing && witnessed && !onBoard && insights && mine && theirs && (
        <ChapterView
          chapter={chapter}
          step={Number(chapterStep)}
          roundIndex={state.round}
          mine={mine}
          theirs={theirs}
          insights={insights}
          partnerName={partnerName}
        />
      )}

      {onBoard && insights && mine && theirs && (
        <FlipBoard
          roundIndex={state.round}
          mine={mine}
          theirs={theirs}
          insights={insights}
          partnerName={partnerName}
          finishLabel={state.round + 1 >= RANK_ROUNDS.length ? "Finish" : "Next round"}
          onNext={() => {
            const w = round.items[insights.widest];
            emit(
              "next_round",
              { round: state.round },
              insights.widestGap > 0
                ? {
                    event_type: "insight",
                    payload: {
                      text: `${round.title} · furthest apart on ${w.label} (you #${rankOf(mine, insights.widest)} · ${partnerName} #${rankOf(theirs, insights.widest)})`,
                    },
                  }
                : { event_type: "insight", payload: { text: `${round.title} · identical rankings` } },
            );
          }}
        />
      )}
    </div>
  );
}

/** Drag-to-order list (arrows kept for keyboard), then lock in. */
function OrderPhase({
  roundIndex,
  submitted,
  partnerName,
  onLock,
}: {
  roundIndex: number;
  submitted: boolean;
  partnerName: string;
  onLock: (order: number[]) => void;
}) {
  const round = RANK_ROUNDS[roundIndex];
  const [order, setOrder] = useState<number[]>(() => round.items.map((_, i) => i));
  const [dragItem, setDragItem] = useState<number | null>(null);
  const [dragDy, setDragDy] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<{ startY: number; rowH: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent, item: number) => {
    if (submitted) return;
    const row = listRef.current?.querySelector("li");
    const rowH = (row?.getBoundingClientRect().height ?? 56) + ROW_GAP;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { startY: e.clientY, rowH };
    setDragItem(item);
    setDragDy(0);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || dragItem == null) return;
    const dy = e.clientY - drag.current.startY;
    const current = order.indexOf(dragItem);
    const target = Math.max(0, Math.min(order.length - 1, current + Math.round(dy / drag.current.rowH)));
    if (target !== current) {
      const next = order.filter((x) => x !== dragItem);
      next.splice(target, 0, dragItem);
      setOrder(next);
      drag.current.startY = e.clientY;
      setDragDy(0);
    } else {
      setDragDy(dy);
    }
  };
  const endDrag = () => {
    drag.current = null;
    setDragItem(null);
    setDragDy(0);
  };
  const nudge = (item: number, dir: -1 | 1) => {
    const i = order.indexOf(item);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  return (
    <>
      <ol
        ref={listRef}
        className={["relative flex flex-1 flex-col justify-center", submitted ? "opacity-60 pointer-events-none" : ""].join(" ")}
        style={{ gap: ROW_GAP }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {order.map((item, pos) => (
          <li
            key={item}
            className={[
              "flex items-center gap-2.5 rounded-2xl border p-3 sm:p-3.5 select-none",
              dragItem === item
                ? "dr-rank-row--drag border-primary bg-primary/10"
                : "border-white/[0.10] bg-white/[0.03] transition-transform",
            ].join(" ")}
            style={dragItem === item ? { transform: `translateY(${dragDy}px)` } : undefined}
          >
            <span className="w-6 text-center font-serif text-lg text-primary tabular-nums">{pos + 1}</span>
            <button
              type="button"
              onPointerDown={(e) => onPointerDown(e, item)}
              aria-label={`Drag ${round.items[item].label}`}
              className="dr-rank-grip focus-ring flex h-9 w-7 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-cream"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span className="text-xl" aria-hidden>{round.items[item].emoji}</span>
            <span className="flex-1 text-sm text-cream">{round.items[item].label}</span>
            {!submitted && (
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => nudge(item, -1)}
                  disabled={pos === 0}
                  aria-label={`Move ${round.items[item].label} up`}
                  className="focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-muted-foreground transition hover:border-primary/50 hover:text-cream disabled:opacity-25"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudge(item, 1)}
                  disabled={pos === order.length - 1}
                  aria-label={`Move ${round.items[item].label} down`}
                  className="focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-muted-foreground transition hover:border-primary/50 hover:text-cream disabled:opacity-25"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="min-h-[3.5rem] flex flex-col items-center justify-center gap-1.5">
        {submitted ? (
          <p className="text-sm text-muted-foreground animate-pulse">waiting for their ranking…</p>
        ) : (
          <>
            <Button onClick={() => onLock(order)} className={accentBtn} style={accentStyle}>
              Lock it in
            </Button>
            <p className="text-[11px] text-muted-foreground">{partnerName} can&apos;t see it until you both lock.</p>
          </>
        )}
      </div>
    </>
  );
}

/** Chapters 1-3 of the reveal. */
function ChapterView({
  chapter,
  step,
  roundIndex,
  mine,
  theirs,
  insights,
  partnerName,
}: {
  chapter: string;
  step: number;
  roundIndex: number;
  mine: number[];
  theirs: number[];
  insights: ReturnType<typeof rankInsights>;
  partnerName: string;
}) {
  const round = RANK_ROUNDS[roundIndex];
  const n = round.items.length;
  // Chapters accumulate: once past "theirs", its list stays complete, etc.
  const theirsRevealed = chapter === "theirs" ? step : chapter === "dim" ? 0 : n;

  if (chapter === "dim") {
    return <div className="relative flex-1" />;
  }

  if (chapter === "theirs") {
    return (
      <div className="relative flex flex-1 flex-col justify-center gap-2">
        <div className="dr-beam" aria-hidden />
        {theirs.map((item, pos) => {
          // Row at rank pos+1 appears when revealed count >= n - pos.
          const shown = theirsRevealed >= n - pos;
          const myRank = rankOf(mine, item);
          const agreed = myRank === pos + 1;
          return (
            <div
              key={item}
              className={[
                "flex items-center gap-3 rounded-2xl border p-3 transition-all duration-500",
                shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
                "border-white/[0.10] bg-white/[0.03]",
              ].join(" ")}
            >
              <span className="w-6 text-center font-serif text-lg text-rose tabular-nums">{pos + 1}</span>
              <span className="text-xl" aria-hidden>{round.items[item].emoji}</span>
              <span className="flex-1 text-sm text-cream">{round.items[item].label}</span>
              <span
                className={[
                  "px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.18em]",
                  agreed
                    ? "border-emerald-400/50 text-emerald-300"
                    : "border-white/15 text-muted-foreground",
                ].join(" ")}
              >
                {agreed ? "you agreed" : `you had #${myRank}`}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  const items = chapter === "clash" ? insights.clashes : insights.agreements;
  const revealed = step;
  return (
    <div className="relative flex flex-1 flex-col justify-center gap-3">
      <div className="dr-beam" aria-hidden />
      {items.map((item, i) => {
        const shown = revealed >= i + 1;
        const myRank = rankOf(mine, item);
        const theirRank = rankOf(theirs, item);
        const gap = Math.abs(myRank - theirRank);
        const hot = chapter === "clash";
        return (
          <div
            key={item}
            className={[
              "rounded-2xl border p-4 text-center transition-all duration-500",
              shown ? "opacity-100 scale-100" : "opacity-0 scale-95",
              hot ? "" : "border-emerald-400/40 bg-emerald-400/5",
            ].join(" ")}
            style={hot ? { borderColor: "color-mix(in srgb, var(--room-accent) 55%, transparent)", background: "color-mix(in srgb, var(--room-accent) 8%, transparent)" } : undefined}
          >
            <p className="font-serif text-lg italic text-cream">
              <span aria-hidden>{round.items[item].emoji}</span> {round.items[item].label}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <Medallion label="You" rank={myRank} kind="you" />
              <span className="h-px w-10 bg-white/20" aria-hidden />
              <Medallion label={partnerName} rank={theirRank} kind="them" />
            </div>
            <p className={["mt-3 text-xs", hot ? "text-cream/80" : "text-emerald-300"].join(" ")}>
              {gap === 0 ? "Same place · no argument here" : `${gap} place${gap > 1 ? "s" : ""} apart`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Medallion({ label, rank, kind }: { label: string; rank: number; kind: "you" | "them" }) {
  return (
    <span className="flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
      <span
        className={[
          "grid h-9 w-9 place-items-center rounded-full font-serif text-base",
          kind === "you" ? "text-primary-foreground" : "border-2 border-rose text-rose",
        ].join(" ")}
        style={kind === "you" ? { backgroundColor: "var(--room-accent)" } : undefined}
      >
        {rank}
      </span>
      <span className="max-w-[4.5rem] truncate">{label}</span>
    </span>
  );
}

/** The finale: one board that re-sorts between the two orders. */
function FlipBoard({
  roundIndex,
  mine,
  theirs,
  insights,
  partnerName,
  onNext,
  finishLabel,
}: {
  roundIndex: number;
  mine: number[];
  theirs: number[];
  insights: ReturnType<typeof rankInsights>;
  partnerName: string;
  onNext: () => void;
  finishLabel: string;
}) {
  const round = RANK_ROUNDS[roundIndex];
  const [sortKey, setSortKey] = useState<"you" | "them">("you");
  const ROW_H = 62;
  const identical = insights.widestGap === 0;
  const closest = insights.agreements[0];
  const widestItem = round.items[insights.widest];

  const pill = (active: boolean) =>
    [
      "rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.15em] border transition",
      active ? "text-primary-foreground border-transparent" : "border-white/20 text-muted-foreground hover:text-cream",
    ].join(" ");

  return (
    <div className="relative flex flex-1 flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => setSortKey("you")} className={pill(sortKey === "you")} style={sortKey === "you" ? accentStyle : undefined}>
          Your order
        </button>
        <button type="button" onClick={() => setSortKey("them")} className={pill(sortKey === "them")} style={sortKey === "them" ? accentStyle : undefined}>
          {partnerName}&apos;s
        </button>
      </div>

      <div className="relative" style={{ height: round.items.length * ROW_H }}>
        {round.items.map((item, idx) => {
          const myRank = rankOf(mine, idx);
          const theirRank = rankOf(theirs, idx);
          const gap = Math.abs(myRank - theirRank);
          const top = ((sortKey === "you" ? myRank : theirRank) - 1) * ROW_H;
          const isWidest = !identical && idx === insights.widest;
          const isClosest = !identical && idx === closest;
          return (
            <div
              key={idx}
              className={[
                "dr-flip-row absolute left-0 right-0 flex items-center gap-3 rounded-2xl border px-3.5",
                isClosest ? "border-emerald-400/50 bg-emerald-400/5" : isWidest ? "" : "border-white/[0.10] bg-white/[0.03]",
              ].join(" ")}
              style={{
                top,
                height: ROW_H - ROW_GAP,
                ...(isWidest
                  ? { borderColor: "color-mix(in srgb, var(--room-accent) 55%, transparent)", background: "color-mix(in srgb, var(--room-accent) 8%, transparent)" }
                  : {}),
              }}
            >
              <span className="text-lg" aria-hidden>{item.emoji}</span>
              <span className="flex-1 truncate text-sm text-cream">{item.label}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground min-w-[3.8rem] text-right">
                {gap === 0 ? "same spot" : `${gap} apart`}
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full font-serif text-sm text-primary-foreground" style={{ backgroundColor: "var(--room-accent)" }} aria-label={`You ranked ${item.label} number ${myRank}`}>
                {myRank}
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-rose font-serif text-sm text-rose" aria-label={`${partnerName} ranked ${item.label} number ${theirRank}`}>
                {theirRank}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="max-w-sm text-sm leading-relaxed text-cream/85">
          {identical ? (
            <>Identical rankings. Either soulmates or someone&apos;s copying. 👀</>
          ) : (
            <>
              Talk about <span className="font-medium" style={{ color: "var(--room-accent)" }}>{widestItem.label}</span>: you
              put it #{rankOf(mine, insights.widest)}, {partnerName} put it #{rankOf(theirs, insights.widest)}. Tell each
              other why.
            </>
          )}
        </p>
        <Button onClick={onNext} className={accentBtn} style={accentStyle}>
          {finishLabel}
        </Button>
      </div>
    </div>
  );
}
