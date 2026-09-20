/**
 * Chat panel: a view over the room-level ChatProvider (context/ChatContext),
 * which owns the messages, the sends, and the unread count for the whole
 * room visit. Message shapes and merging live in lib/chatMessages.
 */
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Send, Smile } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useChatRoom } from "@/context/ChatContext";
import { cn } from "@/lib/utils";

export function Chat() {
  const room = useRoomSession();
  const chat = useChatRoom();
  const messages = chat?.messages ?? [];
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // While the panel is on the stage nothing counts as unread.
  useEffect(() => {
    chat?.setOpen(true);
    return () => chat?.setOpen(false);
  }, [chat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !chat) return;
    chat.send(trimmed);
    setText("");
  }

  // Enter sends; Shift+Enter breaks the line. Without this a textarea would
  // swallow Enter and there would be no way to send from the keyboard.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !chat) return;
    chat.send(trimmed);
    setText("");
  }

  /** Insert at the caret rather than appending — you may be mid-sentence. */
  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const at = start + emoji.length;
      el.setSelectionRange(at, at);
    });
  }

  // Grow with the message, up to the max-height the class sets.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const mine = useMemo(() => new Set([room.senderId]), [room.senderId]);

  return (
    // Three bands: the transcript scrolls, the composer does not. The drawer
    // supplies the header, so this owns the other two.
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="m-auto px-6 text-center text-body text-muted-foreground">
            Say something sweet, or just check in.
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMine = mine.has(m.from_user_id);
            const prev = idx > 0 ? messages[idx - 1] : undefined;
            const next = idx < messages.length - 1 ? messages[idx + 1] : undefined;
            const showAttribution = !prev || prev.from_user_id !== m.from_user_id;
            // Runs of messages from one person read as one block: only the
            // last bubble in a run keeps its tail.
            const endsRun = !next || next.from_user_id !== m.from_user_id;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex max-w-[86%] animate-float-up flex-col",
                  isMine ? "items-end self-end" : "items-start self-start",
                  showAttribution && idx > 0 && "mt-2.5",
                )}
                style={{ animationDelay: `${Math.min(idx * 20, 200)}ms` }}
              >
                {showAttribution && (
                  <span className="dr-eyebrow mb-1 px-1 text-muted-foreground/80">
                    {isMine ? "you" : "them"}
                  </span>
                )}
                <div
                  className={cn(
                    "whitespace-pre-wrap break-words px-3.5 py-2.5 text-body leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.25)]",
                    isMine
                      ? "rounded-2xl text-primary-foreground"
                      : "rounded-2xl border border-white/[0.08] bg-white/[0.05] text-cream",
                    endsRun && (isMine ? "rounded-br-md" : "rounded-bl-md"),
                  )}
                  // Falls back to the app accent: a bubble must never come out
                  // with no background and dark text on a dark panel.
                  style={isMine ? { backgroundColor: "var(--room-accent, hsl(var(--primary)))" } : undefined}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {chat && chat.pendingCount > 0 && (
        <p className="shrink-0 px-4 pb-1 text-label text-muted-foreground">
          Delivered when your date is in the room.
        </p>
      )}

      <form
        onSubmit={send}
        className="shrink-0 border-t border-white/[0.06] bg-card/60 px-3 py-3 backdrop-blur-sm"
      >
        <div className="relative flex items-end gap-2 rounded-2xl border border-white/[0.10] bg-secondary/60 px-2 py-1.5 transition focus-within:border-primary/40">
          <EmojiPicker onPick={insertEmoji} />
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type a message…"
            aria-label="Message"
            className="max-h-32 min-h-[1.75rem] flex-1 resize-none bg-transparent py-1 text-body text-cream outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send"
            className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "var(--room-accent, hsl(var(--primary)))" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-label text-muted-foreground/70">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </div>
  );
}

/** A small, curated palette rather than a full emoji keyboard: a date does
 *  not need 1,800 glyphs, and shipping a picker library for this would cost
 *  more than the feature is worth. */
const EMOJI = [
  "❤️", "🔥", "😂", "🥹", "😍", "😘", "🤗", "😉",
  "😅", "🙃", "😎", "🤔", "👀", "🙈", "💫", "✨",
  "👍", "👏", "🙌", "🤞", "💐", "🌙", "☕", "🍷",
  "🎬", "🎵", "🎲", "📚", "🌶️", "🍕", "🥑", "🎉",
];

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add an emoji"
        aria-expanded={open}
        className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[0.06] hover:text-cream"
      >
        <Smile className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-[17rem] rounded-2xl border border-white/10 bg-card/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-fade-in">
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onPick(e);
                  setOpen(false);
                }}
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-white/[0.08]"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Containment for the chat surface. Any uncaught render error inside
 *  Chat (e.g. a future schema mismatch we didn't normalize for) shows
 *  an inline placeholder instead of unmounting the whole LiveRoom into
 *  React's default fatal-error blank page. */
class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface so it lands in browser logs / Sentry without bringing
    // the page down.
    console.error("[Chat] render error", error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col h-full items-center justify-center gap-3 p-6 text-center">
          <p className="text-cream/80 text-body max-w-xs leading-relaxed">
            Chat hit a snag. Refresh to keep going.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="focus-ring text-label uppercase tracking-[0.28em] text-muted-foreground hover:text-cream transition"
          >
            try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Public wrapper — what the tray mounts. Keeps the boundary co-located
 *  with the component most likely to throw on bad envelopes. */
export function ChatWithBoundary() {
  return (
    <ChatErrorBoundary>
      <Chat />
    </ChatErrorBoundary>
  );
}
