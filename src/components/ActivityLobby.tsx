import { useState } from "react";
import { Clock } from "lucide-react";
import { useChaperonController } from "@/context/ChaperonContext";

/**
 * The lobby shelf — the room's neutral state. Layout uses the full stage:
 * walls across the top, tonight activities in a denser multi-column grid.
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
  blurb: string;
  tag: string;
  minutes: string;
  glyph: string;
  grad: string;
  image?: string;
  soon?: boolean;
  detail: string;
};

const CARDS: ShelfCard[] = [
  {
    id: "watch",
    name: "Watch Together",
    blurb: "Same film, same second. Press play once and both screens stay in step.",
    tag: "Synced",
    minutes: "a film's worth",
    glyph: "🎬",
    grad: "radial-gradient(120% 120% at 20% 10%, #1a2438 0%, #0a0c12 70%)",
    image: "/lobby-cards/watch-together.png",
    detail: "Paste a link and it plays for both of you. Pausing pauses for both, and either of you can call a break without losing the place.",
  },
  {
    id: "dj",
    name: "Listen Together",
    blurb: "A shared record player. One queue, both rooms, nobody DJs alone.",
    tag: "Synced",
    minutes: "as long as you like",
    glyph: "🎧",
    grad: "radial-gradient(120% 120% at 80% 10%, #3a2818 0%, #120e0b 70%)",
    image: "/lobby-cards/listen-together.png",
    detail: "Take turns adding a track and say one line about why. It keeps playing behind anything else in here.",
  },
  {
    id: "games",
    name: "Play a Game",
    blurb: "Short rounds with a reveal at the end. Warm and silly, or close and honest.",
    tag: "Ready",
    minutes: "10–20 min each",
    glyph: "🃏",
    grad: "radial-gradient(120% 120% at 50% 0%, #1a2e1a 0%, #0a1009 70%)",
    image: "/lobby-cards/play-a-game.png",
    detail: "Pick one and it opens on your stage. Your date sees what you started and joins from theirs.",
  },
  {
    id: "talk",
    name: "Just Talk",
    blurb: "Questions that do the awkward part for you, at whatever depth you choose.",
    tag: "Ready",
    minutes: "20–60 min",
    glyph: "🕯️",
    grad: "radial-gradient(120% 120% at 30% 90%, #1a2832 0%, #0a0e12 70%)",
    image: "/lobby-cards/just-talk.png",
    detail: "Draft topics and let the questions arrive, or take the slow route through the 36.",
  },
  {
    id: "chaperon",
    name: "Chaperon",
    blurb: "A third chair at the table. She nudges when it goes quiet, then sits back down.",
    tag: "Chaperone",
    minutes: "runs alongside",
    glyph: "🛡️",
    grad: "radial-gradient(120% 120% at 70% 80%, #2b2016 0%, #0f0c09 70%)",
    image: "/lobby-cards/chaperon.png",
    detail: "She watches for the things you'd want a good friend to notice, whispers only to you, and leaves a debrief at the end that's yours alone. Protect is on every stranger date; Coach is the wing-woman upgrade.",
  },
  {
    id: "booth",
    name: "Photo Booth",
    blurb: "Catch the face they made. One framed shot, both cameras, saved only to your own devices.",
    tag: "Keepsake",
    minutes: "≈ 1 min",
    glyph: "📸",
    grad: "radial-gradient(120% 120% at 50% 100%, #3a1518 0%, #140a0c 70%)",
    image: "/lobby-cards/photo-booth.png",
    detail:
      "A synced 3-2-1 on both screens, then one framed keepsake with both your faces and the date. It saves straight to each of your devices — nothing is uploaded, nothing is kept by us. The four-frame strip is coming.",
  },
];

const WALL_META: Record<string, { blurb: string; grad: string; image: string }> = {
  vision_board: {
    blurb: "The life you're dreaming up together. Pin the ones that matter.",
    grad: "radial-gradient(120% 120% at 25% 15%, #2c2418 0%, #100d09 70%)",
    image: "/lobby-cards/vision-board.png",
  },
  fridge_notes: {
    blurb: "Little notes that stay up between calls, like on the kitchen fridge.",
    grad: "radial-gradient(120% 120% at 75% 20%, #1a2430 0%, #0a0e12 70%)",
    image: "/lobby-cards/fridge-notes.png",
  },
  bookshelf: {
    blurb: "Books, links and things to watch, saved for later.",
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
  const [open, setOpen] = useState<string | null>(null);
  const chaperon = useChaperonController();
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

  const start = (id: string) => {
    onPick(id);
    setOpen(null);
  };
  const openChaperonSetup = () => window.dispatchEvent(new CustomEvent("dr:chaperon:open-setup"));
  const showWalls = wallRoom && walls.length > 0;

  function handleTonightTap(c: (typeof CARDS)[number]) {
    if (c.id === "games" || c.id === "talk") {
      setOpen(open === c.id ? null : c.id);
      return;
    }
    if (c.id === "watch" || c.id === "dj") {
      start(c.id);
      return;
    }
    if (c.id === "chaperon") {
      openChaperonSetup();
      return;
    }
    if (c.id === "booth") {
      window.dispatchEvent(new CustomEvent("dr:booth:capture"));
      return;
    }
  }

  const openCard = open ? cards.find((c) => c.id === open) : null;
  /** Games and Just Talk are pickers; everything else IS the thing, so the
   *  first tap opens it (no detail step, no "Open it" button). */
  const expandable = (id: string) => id === "games" || id === "talk";
  const readyTag = (n: number) => `${n} ready`;
  const tagFor = (c: ShelfCard) =>
    c.id === "games" ? readyTag(gamePicks.length) : c.id === "talk" ? readyTag(talkPicks.length) : c.tag;

  if (showWalls) {
    return (
      <div className="dr-lobby-compact relative flex h-full min-h-0 flex-col gap-2 overflow-hidden p-3 sm:gap-2.5 sm:p-4 animate-fade-in">
        <div className="flex shrink-0 items-baseline justify-between gap-3">
          <p className="font-serif text-lg italic text-cream sm:text-xl">Your room</p>
          <p className="hidden truncate text-[10px] text-muted-foreground sm:block sm:max-w-[50%] sm:text-right">
            The walls stay up between dates. The shelf below is for tonight.
          </p>
        </div>

        <ul
          className="dr-shelf dr-shelf-even grid min-h-0 flex-[5] list-none grid-cols-1 gap-2 p-0 sm:grid-cols-3"
          style={{ ["--shelf-cols" as string]: walls.length }}
        >
          {walls.map((t) => {
            const meta = WALL_META[t.id];
            return (
              <li key={t.id} className="min-h-0 min-w-0">
                <CompactShelfTile
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

        <p className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Tonight
        </p>

        <ul
          className="dr-shelf dr-shelf-even grid min-h-0 flex-[6] list-none grid-cols-5 gap-1.5 p-0 sm:gap-2"
          style={{ ["--shelf-cols" as string]: cards.length }}
        >
          {cards.map((c) => (
            <li key={c.id} className="min-h-0 min-w-0">
              <CompactShelfTile
                title={c.name}
                tag={tagFor(c)}
                glyph={c.glyph}
                image={c.image}
                grad={c.grad}
                onClick={() => handleTonightTap(c)}
              />
            </li>
          ))}
        </ul>

        {openCard && (openCard.id === "games" || openCard.id === "talk") && (
          <div className="absolute inset-0 z-20 flex flex-col bg-[#0e0b09]/96 p-3 backdrop-blur-md animate-fade-in sm:p-4">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <p className="font-serif text-base italic text-cream">{openCard.name}</p>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="focus-ring rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-cream"
              >
                Close
              </button>
            </div>
            <ul className="grid min-h-0 flex-1 list-none grid-cols-1 gap-1.5 overflow-y-auto p-0 sm:grid-cols-2">
              {(openCard.id === "games" ? gamePicks : talkPicks).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => start(p.id)}
                    className="focus-ring flex w-full flex-col gap-0.5 rounded-xl border border-white/[0.12] p-2.5 text-left transition hover:border-primary/50 hover:bg-white/[0.04]"
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 pb-8 sm:gap-4 sm:p-5 sm:pb-10 lg:p-6 lg:pb-12 animate-fade-in">
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="font-serif text-2xl italic text-cream lg:text-3xl">
            {showWalls ? "Your room" : "What are we doing tonight?"}
          </p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {showWalls
              ? "The walls stay up between dates. The shelf below is for tonight."
              : "Nothing is loaded until one of you picks. Either of you can start anything."}
          </p>
        </div>
      </div>

      {showWalls && (
        <ul
          className="dr-shelf dr-shelf-even grid list-none grid-cols-1 gap-3 p-0"
          style={{ ["--shelf-cols" as string]: walls.length }}
        >
          {walls.map((t) => {
            const meta = WALL_META[t.id];
            return (
              <li key={t.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => start(t.id)}
                  className="dr-shelf-card focus-ring flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.10] text-left transition hover:border-primary/40"
                >
                  <span
                    className="dr-shelf-frame relative block h-32 shrink-0 overflow-hidden sm:h-36"
                    style={{ background: meta?.grad }}
                  >
                    {meta?.image && (
                      <img
                        src={meta.image}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <span className="dr-shelf-scrim absolute inset-0" aria-hidden />
                    <span className="dr-shelf-glyph absolute right-3 top-1/2 z-10 -translate-y-1/2 text-4xl sm:text-5xl" aria-hidden>
                      {t.icon}
                    </span>
                  </span>
                  <span className="flex min-h-[7.5rem] flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
                    <span className="font-serif text-base text-cream sm:text-lg">{t.label}</span>
                    {meta && (
                      <span className="line-clamp-2 text-xs leading-snug text-cream/75 sm:text-[13px]">
                        {meta.blurb}
                      </span>
                    )}
                    <span className="mt-auto pt-1 text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--room-accent)" }}>
                      Open →
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showWalls && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Tonight
        </p>
      )}

      <ul
        className="dr-shelf dr-shelf-even grid list-none grid-cols-1 gap-3 p-0"
        style={{ ["--shelf-cols" as string]: cards.length }}
      >
        {cards.map((c) => {
          const isOpen = open === c.id;
          return (
            <li
              key={c.id}
              className={["min-w-0", isOpen ? "sm:col-span-full" : ""].join(" ")}
            >
              <article
                className={[
                  "dr-shelf-card flex h-full flex-col overflow-hidden rounded-2xl border",
                  isOpen ? "border-primary/50" : "border-white/[0.10]",
                ].join(" ")}
              >
                <button
                  type="button"
                  aria-expanded={expandable(c.id) ? isOpen : undefined}
                  onClick={() => handleTonightTap(c)}
                  className="focus-ring flex h-full w-full flex-col text-left"
                >
                  <span
                    className="dr-shelf-frame relative block h-32 shrink-0 overflow-hidden sm:h-36"
                    style={{ background: c.grad }}
                  >
                    {c.image && (
                      <img
                        src={c.image}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <span className="dr-shelf-scrim absolute inset-0" aria-hidden />
                    <span className="dr-shelf-glyph absolute right-3 top-1/2 z-10 -translate-y-1/2 text-4xl sm:text-5xl" aria-hidden>
                      {c.glyph}
                    </span>
                    <span
                      className="absolute left-2.5 top-2.5 z-10 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] backdrop-blur-sm"
                      style={{
                        color: "var(--room-accent)",
                        borderColor: "color-mix(in srgb, var(--room-accent) 40%, transparent)",
                        background: "rgb(0 0 0 / 0.45)",
                      }}
                    >
                      {tagFor(c)}
                    </span>
                    {c.soon && (
                      <span className="absolute right-2.5 top-2.5 z-10 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="flex min-h-[7.5rem] flex-1 flex-col gap-1 p-3.5 sm:p-4">
                    <span className="font-serif text-base text-cream sm:text-lg">{c.name}</span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-cream/75 sm:text-[13px]">{c.blurb}</span>
                    <span className="mt-auto flex items-center gap-1.5 pt-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="truncate">{c.minutes}</span>
                      <span className="ml-auto shrink-0" style={{ color: "var(--room-accent)" }}>
                        {expandable(c.id) ? (isOpen ? "Close" : "Choose") : "Open →"}
                      </span>
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-white/[0.08] p-3.5 animate-fade-in">
                    <p className="text-xs leading-relaxed text-cream/80">{c.detail}</p>

                    {(c.id === "games" || c.id === "talk") && (
                      <ul className="mt-3 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
                        {(c.id === "games" ? gamePicks : talkPicks).map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => start(p.id)}
                              className="focus-ring flex w-full flex-col gap-0.5 rounded-xl border border-white/[0.12] p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.04]"
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
                    )}

                    {c.soon && (
                      <p className="mt-3 text-[11px] text-muted-foreground">Not built yet. It has a shelf waiting.</p>
                    )}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>

      {!wallRoom && walls.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
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

      <p className="pb-2 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
        Whatever you start, there is always a way back to this shelf.
      </p>
    </div>
  );
}

function CompactShelfTile({
  title,
  tag,
  glyph,
  image,
  grad,
  onClick,
}: {
  title: string;
  tag: string;
  glyph: string;
  image?: string;
  grad: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dr-shelf-card dr-shelf-tile focus-ring group relative h-full min-h-[4.5rem] w-full overflow-hidden rounded-xl border border-white/[0.10] text-left transition hover:border-primary/40"
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
          <span className="block truncate font-serif text-[13px] leading-tight text-cream sm:text-sm">{title}</span>
        </span>
      </span>
    </button>
  );
}
