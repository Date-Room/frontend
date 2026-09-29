/**
 * Squad nights on a phone, watching something: the last two chat lines sit
 * in a thin strip under the film (above the faces), named, so the film
 * never has to give way to a chat panel or a toast. Tap to open the chat.
 */
import { useRef } from "react";
import { MessageCircle } from "lucide-react";
import type { PresenceState } from "@/lib/realtime/roomChannel";
import type { ChatMessage } from "@/lib/chatMessages";

/** Names from presence that stick for the visit, so someone who stepped
 *  out keeps their name on what they said. */
export function usePresenceNames(presence: PresenceState[]): (id: string) => string {
  const seen = useRef<Record<string, string>>({});
  for (const p of presence) {
    const id = String(p.user_id ?? p.sender_id ?? "");
    const name = p.display_name ?? p.name;
    if (id && typeof name === "string" && name) seen.current[id] = name;
  }
  return (id: string) => seen.current[id] ?? "Someone";
}

/** Pure: the lines the ticker shows, oldest first. */
export function tickerLines(
  messages: ChatMessage[],
  selfId: string,
  nameOf: (id: string) => string,
  count = 2,
): { id: string; who: string; text: string }[] {
  return messages.slice(-count).map((m) => ({
    id: m.id,
    who: m.from_user_id === selfId ? "You" : nameOf(m.from_user_id),
    text: m.text.replace(/\s+/g, " "),
  }));
}

export function ChatTicker({
  lines,
  onOpen,
}: {
  lines: { id: string; who: string; text: string }[];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open the chat"
      className="focus-ring flex w-full shrink-0 items-center gap-2.5 border-t border-white/[0.06] bg-black/25 px-3 py-1.5 text-left"
    >
      <MessageCircle className="h-4 w-4 shrink-0 text-primary/80" aria-hidden />
      <span className="min-w-0 flex-1 space-y-0.5">
        {lines.length === 0 ? (
          <span className="block text-xs text-muted-foreground">Say something to the squad…</span>
        ) : (
          lines.map((l, i) => (
            <span
              key={l.id}
              className={
                i === lines.length - 1 ? "block truncate text-xs text-cream" : "block truncate text-xs text-cream/55"
              }
            >
              <span className="font-semibold text-primary/90">{l.who}</span> {l.text}
            </span>
          ))
        )}
      </span>
    </button>
  );
}
