import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ACTIVITY_TILES } from "@/lib/activityTiles";
import { useTryRoom } from "@/lib/tryDemo";

/**
 * The lobby — the room's neutral state, and the first thing two people see.
 *
 * Three groups, in the order they matter:
 *   Room   things that persist between dates. Yours, not tonight's.
 *   Games  things you play together, turn by turn. Three up front, the
 *          rest a tap away — a wall of nine is a worse first impression
 *          than three and a door.
 *   More   things that run alongside the date rather than instead of it.
 *
 * Open Book and Closer sit in Games rather than a separate "Just Talk":
 * they are structured, turn-based activities, and the old split put two
 * question decks on the same footing as the entire games library.
 *
 * Photo Booth and Chaperon are deliberately absent. Photo Booth is a moment
 * you take during something else (it lives on the call), and Chaperon is a
 * setting, not an activity — it is in the tray and the room bar.
 */

/** `icon` is still on the wire from the room's tab list; the lobby uses
 *  the tile artwork instead — an emoji beside a title reads as filler. */
type LobbyTab = { id: string; label: string; icon?: string };

type GamePick = { id: string; line: string; minutes?: string };

/** Ordered lightest-first: the three shown up front are the three that ask
 *  least of two people who have only just sat down. */
const GAMES: GamePick[] = [
  { id: "this_or_that", line: "Five snap choices, seven seconds each.", minutes: "5–10 min" },
  { id: "2_truths", line: "Three stories. One never happened.", minutes: "10–15 min" },
  { id: "guacamole", line: "Fast fingers, hidden bowls, loud sabotage.", minutes: "2 min a batch" },
  { id: "rank_it", line: "Order five things, then find the clash.", minutes: "15–20 min" },
  { id: "one_has_to_go", line: "Cut one. Guess theirs. Defend it.", minutes: "10–15 min" },
  { id: "pick_a_door", line: "The room dims before the question lands.", minutes: "15–20 min" },
  { id: "truth_or_dare", line: "They deal. You deliver. Warm to Bare.", minutes: "15–20 min" },
  { id: "questions", line: "Pick topics, not lists. Fifteen or twenty-one questions.", minutes: "45–60 min" },
  { id: "the_36", line: "The 36 questions, in stretches you can stop.", minutes: "10 min per stretch" },
];

const WALL_IDS = ["vision_board", "fridge_notes", "bookshelf"];
/** Shared media. Chat used to live here; it is a drawer over the room
 *  now, because it runs alongside a date rather than instead of one. */
const MEDIA_IDS = ["watch", "dj"];
const FEATURED = 3;

/** One row in the lobby. Every item is the same card — a room fixture, a
 *  game and Chat all read as equally reachable, because they are. */
