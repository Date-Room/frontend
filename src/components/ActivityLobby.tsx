import { useState } from "react";
import { Clock } from "lucide-react";
import { useChaperonController } from "@/context/ChaperonContext";

/**
 * The lobby shelf — the room's neutral state, as modes of being together
 * rather than a feature list: Watch, Listen, Play a Game, Just Talk, the
 * Chaperon, and one teased keepsake (Photo Booth). Image-led card language
 * (lit vignettes with a scrim; a real photo can drop into any tile's `image`
 * slot later with no code changes). One tile opens at a time into a drawer
 * of startable picks. Choices stay per-person; the partner follows via the
 * activity notifier, never by having their screen yanked.
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
  /** Vignette gradient; a real photo can replace it via `image`. */
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
    grad: "radial-gradient(120% 120% at 20% 10%, #3a2a1a 0%, #14100c 70%)",
    detail: "Paste a link and it plays for both of you. Pausing pauses for both, and either of you can call a break without losing the place.",
  },
  {
    id: "dj",
    name: "Listen Together",
    blurb: "A shared record player. One queue, both rooms, nobody DJs alone.",
    tag: "Synced",
    minutes: "as long as you like",
    glyph: "🎧",
    grad: "radial-gradient(120% 120% at 80% 10%, #33231c 0%, #120e0b 70%)",
    detail: "Take turns adding a track and say one line about why. It keeps playing behind anything else in here.",
  },
  {
    id: "games",
    name: "Play a Game",
    blurb: "Short rounds with a reveal at the end. Warm and silly, or close and honest.",
    tag: "Six ready",
    minutes: "10–20 min each",
    glyph: "🃏",
    grad: "radial-gradient(120% 120% at 50% 0%, #2e2417 0%, #100d09 70%)",
    detail: "Pick one and it opens on your stage. Your date sees what you started and joins from theirs.",
  },
  {
    id: "talk",
    name: "Just Talk",
    blurb: "Questions that do the awkward part for you, at whatever depth you choose.",
    tag: "Two ready",
    minutes: "20–60 min",
    glyph: "🕯️",
    grad: "radial-gradient(120% 120% at 30% 90%, #362518 0%, #130f0a 70%)",
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
    detail: "She watches for the things you'd want a good friend to notice, whispers only to you, and leaves a debrief at the end that's yours alone. Protect is on every stranger date; Coach is the wing-woman upgrade.",
  },
  {
    id: "booth",
    name: "Photo Booth",
    blurb: "Catch the face they made. One framed shot, both cameras, saved only to your own devices.",
    tag: "Keepsake",
    minutes: "≈ 1 min",
    glyph: "📸",
    grad: "radial-gradient(120% 120% at 50% 100%, #3a2c15 0%, #14100a 70%)",
    detail:
      "A synced 3-2-1 on both screens, then one framed keepsake with both your faces and the date. It saves straight to each of your devices — nothing is uploaded, nothing is kept by us. The four-frame strip is coming.",
  },
];

/** The Together room's standing surfaces — promoted above the shelf there,
 *  because that room isn't "what are we doing tonight": the walls ARE the
 *  room, and the shelf is for tonight. */
const WALL_META: Record<string, { blurb: string; grad: string }> = {
  vision_board: {
    blurb: "The life you're dreaming up together. Pin the ones that matter.",
    grad: "radial-gradient(120% 120% at 25% 15%, #2c2418 0%, #100d09 70%)",
  },
  fridge_notes: {
    blurb: "Little notes that stay up between calls, like on the kitchen fridge.",
    grad: "radial-gradient(120% 120% at 75% 20%, #30241b 0%, #110e0a 70%)",
  },
  bookshelf: {
    blurb: "Books, links and things to watch, saved for later.",
    grad: "radial-gradient(120% 120% at 50% 90%, #2a2216 0%, #0f0d09 70%)",
  },
};

