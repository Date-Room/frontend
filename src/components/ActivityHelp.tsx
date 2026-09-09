import { X } from "lucide-react";

type HelpSection = { heading: string; bullets: string[] };
type HelpContent = { title: string; tagline: string; sections: HelpSection[] };

/** Per-activity guidance — what it is, the rules, and the controls. Kept out of
 *  the activities themselves; surfaced from the stage header's help icon. */
const ACTIVITY_HELP: Record<string, HelpContent> = {
  vision_board: {
    title: "Vision Board",
    tagline: "Collect the life you're dreaming up together.",
    sections: [
      { heading: "What it is", bullets: ["A shared gallery of photos, notes and goals — trips, a home, a feeling."] },
      { heading: "How to use it", bullets: [
        "Type a caption, optionally add a photo or PDF, then Add.",
        "Tap any dream to view, edit, or remove it.",
        "Pin up to 2 dreams — they pop out and float on the room.",
      ] },
    ],
  },
  fridge_notes: {
    title: "Fridge",
    tagline: "Little notes for each other, like on the kitchen fridge.",
    sections: [
      { heading: "How to use it", bullets: [
        "Write a note and tap Add — it stays for both of you.",
        "Tick “Greet on entry” to show it first when they arrive.",
        "Pin up to 2 notes to float them on the room.",
      ] },
    ],
  },
  bookshelf: {
    title: "Bookshelf",
    tagline: "Books, links and things to watch together.",
    sections: [
      { heading: "How to use it", bullets: [
        "Add a book, link, or watch item with a title.",
        "Mark things finished as you go.",
      ] },
    ],
  },
  questions: {
    title: "Open Book",
    tagline: "Draft topics. The night escalates.",
    sections: [
      { heading: "How to play", bullets: [
        "Pick the night's length (15 or 21 questions), then take turns claiming topics. Each topic deals three questions: an opener, a specific, a costly one.",
        "You each write one question of your own. It replaces a card, and it buys you a veto of one topic your date chose.",
        "One card at a time, answered out loud. React with an emoji, or pass (twice a night).",
      ] },
      { heading: "Good to know", bullets: [
        "The deck runs Warm, then Real, then Close. Close is explicit; choose those topics on purpose.",
        "Everything survives to the recap, and later nights deal questions you haven't seen.",
      ] },
    ],
  },
  this_or_that: {
    title: "This or That",
    tagline: "Pick fast. Call theirs.",
    sections: [
      { heading: "How to play", bullets: [
        "Five pairs that start easy and stop being easy.",
        "Pick your side fast — the 7-second clock isn't a penalty, it just stops overthinking. Long pauses get noticed.",
        "Before the reveal, call which side your date took. Right calls score a read.",
        "The board at the end keeps every pair, where you split hardest, and where each of you hesitated.",
      ] },
    ],
  },
  the_36: {
    title: "Closer",
    tagline: "The 36 questions, without the homework.",
    sections: [
      { heading: "How to play", bullets: [
        "Commit to a stretch of 3, 6 or 12 questions, never all 36. Every stretch ends on a real off-ramp; stopping saves your place.",
        "You both answer each question out loud, in turns. Say \"That's my answer\" when you're done, and your date rules it: answered, half of it, or dodged it.",
        "Each stretch you both keep one line you heard. The night can close on four minutes of silent eye contact.",
      ] },
      { heading: "Good to know", bullets: [
        "The 90-second clock is a suggestion; it counts past zero and never cuts you off.",
        "Set three goes to heavy places. Rulings are noticing, not scoring, and dodged questions come back at the end as worth returning to.",
      ] },
    ],
  },
  "2_truths": {
    title: "Two Truths & a Lie",
    tagline: "Press one. Stake your call.",
    sections: [
      { heading: "How to play", bullets: [
        "One of you writes two truths and one lie, then seals them.",
        "The other may press ONE statement: the writer has to say more about it, out loud.",
        "Then stake your call: 1 point plays it safe; 2 points means a wrong call hands two points to the liar.",
        "The truths seal green one at a time before the lie turns over. Swap roles each round.",
      ] },
    ],
  },
  one_has_to_go: {
    title: "One Has To Go",
    tagline: "Cut one. Guess theirs. Defend it.",
    sections: [
      { heading: "How to play", bullets: [
        "Four things appear. You each secretly eliminate one, forever.",
        "Before the reveal, guess which one your date cut.",
        "Then the cuts show, and you defend your decision out loud.",
      ] },
      { heading: "The score", bullets: [
        "Reads count how often you guess each other right. It's not a compatibility score; it's how well you're figuring each other out.",
      ] },
    ],
  },
  pick_a_door: {
    title: "Pick a Door",
    tagline: "Choose blind. Answer what's behind it.",
    sections: [
      { heading: "How to play", bullets: [
        "Three doors, each hiding a question. Pick one before you know what's behind it.",
        "Both chosen doors open. Answer yours out loud, then swap.",
        "Picking the same door means you answer it together.",
      ] },
      { heading: "Good to know", bullets: ["The unpicked door stays closed. Its question keeps for another date."] },
    ],
  },
  rank_it: {
    title: "Rank It",
    tagline: "Order five things. Compare priorities.",
    sections: [
      { heading: "How to play", bullets: [
        "Use the arrows to put five things in your order, best first.",
        "Lock it in. Your date can't see your order until you both have.",
        "The reveal shows both rankings side by side.",
      ] },
      { heading: "The point", bullets: [
        "Where you're furthest apart is highlighted. That's not a problem, it's the conversation: tell each other why.",
      ] },
    ],
  },
  truth_or_dare: {
    title: "Truth or Dare",
    tagline: "They deal. You deliver. Warm to Bare.",
    sections: [
      { heading: "How to play", bullets: [
        "Your date chooses truth or dare for you. You never pick your own card.",
        "The card appears; take it, double it for two tokens, or burn it (twice a night).",
        "Say it out loud. Your date rules delivered or dodged.",
        "The deck heats up: Warm, then Bold, then Bare. Six cards a night.",
      ] },
      { heading: "The vault", bullets: [
        "Anything burned or dodged isn't gone. It comes back at the end of the night, and you talk about it.",
      ] },
    ],
  },
  watch: {
    title: "Watch Together",
    tagline: "A YouTube video, kept in sync.",
    sections: [
      { heading: "How to use it", bullets: [
        "Paste a YouTube link to start.",
        "Play, pause and seek from the DateRoom controls — both sides stay in sync.",
        "Tap the video to play/pause.",
      ] },
    ],
  },
  dj: {
    title: "Music",
    tagline: "A shared playlist you both control.",
    sections: [
      { heading: "How to use it", bullets: [
        "Add songs with a YouTube link — they queue up in a shared list.",
        "Drag to reorder; tap a song to play it.",
        "The player sits at the bottom: play/pause, back, next, repeat and volume.",
        "Close hides the player but keeps the list — Clear list empties it.",
      ] },
    ],
  },
  chat: {
    title: "Chat",
    tagline: "A side chat while you play.",
    sections: [{ heading: "How to use it", bullets: ["Type a message and send — it's just between the two of you."] }],
  },
  room_details: {
    title: "Room",
    tagline: "Invite people and set the mood.",
    sections: [
      { heading: "How to use it", bullets: [
        "Copy the Room ID + Passcode, or the invite link, to bring someone in.",
        "Pick a background — it also sets the room's colour.",
      ] },
    ],
  },
};

export function hasActivityHelp(id: string): boolean {
  return id in ACTIVITY_HELP;
}

export function ActivityHelp({ id, onClose }: { id: string; onClose: () => void }) {
  const help = ACTIVITY_HELP[id];
  if (!help) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-cream">{help.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{help.tagline}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {help.sections.map((s) => (
            <div key={s.heading}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{s.heading}</p>
              <ul className="mt-1.5 space-y-1.5">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-cream/85">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
