/**
 * Chat panel: a view over the room-level ChatProvider (context/ChatContext),
 * which owns the messages, the sends, and the unread count for the whole
 * room visit. Message shapes and merging live in lib/chatMessages.
 */
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useChatRoom } from "@/context/ChatContext";

export function Chat() {
  const room = useRoomSession();
  const chat = useChatRoom();
  const messages = chat?.messages ?? [];
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const mine = useMemo(() => new Set([room.senderId]), [room.senderId]);

  return (
    <div className="flex flex-col h-full p-5 sm:p-6 gap-4 min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-secondary/40 border border-white/[0.08] p-4 flex flex-col gap-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        {messages.length === 0 ? (
          <div className="m-auto text-muted-foreground text-body text-center px-4">
            Say something sweet, or just check in.
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMine = mine.has(m.from_user_id);
            const prev = idx > 0 ? messages[idx - 1] : undefined;
            const showAttribution = !prev || prev.from_user_id !== m.from_user_id;
            return (
              <div
                key={m.id}
                className={`flex flex-col max-w-[82%] animate-float-up ${isMine ? "self-end items-end" : "self-start items-start"}`}
                style={{ animationDelay: `${Math.min(idx * 20, 200)}ms` }}
              >
                {showAttribution && (
                  <span className="text-label uppercase tracking-[0.18em] text-muted-foreground/80 px-1 mb-0.5">
                    {isMine ? "you" : "them"}
                  </span>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-body leading-relaxed whitespace-pre-wrap break-words ${
                    isMine
                      ? "text-primary-foreground rounded-br-md"
                      : "bg-white/[0.04] text-cream border border-white/[0.08] rounded-bl-md"
                  }`}
                  style={isMine ? { backgroundColor: "var(--room-accent)" } : undefined}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>
      {chat && chat.pendingCount > 0 && (
        <p className="-mt-2 px-1 text-label text-muted-foreground">
          Delivered when your date is in the room.
        </p>
      )}
      <form onSubmit={send} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="focus-ring bg-secondary/60 border-white/[0.10] focus-visible:border-primary/40"
          autoComplete="off"
        />
        <Button
          type="submit"
          disabled={!text.trim()}
          className="focus-ring rounded-full text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all hover:-translate-y-px"
          style={{ backgroundColor: "var(--room-accent)" }}
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
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
