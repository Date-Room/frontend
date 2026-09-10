import { X } from "lucide-react";
import { useHelpNow } from "@/lib/activityHelpNow";

/**
 * Per-activity help, redesigned from play-test feedback ("too wordy",
 * "what does press mean?"). Structure over prose:
 *  - a RIGHT NOW banner — one imperative line for this exact moment,
 *    published by the game from its own reducer state (activityHelpNow),
 *  - a short step map of the whole game, with the current step highlighted
 *    (a you-are-here pin, not a manual),
 *  - plain language: any flavorful term (press, stake, burn, cut…) carries
 *    its meaning in the same sentence, because idioms don't travel.
 * Static copy says "your date" (names are only known inside the room; the
 * RIGHT NOW line, built in-game, uses the partner's real name).
 */

type HelpStep = { glyph: string; name: string; text: string };
type HelpContent = { title: string; tagline: string; steps: HelpStep[]; note?: string };

const ACTIVITY_HELP: Record<string, HelpContent> = {
  pick_a_door: {
    title: "Pick a Door",
    tagline: "Choose blind. Answer what's behind it.",
    steps: [
      { glyph: "🚪", name: "Pick a door", text: "Three doors, no clues. Tap one and wait for it to lock." },
      { glyph: "💬", name: "First door opens", text: "Whoever picked first reads their question and answers it out loud." },
      { glyph: "🔁", name: "Second door opens", text: "Then the other door swings open and it's the other person's turn." },
      { glyph: "📜", name: "What stayed shut", text: "A door nobody picked stays closed. Its question keeps for another date." },
    ],
    note: "Pick the same door and you answer it together.",
  },
  this_or_that: {
    title: "This or That",
    tagline: "Pick fast. Guess theirs.",
    steps: [
      { glyph: "✋", name: "Pick your side", text: "Two options. Tap the one you want before the 7 seconds run out." },
      { glyph: "👀", name: "Guess their side", text: "Before it shows, tap the side you think your date chose." },
      { glyph: "✨", name: "The reveal", text: "Their side lights up. Same side or split — both are interesting." },
      { glyph: "📊", name: "The board", text: "At the end: how often you matched, and how often you guessed each other right." },
    ],
  },
  one_has_to_go: {
    title: "One Has To Go",
    tagline: "Cut one. Guess theirs. Defend it.",
    steps: [
      { glyph: "✂️", name: "Cut one", text: "Four things. Tap the one you'd get rid of forever — your cut is secret for now." },
      { glyph: "👀", name: "Guess their cut", text: "Tap the one you think your date got rid of." },
      { glyph: "🃏", name: "The reveal", text: "Both cuts fall off the table. Guessing right earns you a read — a point for knowing them well." },
      { glyph: "💬", name: "Defend it", text: "Say out loud why yours had to go. That's the fun part." },
    ],
  },
  "2_truths": {
    title: "Two Truths & a Lie",
    tagline: "Spot the lie. Dare to bet on it.",
    steps: [
      { glyph: "✍️", name: "Write & mark", text: "One of you writes two true things and one made-up one, marks the lie, and seals them." },
      { glyph: "👂", name: "Read theirs", text: "The other sees the three statements land one at a time." },
      { glyph: "✋", name: "Press one", text: "You get ONE press — like a detective pressing for the truth: pick a statement and your date must say more about it, out loud." },
      { glyph: "🎯", name: "Bet & accuse", text: "Choose your bet: 1 point plays it safe, 2 points means a wrong guess hands 2 to the liar. Then tap the statement you think is the lie." },
      { glyph: "✨", name: "The flip", text: "The true ones seal green, then the lie turns over. Swap roles next round." },
    ],
  },
  truth_or_dare: {
    title: "Truth or Dare",
    tagline: "Your date deals. You deliver.",
    steps: [
      { glyph: "🃏", name: "They deal", text: "Your date picks truth or dare FOR you — you never choose your own card." },
      { glyph: "✋", name: "Take, double or burn", text: "Take it for 1 token. Double it for 2. Or burn it — throw the card away (you can only burn twice a night)." },
      { glyph: "💬", name: "Say it out loud", text: "Do the dare or answer the truth, out loud, on camera." },
      { glyph: "⚖️", name: "The ruling", text: "Your date decides: delivered, or dodged (a dodge means you wriggled out of really answering)." },
      { glyph: "🔒", name: "The vault", text: "Burned and dodged cards aren't gone — they come back at the end of the night to talk about." },
    ],
  },
  guacamole: {
    title: "Guacamole Panic",
    tagline: "Race the bowl. Watch their face.",
    steps: [
      { glyph: "🥑", name: "Match the button", text: "Ingredients fly in. Each wants ONE button: chop, smash, squeeze or stir. Wrong press = splat." },
      { glyph: "⏱️", name: "Beat the clock", text: "75 seconds, same ingredients on both screens. Fill your bowl faster." },
      { glyph: "👀", name: "Peek if you dare", text: "Their bowl is hidden — their face is the progress bar. Peeking freezes YOUR cooking, and they get told." },
      { glyph: "😈", name: "The lime steal", text: "Once a batch you can steal their lime — it freezes them 3 seconds, loudly. They can do it to you too." },
    ],
  },
  rank_it: {
    title: "Rank It",
    tagline: "Order five things. Compare.",
    steps: [
      { glyph: "↕️", name: "Put them in order", text: "Drag five things into YOUR order, best at the top. Your date can't see yours." },
      { glyph: "🔒", name: "Lock it in", text: "When you're happy, lock it. The reveal waits until you've both locked." },
      { glyph: "✨", name: "The reveal", text: "Both orders show side by side, and the board flips between them." },
      { glyph: "💬", name: "Talk the gap", text: "The item you disagree on most gets highlighted. Tell each other why — that's the point." },
    ],
  },
  questions: {
    title: "Open Book",
    tagline: "Draft topics. The night deepens.",
    steps: [
      { glyph: "🌙", name: "Choose the night", text: "Pick how long: 15 or 21 questions." },
      { glyph: "🗂️", name: "Claim topics", text: "Take turns claiming topics — each one deals three questions, easy to deep." },
      { glyph: "✍️", name: "Write one & veto", text: "You each write one question of your own. Writing also lets you veto — throw out — one topic your date chose." },
      { glyph: "💬", name: "Answer & rule", text: "You answer the cards your date picked. Say \"That's my answer\", and they rule it: answered, half of it, or dodged (dodged = you slipped around the real question)." },
    ],
    note: "Rulings are noticing, not scoring. Dodged and passed questions come back at the end.",
  },
  the_36: {
    title: "Closer",
    tagline: "The 36 questions, one stretch at a time.",
    steps: [
      { glyph: "🎚️", name: "Pick a stretch", text: "Commit to 3, 6 or 12 questions — never all 36 at once. Stopping saves your place." },
      { glyph: "💬", name: "Answer in turns", text: "You both answer each question out loud. Say \"That's my answer\" when you're done." },
      { glyph: "⚖️", name: "They rule it", text: "Your date rules what they heard: answered, half of it, or dodged. It's noticing, not scoring." },
      { glyph: "📝", name: "Keep one line", text: "After each stretch, you each save one line you heard from the other." },
    ],
    note: "The night can end with four minutes of quiet eye contact. It unlocks after six questions.",
  },
  watch: {
    title: "Watch Together",
    tagline: "Same video, same second.",
    steps: [
      { glyph: "🔗", name: "Paste a link", text: "A YouTube link, or a direct video file link (.mp4) for something of your own." },
      { glyph: "▶️", name: "Play together", text: "Play, pause and skip from the bottom bar — both screens stay in step." },
    ],
  },
  dj: {
    title: "Music",
    tagline: "One playlist, both rooms.",
    steps: [
      { glyph: "🔗", name: "Add songs", text: "Paste YouTube, SoundCloud or Spotify links — they join a shared list." },
      { glyph: "▶️", name: "Play together", text: "Anyone can play, pause, skip or reorder. It keeps playing while you do other things." },
      { glyph: "💾", name: "Save the list", text: "The Playlists menu saves this list to your account for any future room." },
    ],
  },
  chat: {
    title: "Chat",
    tagline: "A side chat while you play.",
    steps: [{ glyph: "💬", name: "Type away", text: "Just between the two of you." }],
  },
  room_details: {
    title: "Room",
    tagline: "Invite people and set the mood.",
    steps: [
      { glyph: "✉️", name: "Invite", text: "Copy the Room ID + Passcode, or the invite link." },
      { glyph: "🎨", name: "Set the mood", text: "Pick a background — it also sets the room's colour." },
    ],
  },
  vision_board: {
    title: "Vision Board",
    tagline: "Collect the life you're dreaming up.",
    steps: [
      { glyph: "📌", name: "Add a dream", text: "Type a caption, add a photo if you like, then Add." },
      { glyph: "⭐", name: "Pin the big ones", text: "Pin up to 2 — they float on the room." },
    ],
  },
  fridge_notes: {
    title: "Fridge",
    tagline: "Little notes that stay up between calls.",
    steps: [
      { glyph: "🧲", name: "Leave a note", text: "Write it and tap Add — it stays for both of you." },
      { glyph: "👋", name: "Greet on entry", text: "Tick it to show a note first when they arrive." },
    ],
  },
  bookshelf: {
    title: "Bookshelf",
    tagline: "Things to read, watch and share, kept for later.",
    steps: [
      { glyph: "📚", name: "Add something", text: "A book, a link, or something to watch." },
      { glyph: "✅", name: "Mark it done", text: "Tick things off as you get to them." },
    ],
  },
};

