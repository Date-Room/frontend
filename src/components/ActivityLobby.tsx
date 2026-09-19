import { useState } from "react";
import { useChaperonController } from "@/context/ChaperonContext";
import { useTryRoom } from "@/lib/tryDemo";

/**
 * The lobby shelf — the room's neutral state. ONE layout for every room:
 * image tiles with a tag and a title, nothing else. The per-activity copy
 * (what it is, how long) lives where you actually choose: the Games / Just
 * Talk picker overlay here, and the pre-game intro. Together rooms add the
 * walls row above; session rooms get the single Tonight row.
 *
 * History: the session shelf (#58) carried a blurb, a duration and a CTA
 * on every card and truncated all three at six across; the Together shelf
 * (#63) had to drop the copy for space and turned out cleaner. This is
 * the second one, everywhere.
 */

type LobbyTab = { id: string; label: string; icon: string };

type Pick_ = { id: string; name: string; line: string; minutes?: string };

const GAME_PICKS: Pick_[] = [
  { id: "this_or_that", name: "This or That", line: "Five snap choices, seven seconds each.", minutes: "5–10 min" },
  { id: "2_truths", name: "Two Truths & a Lie", line: "Three stories. One never happened.", minutes: "10–15 min" },
  { id: "rank_it", name: "Rank It", line: "Order five things, then find the clash.", minutes: "15–20 min" },
  { id: "one_has_to_go", name: "One Has To Go", line: "Cut one. Guess theirs. Defend it.", minutes: "10–15 min" },
  { id: "pick_a_door", name: "Pick a Door", line: "The room dims before the question lands.", minutes: "15–20 min" },
  { id: "truth_or_dare", name: "Truth or Dare", line: "They deal. You deliver. Warm to Bare.", minutes: "15–20 min" },
  { id: "guacamole", name: "Guacamole Panic", line: "Fast fingers, hidden bowls, loud sabotage.", minutes: "2 min a batch" },
];

const TALK_PICKS: Pick_[] = [
  { id: "questions", name: "Open Book", line: "Pick topics, not lists. Fifteen or twenty-one questions.", minutes: "45–60 min" },
  { id: "the_36", name: "Closer", line: "The 36 questions, in stretches you can stop.", minutes: "10 min per stretch" },
  { id: "chat", name: "Side chat", line: "Type while you talk. It runs behind anything." },
];

type ShelfCard = {
  id: string;
  name: string;
  tag: string;
  glyph: string;
  grad: string;
  image?: string;
};

const CARDS: ShelfCard[] = [
  {
    id: "watch",
    name: "Watch Together",
    tag: "Synced",
    glyph: "🎬",
    grad: "radial-gradient(120% 120% at 20% 10%, #1a2438 0%, #0a0c12 70%)",
    image: "/lobby-cards/watch-together.png",
  },
  {
    id: "dj",
    name: "Listen Together",
    tag: "Synced",
    glyph: "🎧",
    grad: "radial-gradient(120% 120% at 80% 10%, #3a2818 0%, #120e0b 70%)",
    image: "/lobby-cards/listen-together.png",
  },
  {
    id: "games",
    name: "Play a Game",
    tag: "Ready",
    glyph: "🃏",
    grad: "radial-gradient(120% 120% at 50% 0%, #1a2e1a 0%, #0a1009 70%)",
    image: "/lobby-cards/play-a-game.png",
  },
  {
    id: "talk",
    name: "Just Talk",
    tag: "Ready",
    glyph: "🕯️",
    grad: "radial-gradient(120% 120% at 30% 90%, #1a2832 0%, #0a0e12 70%)",
    image: "/lobby-cards/just-talk.png",
  },
  {
    id: "chaperon",
    name: "Chaperon",
    tag: "Chaperone",
    glyph: "🛡️",
    grad: "radial-gradient(120% 120% at 70% 80%, #2b2016 0%, #0f0c09 70%)",
    image: "/lobby-cards/chaperon.png",
  },
  {
    id: "booth",
    name: "Photo Booth",
    tag: "Keepsake",
    glyph: "📸",
    grad: "radial-gradient(120% 120% at 50% 100%, #3a1518 0%, #140a0c 70%)",
    image: "/lobby-cards/photo-booth.png",
  },
];

