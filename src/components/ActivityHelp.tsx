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
    title: "Questions",
    tagline: "Take turns opening up.",
    sections: [
      { heading: "How to play", bullets: [
        "A prompt shows for both of you.",
        "Answer out loud, then move to the next card.",
        "Swap decks anytime for a different vibe.",
      ] },
    ],
  },
  this_or_that: {
    title: "This or That",
    tagline: "Pick blind, reveal together.",
    sections: [
      { heading: "How to play", bullets: [
        "You each pick an option without seeing the other's choice.",
        "Once you've both picked, the answers reveal side by side.",
      ] },
    ],
  },
  the_36: {
    title: "The 36 Questions",
    tagline: "Three sets that gradually build closeness.",
    sections: [
      { heading: "How to play", bullets: [
        "Work through the questions in order, together.",
        "Each set goes a little deeper than the last.",
      ] },
    ],
  },
  "2_truths": {
    title: "Two Truths & a Lie",
    tagline: "Spot the lie.",
    sections: [
      { heading: "How to play", bullets: [
        "One of you writes two truths and one lie.",
        "The other guesses which one is the lie, then you swap roles.",
      ] },
    ],
  },
  truth_or_dare: {
    title: "Truth or Dare",
    tagline: "Three cards each — a mix of truths and dares.",
    sections: [
      { heading: "Needs both of you", bullets: ["One person deals once you're both in the room."] },
      { heading: "How to play", bullets: [
        "Tap your card to flip it, then do the truth or dare.",
        "Done moves to your next card.",
        "You get 2 skips, and you can Trade your top card with your partner.",
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