export function hasActivityHelp(id: string): boolean {
  return id in ACTIVITY_HELP;
}

export function ActivityHelp({ id, onClose }: { id: string; onClose: () => void }) {
  const help = ACTIVITY_HELP[id];
  const now = useHelpNow(id);
  if (!help) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-white/10 bg-card shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-0">
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

        <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-4">
          {now && (
            <p
              className="mb-4 rounded-xl px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: "var(--room-accent)",
                backgroundColor: "color-mix(in srgb, var(--room-accent) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--room-accent) 45%, transparent)",
              }}
              aria-live="polite"
            >
              Right now: {now.now}
            </p>
          )}
          <ol className="space-y-2">
            {help.steps.map((s, i) => {
              const current = now != null && now.step === i;
              return (
                <li
                  key={s.name}
                  className={[
                    "rounded-xl border p-3 transition",
                    current
                      ? "border-[color-mix(in_srgb,var(--room-accent)_70%,transparent)] bg-[color-mix(in_srgb,var(--room-accent)_8%,transparent)]"
                      : "border-transparent",
                  ].join(" ")}
                >
                  <p className="flex items-center gap-2 font-serif text-base text-cream">
                    <span aria-hidden>{s.glyph}</span>
                    {s.name}
                    {current && (
                      <span
                        className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-sans font-semibold uppercase tracking-[0.16em]"
                        style={{ color: "var(--room-accent)", border: "1px solid color-mix(in srgb, var(--room-accent) 50%, transparent)" }}
                      >
                        you are here
                      </span>
                    )}
                  </p>
                  <p className="mt-1 pl-7 text-sm leading-relaxed text-cream/80">{s.text}</p>
                </li>
              );
            })}
          </ol>
          {help.note && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{help.note}</p>}
        </div>

        <div className="p-6 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring w-full rounded-full border border-white/20 py-2.5 text-sm text-cream transition hover:bg-white/5"
          >
            Back to the room
          </button>
        </div>
      </div>
    </div>
  );
}