const WALL_META: Record<string, { grad: string; image: string }> = {
  vision_board: {
    grad: "radial-gradient(120% 120% at 25% 15%, #2c2418 0%, #100d09 70%)",
    image: "/lobby-cards/vision-board.png",
  },
  fridge_notes: {
    grad: "radial-gradient(120% 120% at 75% 20%, #1a2430 0%, #0a0e12 70%)",
    image: "/lobby-cards/fridge-notes.png",
  },
  bookshelf: {
    grad: "radial-gradient(120% 120% at 50% 90%, #2a2216 0%, #0f0d09 70%)",
    image: "/lobby-cards/bookshelf.png",
  },
};

export function ActivityLobby({
  tabs,
  onPick,
  wallRoom = false,
}: {
  tabs: LobbyTab[];
  onPick: (id: string) => void;
  wallRoom?: boolean;
}) {
  const [open, setOpen] = useState<"games" | "talk" | null>(null);
  const chaperon = useChaperonController();
  const tryRoom = useTryRoom();
  const has = (id: string) => tabs.some((t) => t.id === id);

  const gamePicks = GAME_PICKS.filter((p) => has(p.id));
  const talkPicks = TALK_PICKS.filter((p) => has(p.id));
  const walls = tabs.filter((t) => ["vision_board", "fridge_notes", "bookshelf"].includes(t.id));

  const cards = CARDS.filter((c) => {
    if (c.id === "watch" || c.id === "dj") return has(c.id);
    if (c.id === "games") return gamePicks.length > 0;
    if (c.id === "talk") return talkPicks.length > 0;
    if (c.id === "chaperon") return Boolean(chaperon?.enabled);
    return true;
  });

  /** Games and Just Talk are pickers; everything else IS the thing. */
  const expandable = (id: string): id is "games" | "talk" => id === "games" || id === "talk";
  // A Try room holds the two games you chose at setup. "2 to try" reads as
  // intent; "2 ready" read as a shortage.
  const countTag = (n: number) => (tryRoom ? `${n} to try` : `${n} ready`);
  const tagFor = (c: ShelfCard) =>
    c.id === "games" ? countTag(gamePicks.length) : c.id === "talk" ? countTag(talkPicks.length) : c.tag;

  const start = (id: string) => {
    onPick(id);
    setOpen(null);
  };

  function handleTonightTap(c: ShelfCard) {
    if (expandable(c.id)) {
      setOpen(open === c.id ? null : c.id);
      return;
    }
    if (c.id === "chaperon") {
      window.dispatchEvent(new CustomEvent("dr:chaperon:open-setup"));
      return;
    }
    if (c.id === "booth") {
      window.dispatchEvent(new CustomEvent("dr:booth:capture"));
      return;
    }
    start(c.id);
  }

  const showWalls = wallRoom && walls.length > 0;
  const openCard = open ? cards.find((c) => c.id === open) : null;

  return (
    <div className="dr-lobby-compact relative flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3 sm:gap-2.5 sm:overflow-hidden sm:p-4 animate-fade-in">
      <div className="flex shrink-0 items-baseline justify-between gap-3">
        <p className="font-serif text-lg italic text-cream sm:text-xl lg:text-2xl">
          {showWalls ? "Your room" : "What are we doing tonight?"}
        </p>
        <p className="hidden truncate text-[10px] text-muted-foreground sm:block sm:max-w-[50%] sm:text-right">
          {showWalls ? "The walls stay up between dates. The shelf below is for tonight." : "Either of you can start anything."}
        </p>
      </div>

      {showWalls && (
        <ul
          className="dr-shelf dr-shelf-even grid min-h-0 flex-[5] list-none grid-cols-1 gap-2 p-0 sm:grid-cols-3"
          style={{ ["--shelf-cols" as string]: walls.length }}
        >
          {walls.map((t) => {
            const meta = WALL_META[t.id];
            return (
              <li key={t.id} className="min-h-0 min-w-0">
                <ShelfTile
                  title={t.label}
                  tag="Open"
                  glyph={t.icon}
                  image={meta?.image}
                  grad={meta?.grad ?? ""}
                  onClick={() => start(t.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {showWalls && (
        <p className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Tonight
        </p>
      )}

      <ul
        className={[
          "dr-shelf dr-shelf-even grid min-h-0 list-none grid-cols-2 gap-1.5 p-0 sm:gap-2",
          // Together rooms share the height with the walls; session rooms
          // get one row that stops growing at poster height.
          showWalls ? "flex-[6]" : "flex-1 sm:max-h-[22rem] lg:max-h-[24rem]",
        ].join(" ")}
        style={{ ["--shelf-cols" as string]: cards.length }}
      >
        {cards.map((c) => (
          <li key={c.id} className="min-h-0 min-w-0">
            <ShelfTile
              title={c.name}
              tag={tagFor(c)}
              glyph={c.glyph}
              image={c.image}
              grad={c.grad}
              expanded={expandable(c.id) ? open === c.id : undefined}
              onClick={() => handleTonightTap(c)}
            />
          </li>
        ))}
      </ul>

      {!wallRoom && walls.length > 0 && (
        <div className="flex shrink-0 flex-wrap justify-center gap-2">
          {walls.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => start(t.id)}
              className="focus-ring flex items-center gap-2 rounded-full border border-white/[0.12] px-3.5 py-2 text-xs text-cream transition hover:border-primary/50"
            >
              <span aria-hidden>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      )}

      {openCard && expandable(openCard.id) && (
        <div className="absolute inset-0 z-20 flex flex-col bg-[#0e0b09]/96 p-3 backdrop-blur-md animate-fade-in sm:p-4">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <p className="font-serif text-base italic text-cream sm:text-lg">{openCard.name}</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="focus-ring rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-cream"
            >
              Close
            </button>
          </div>
          <ul className="grid min-h-0 flex-1 list-none grid-cols-1 gap-1.5 overflow-y-auto p-0 sm:grid-cols-2 lg:grid-cols-3">
            {(openCard.id === "games" ? gamePicks : talkPicks).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => start(p.id)}
                  className="focus-ring flex w-full flex-col gap-0.5 rounded-xl border border-white/[0.12] p-2.5 text-left transition hover:border-primary/50 hover:bg-white/[0.04] sm:p-3"
                >
                  <span className="text-sm text-cream">{p.name}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{p.line}</span>
                  <span
                    className="mt-0.5 text-[9px] uppercase tracking-[0.16em]"
                    style={{ color: "var(--room-accent)" }}
                  >
                    {p.minutes ? `${p.minutes} · ` : ""}Start →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ShelfTile({
  title,
  tag,
  glyph,
  image,
  grad,
  expanded,
  onClick,
}: {
  title: string;
  tag: string;
  glyph: string;
  image?: string;
  grad: string;
  /** Set only on picker tiles (Games / Just Talk). */
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="dr-shelf-card dr-shelf-tile focus-ring group relative h-full min-h-[4.5rem] w-full overflow-hidden rounded-xl border border-white/[0.10] text-left transition hover:border-primary/40 sm:min-h-[6rem]"
    >
      <span className="dr-shelf-frame absolute inset-0 block" style={{ background: grad }}>
        {image && (
          <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="dr-shelf-scrim absolute inset-0 opacity-90" aria-hidden />
        <span
          className="absolute inset-0 bg-gradient-to-t from-[#080604]/95 via-[#080604]/35 to-transparent"
          aria-hidden
        />
        <span className="dr-shelf-glyph absolute right-2 top-1/2 z-10 -translate-y-1/2 text-2xl opacity-80 sm:text-3xl" aria-hidden>
          {glyph}
        </span>
        <span
          className="absolute left-2 top-2 z-10 rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] backdrop-blur-sm"
          style={{
            color: "var(--room-accent)",
            borderColor: "color-mix(in srgb, var(--room-accent) 40%, transparent)",
            background: "rgb(0 0 0 / 0.45)",
          }}
        >
          {tag}
        </span>
        <span className="absolute bottom-0 left-0 right-0 z-10 p-2 sm:p-2.5">
          <span className="block truncate font-serif text-[13px] leading-tight text-cream sm:text-sm lg:text-base">{title}</span>
        </span>
      </span>
    </button>
  );
}