function LobbyCard({
  id,
  label,
  onClick,
}: {
  id: string;
  label: string;
  onClick: () => void;
}) {
  const image = ACTIVITY_TILES[id];
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring group relative flex h-full min-h-[6.5rem] w-full items-end overflow-hidden rounded-2xl border border-primary/20 text-left transition hover:border-primary/45"
    >
      {image && (
        <img
          src={image}
          alt=""
          loading="lazy"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.06] group-hover:opacity-100"
        />
      )}
      {/* A scrim rather than a flat tint: the label sits at the bottom, so the
          darkness needs to be there and the picture can stay legible above. */}
      <span
        // Warm brown rather than near-black, and clearing sooner: the scrim
        // only has to carry the label at the bottom, not flatten the picture.
        className="absolute inset-0 bg-gradient-to-t from-[#16110d]/90 via-[#16110d]/30 to-transparent"
        aria-hidden
      />
      <span className="relative flex w-full items-center gap-2.5 px-3.5 pb-3 pt-2">
        <span className="min-w-0 flex-1 truncate text-body text-cream">{label}</span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-primary/80 transition group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // Groups share the height going spare, so the cards grow into the card
    // rather than leaving a band under them.
    <section className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 items-baseline justify-between gap-3">
        <h3 className="dr-eyebrow text-muted-foreground">{title}</h3>
        {action}
      </div>
      {/* One column on a phone, three across from `sm` — every card the same
          size, so nothing in the room looks more important than it is. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3">{children}</div>
    </section>
  );
}

export function ActivityLobby({
  tabs,
  onPick,
}: {
  tabs: LobbyTab[];
  onPick: (id: string) => void;
  /** Accepted for the caller's convenience but not read: which walls a room
   *  actually has is already decided upstream, and gating on it here hid the
   *  vision board in session rooms that do have one. */
  wallRoom?: boolean;
}) {
  const [allGames, setAllGames] = useState(false);
  const [query, setQuery] = useState("");
  const tryRoom = useTryRoom();

  const byId = new Map(tabs.map((t) => [t.id, t]));
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((t): t is LobbyTab => !!t);

  const walls = pick(WALL_IDS);
  const games = GAMES.filter((g) => byId.has(g.id));
  const media = pick(MEDIA_IDS);

  // Match on the name AND the line: someone hunting "questions" should find
  // Open Book, whose name never says it.
  const q = query.trim().toLowerCase();
  const shown = q
    ? games.filter((g) => {
        const t = byId.get(g.id);
        return `${t?.label ?? ""} ${g.line}`.toLowerCase().includes(q);
      })
    : games;

  const start = (id: string) => {
    onPick(id);
    setAllGames(false);
    setQuery("");
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto px-5 pb-6 pt-10 sm:px-7 sm:pt-12">
      {/* A question, not a headline: the app font at title size, and not
          the one Playfair display moment. Serif italic at display size read
          as a pull-quote over what is really a prompt. */}
      <h2 className="mb-7 shrink-0 text-center text-title font-normal text-cream/85">
        What would you like to do today?
      </h2>

      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {walls.length > 0 && (
          <Section title="Room">
            {walls.map((t) => (
              <LobbyCard key={t.id} id={t.id} label={t.label} onClick={() => start(t.id)} />
            ))}
          </Section>
        )}

        {games.length > 0 && (
          <Section
            title="Games"
            action={
              games.length > FEATURED ? (
                <button
                  type="button"
                  onClick={() => setAllGames(true)}
                  className="focus-ring inline-flex items-center gap-1 rounded-full text-label text-primary transition hover:text-cream"
                >
                  {tryRoom ? `All ${games.length} to try` : `View all ${games.length}`}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : undefined
            }
          >
            {games.slice(0, FEATURED).map((g) => {
              const t = byId.get(g.id)!;
              return (
                <LobbyCard key={g.id} id={g.id} label={t.label} onClick={() => start(g.id)} />
              );
            })}
          </Section>
        )}

        {media.length > 0 && (
          <Section title="Media">
            {media.map((t) => (
              <LobbyCard key={t.id} id={t.id} label={t.label} onClick={() => start(t.id)} />
            ))}
          </Section>
        )}
      </div>

      {/* The full games list. Here — and only here — each one carries what it
          is and how long it takes, because this is where you actually choose
          between them. */}
      {allGames && (
        <div className="absolute inset-0 z-20 flex flex-col bg-[#1c1712]/[0.88] p-5 backdrop-blur-md animate-fade-in sm:p-6">
          {/* Same shape as an activity's own header: back, then the name —
              with search on the true centre of the row. Three tracks rather
              than one flex run, so the field stays centred however wide the
              back-and-title group gets. */}
          <div className="mb-4 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex animate-in items-center gap-2 fade-in slide-in-from-left-3 duration-300">
              <button
                type="button"
                onClick={() => {
                  setAllGames(false);
                  setQuery("");
                }}
                aria-label="Back to the lobby"
                title="Back"
                className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-black/35 text-cream/80 backdrop-blur-md transition hover:bg-black/55 hover:text-cream"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="truncate text-label font-medium text-cream/85">Games</span>
            </div>

            <label className="relative flex w-[min(18rem,60vw)] items-center">
              <Search
                className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games"
                aria-label="Search games"
                className="focus-ring h-8 w-full rounded-full border border-primary/[0.12] bg-primary/[0.04] pl-8 pr-3 text-label text-cream placeholder:text-muted-foreground"
              />
            </label>

            <span aria-hidden />
          </div>
          {/* Square, three across: nine of them need the room, and a square
              is what the tile artwork was drawn for. */}
          {shown.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-body text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          ) : (
          <ul
            aria-label="All games"
            className="grid min-h-0 flex-1 list-none auto-rows-min grid-cols-2 gap-2.5 overflow-y-auto p-0 sm:grid-cols-3"
          >
            {shown.map((g) => {
              const t = byId.get(g.id)!;
              const image = ACTIVITY_TILES[g.id];
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => start(g.id)}
                    className="focus-ring group relative flex aspect-square w-full items-end overflow-hidden rounded-2xl border border-primary/20 text-left transition hover:border-primary/45"
                  >
                    {image && (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        aria-hidden
                        className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.06] group-hover:opacity-100"
                      />
                    )}
                    <span
                      className="absolute inset-0 bg-gradient-to-t from-[#16110d]/90 via-[#16110d]/30 to-transparent"
                      aria-hidden
                    />
                    <span className="relative flex w-full flex-col gap-0.5 p-3">
                      <span className="truncate text-body text-cream">{t.label}</span>
                      <span className="line-clamp-2 text-label leading-snug text-muted-foreground">
                        {g.line}
                      </span>
                      {g.minutes && (
                        <span className="mt-0.5 text-label" style={{ color: "var(--room-accent)" }}>
                          {g.minutes}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          )}
        </div>
      )}
    </div>
  );
}
