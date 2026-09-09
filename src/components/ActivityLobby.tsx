import type { ReactNode } from "react";
import { Clock } from "lucide-react";

/**
 * The lobby — the room's neutral state. Nothing is preloaded and nothing is
 * presumed: a date opens on the question "what do you two feel like?", with
 * every activity as a peer (games, watching, music, or just talking).
 * Choosing here stages the activity for you; your date follows via the
 * activity notifier, same as any stage switch.
 */

type LobbyTab = { id: string; label: string; icon: string };

const GAME_META: Record<string, { tagline: string; minutes: string }> = {
  questions: { tagline: "Draft topics. The night escalates.", minutes: "45–60 min" },
  the_36: { tagline: "The 36 questions, in stoppable stretches.", minutes: "10 min per stretch" },
  truth_or_dare: { tagline: "They deal. You deliver. Warm to Bare.", minutes: "15–20 min" },
  "2_truths": { tagline: "Press one. Stake your call.", minutes: "10–15 min" },
  one_has_to_go: { tagline: "Cut one. Guess theirs. Defend it.", minutes: "10–15 min" },
  pick_a_door: { tagline: "Choose blind. Answer what's behind it.", minutes: "15–20 min" },
  rank_it: { tagline: "Order five things. Compare priorities.", minutes: "15–20 min" },
  this_or_that: { tagline: "Pick fast. Call theirs.", minutes: "5–10 min" },
};

const MEDIA_META: Record<string, string> = {
  watch: "Sync up something to watch together.",
  dj: "Take turns picking the soundtrack.",
  chat: "A side chat while you talk.",
  vision_board: "Pin the life you're building.",
  fridge_notes: "Sticky notes for you two.",
  bookshelf: "Books, links, things to watch.",
};

export function ActivityLobby({
  tabs,
  onPick,
}: {
  tabs: LobbyTab[];
  onPick: (id: string) => void;
}) {
  const games = tabs.filter((t) => t.id in GAME_META);
  const walls = tabs.filter((t) => ["vision_board", "fridge_notes", "bookshelf"].includes(t.id));
  const media = tabs.filter((t) => ["watch", "dj", "chat"].includes(t.id));

  const section = (label: string, children: ReactNode) => (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--room-accent)" }}>
        {label}
      </p>
      {children}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 animate-fade-in">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-serif text-2xl italic text-cream">What do you two feel like?</p>
        <p className="text-xs text-muted-foreground">Play something, watch something, or just talk. Nothing starts until you choose it.</p>
      </div>

      {games.length > 0 &&
        section(
          "Play something",
          <div className="grid grid-cols-2 gap-2.5">
            {games.map((t) => {
              const meta = GAME_META[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPick(t.id)}
                  className="focus-ring flex flex-col gap-1 rounded-2xl border border-white/[0.10] bg-white/[0.03] p-3.5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.05]"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>{t.icon}</span>
                    <span className="font-serif text-sm text-cream">{t.label}</span>
                  </span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{meta.tagline}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                    <Clock className="h-3 w-3" aria-hidden /> ≈ {meta.minutes}
                  </span>
                </button>
              );
            })}
          </div>,
        )}

      {media.length > 0 &&
        section(
          "Or settle in",
          <div className="flex flex-col gap-2">
            {media.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t.id)}
                className="focus-ring flex items-center gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.03] p-3.5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/[0.05]"
              >
                <span className="text-xl" aria-hidden>{t.icon}</span>
                <span className="flex-1">
                  <span className="block font-serif text-sm text-cream">{t.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{MEDIA_META[t.id]}</span>
                </span>
              </button>
            ))}
          </div>,
        )}

      {walls.length > 0 &&
        section(
          "Your walls",
          <div className="flex flex-wrap gap-2">
            {walls.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t.id)}
                className="focus-ring flex items-center gap-2 rounded-full border border-white/[0.12] px-3.5 py-2 text-xs text-cream transition hover:border-primary/50"
              >
                <span aria-hidden>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>,
        )}
    </div>
  );
}