export function ActivityLobby({
  tabs,
  onPick,
  wallRoom = false,
}: {
  tabs: LobbyTab[];
  onPick: (id: string) => void;
  /** Together rooms: walls become first-class tiles above the shelf. */
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

  const start = (id: string) => onPick(id);
  const openChaperonSetup = () => window.dispatchEvent(new CustomEvent("dr:chaperon:open-setup"));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6 animate-fade-in">
      <div className="flex shrink-0 flex-col items-center gap-1 text-center">
        <p className="font-serif text-2xl italic text-cream">
          {wallRoom && walls.length > 0 ? "Your room" : "What are we doing tonight?"}
        </p>
        <p className="text-xs text-muted-foreground">
          {wallRoom && walls.length > 0
            ? "The walls stay up between dates. The shelf below is for tonight."
            : "Nothing is loaded until one of you picks. Either of you can start anything."}
        </p>
      </div>

      {wallRoom && walls.length > 0 && (
        <ul
          className="dr-shelf grid list-none gap-3 p-0"
          style={{ gridTemplateColumns: `repeat(${Math.min(walls.length, 3)}, minmax(0, 1fr))` }}
        >
          {walls.map((t) => {
            const meta = WALL_META[t.id];
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => start(t.id)}
                  className="dr-shelf-card focus-ring block w-full overflow-hidden rounded-2xl border border-white/[0.10] text-left"
                >
                  <span className="dr-shelf-frame relative block h-[64px] overflow-hidden" style={{ background: meta?.grad }}>
                    <span className="dr-shelf-glyph absolute right-3 top-1/2 -translate-y-1/2 text-4xl" aria-hidden>{t.icon}</span>
                    <span className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(0 0 0 / 0.55), transparent 65%)" }} aria-hidden />
                  </span>
                  <span className="flex flex-col gap-1 p-3">
                    <span className="font-serif text-sm text-cream">{t.label}</span>
                    {meta && <span className="hidden text-[11px] leading-snug text-cream/70 sm:block">{meta.blurb}</span>}
                    <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--room-accent)" }}>Open →</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {wallRoom && walls.length > 0 && (
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Tonight
        </p>
      )}

      <ul className="dr-shelf grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {cards.map((c) => {
          const isOpen = open === c.id;
          return (
            <li key={c.id} className={isOpen ? "sm:col-span-2" : ""}>
              <article className={["dr-shelf-card overflow-hidden rounded-2xl border", isOpen ? "border-primary/50" : "border-white/[0.10]"].join(" ")}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : c.id)}
                  className="focus-ring block w-full text-left"
                >
                  <span className="dr-shelf-frame relative block h-[96px] overflow-hidden" style={{ background: c.grad }}>
                    {c.image && <img src={c.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                    <span className="dr-shelf-glyph absolute right-3 top-1/2 -translate-y-1/2 text-5xl" aria-hidden>{c.glyph}</span>
                    <span className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(0 0 0 / 0.55), transparent 65%)" }} aria-hidden />
                    <span className="absolute left-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] backdrop-blur-sm" style={{ color: "var(--room-accent)", borderColor: "color-mix(in srgb, var(--room-accent) 40%, transparent)", background: "rgb(0 0 0 / 0.4)" }}>
                      {c.tag}
                    </span>
                    {c.soon && (
                      <span className="absolute right-2.5 top-2.5 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col gap-1 p-3.5">
                    <span className="font-serif text-base text-cream">{c.name}</span>
                    <span className="text-xs leading-relaxed text-cream/75">{c.blurb}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden /> {c.minutes}
                      <span className="ml-auto" style={{ color: "var(--room-accent)" }}>{isOpen ? "Close" : "Open"}</span>
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-white/[0.08] p-3.5 animate-fade-in">
                    <p className="text-xs leading-relaxed text-cream/80">{c.detail}</p>

                    {(c.id === "games" || c.id === "talk") && (
                      <ul className="mt-3 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                        {(c.id === "games" ? gamePicks : talkPicks).map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => start(p.id)}
                              className="focus-ring flex w-full flex-col gap-0.5 rounded-xl border border-white/[0.12] p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.04]"
                            >
                              <span className="text-sm text-cream">{p.name}</span>
                              <span className="text-[11px] leading-snug text-muted-foreground">{p.line}</span>
                              <span className="mt-0.5 text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--room-accent)" }}>
                                {p.minutes ? `${p.minutes} · ` : ""}Start →
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {(c.id === "watch" || c.id === "dj") && (
                      <button
                        type="button"
                        onClick={() => start(c.id)}
                        className="focus-ring mt-3 rounded-full px-5 py-2 text-sm text-primary-foreground transition hover:opacity-90"
                        style={{ backgroundColor: "var(--room-accent)" }}
                      >
                        Open it →
                      </button>
                    )}

                    {c.id === "chaperon" && (
                      <button
                        type="button"
                        onClick={openChaperonSetup}
                        className="focus-ring mt-3 rounded-full px-5 py-2 text-sm text-primary-foreground transition hover:opacity-90"
                        style={{ backgroundColor: "var(--room-accent)" }}
                      >
                        Open the chaperon setup →
                      </button>
                    )}

                    {c.id === "booth" && (
                      <div className="mt-3 flex flex-col items-start gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent("dr:booth:capture"));
                            setOpen(null);
                          }}
                          className="focus-ring rounded-full px-5 py-2 text-sm text-primary-foreground transition hover:opacity-90"
                          style={{ backgroundColor: "var(--room-accent)" }}
                        >
                          Take the shot →
                        </button>
                        <p className="text-[11px] text-muted-foreground">
                          The call needs to be running — the countdown lands on both screens.
                        </p>
                      </div>
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

      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
        Whatever you start, there is always a way back to this shelf.
      </p>
    </div>
  );
}
