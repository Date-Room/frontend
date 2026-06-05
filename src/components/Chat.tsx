/**
 * Chat — ported to the shared `chat` activity protocol (mobile parity):
 *  - durable state `{ messages: [{ id, from_user_id, text, sent_at }] }`
 *  - broadcast event type `send` carrying one message
 * Messages converge via broadcast first; signed-in members persist the list.
 *
 * Two send-shape variants to reconcile:
 *   - mobile emits a *minimal* broadcast payload `{ id, text }` and relies on
 *     the activity envelope's `userId` / `timestamp` for attribution + ordering
 *     (see `ChatModule.reduce` in activity_chat_module.dart).
 *   - web previously embedded the full ChatMessage shape inside `payload`,
 *     which worked for web→web but crashed web on every mobile→web message:
 *     `payload.sent_at` was undefined, the sort's `.localeCompare(undefined)`
 *     threw, React tore the tree down → blank brown page.
 *
 * Fix: `normalizeIncoming(envelope)` rebuilds a full ChatMessage from envelope
 * + payload regardless of which shape arrived. Web's own send stays canonical
 * (envelope userId + payload `{id, text}`) so mobile reads it cleanly too.
 */
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import type { ActivityEvent } from "@/lib/activitySession";

type ChatMessage = {
  id: string;
  from_user_id: string;
  text: string;
  sent_at: string;
};

const MAX_KEEP = 200;

/** Read one message out of the durable state blob, fully validated. Anything
 *  missing required fields is dropped (rather than coerced) so a single
 *  malformed row from a future schema can't crash the renderer. */
function asChatMessage(raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const text = typeof r.text === "string" ? r.text : null;
  if (!id || text == null) return null;
  return {
    id,
    text,
    from_user_id: typeof r.from_user_id === "string" ? r.from_user_id : "",
    sent_at: typeof r.sent_at === "string" ? r.sent_at : "",
  };
}

function readMessages(state: Record<string, unknown> | null): ChatMessage[] {
  const raw = state?.messages;
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw) {
    const parsed = asChatMessage(m);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Rebuild a ChatMessage from a broadcast envelope. Reads `id` and `text`
 *  from the payload (mobile only ships these two), and falls back to the
 *  envelope's `userId` / `timestamp` for the message-shape fields that mobile
 *  derives from the envelope rather than the payload. Returns null if the
 *  required `id` or `text` are missing — drop, don't crash. */
function normalizeIncoming(e: ActivityEvent): ChatMessage | null {
  const p = e.payload ?? {};
  const id =
    typeof p.id === "string"
      ? p.id
      : typeof (p as { message_id?: unknown }).message_id === "string"
        ? (p as { message_id: string }).message_id
        : null;
  const text =
    typeof p.text === "string"
      ? p.text
      : typeof (p as { body?: unknown }).body === "string"
        ? (p as { body: string }).body
        : null;
  if (!id || text == null) return null;
  return {
    id,
    text,
    // Envelope is authoritative for sender / timestamp. Fall back to
    // payload-embedded fields for web→web messages emitted before this
    // normalization shipped.
    from_user_id:
      typeof (p as { from_user_id?: unknown }).from_user_id === "string"
        ? (p as { from_user_id: string }).from_user_id
        : e.userId || "",
    sent_at:
      typeof (p as { sent_at?: unknown }).sent_at === "string"
        ? (p as { sent_at: string }).sent_at
        : e.timestamp || new Date().toISOString(),
  };
}

/** Union by id, preserving order, capped. Sort is defensive — missing
 *  `sent_at` would have thrown on `.localeCompare`, which is exactly how the
 *  whole chat surface used to take the page down. */
function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const m of [...a, ...b]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  out.sort((x, y) => (x.sent_at || "").localeCompare(y.sent_at || ""));
  return out.slice(-MAX_KEEP);
}

export function Chat() {
  const room = useRoomSession();
  const { session, state } = useActivitySession("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fold durable state (hydrate + postgres_changes) into the local list.
  useEffect(() => {
    const durable = readMessages(state);
    if (durable.length) setMessages((prev) => mergeMessages(prev, durable));
  }, [state]);

  // Live broadcasts from the partner (and our own echo — deduped by id).
  // When we receive a partner's message AND we can persist, write the
  // merged list to durable state so the message survives a reload —
  // matching mobile's "persist on partner's behalf" semantics. Without
  // this, every message after the first vanished from durable state
  // because only the sender persisted; Chat-on-reload pulled an
  // out-of-date snapshot.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.type !== "send") return;
      const m = normalizeIncoming(e);
      if (!m) return;
      setMessages((prev) => {
        const next = mergeMessages(prev, [m]);
        // Persist only when the broadcast came from someone else;
        // our own sends already persist via send() below. Guards
        // against the "echo + persist" loop where we'd re-write the
        // same row twice on every send.
        if (m.from_user_id !== room.senderId && room.canPersist) {
          void session.persist({ messages: next });
        }
        return next;
      });
    });
  }, [session, room.senderId, room.canPersist]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !session) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      from_user_id: room.senderId,
      text: trimmed,
      sent_at: new Date().toISOString(),
    };
    const next = mergeMessages(messages, [msg]);
    setMessages(next);
    // Match mobile's minimal broadcast payload `{id, text}` so the
    // partner's `reduce()` reads sender + timestamp from the envelope.
    // Web's onEvent path still normalizes fully (envelope-or-payload)
    // so older builds that embed the full message in payload keep
    // working.
    void session.sendEvent("send", { id: msg.id, text: msg.text });
    // Piggyback the recap event on the durable PUT — every sent
    // message lands on the timeline with its text in payload.text.
    void session.persist(
      { messages: next },
      { event_type: "message", payload: { text: trimmed } },
    );
    setText("");
  }

  const mine = useMemo(() => new Set([room.senderId]), [room.senderId]);

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 gap-3 min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-secondary/40 border border-white/[0.08] p-3 flex flex-col gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        {messages.length === 0 ? (
          <div className="m-auto text-muted-foreground font-serif italic text-sm text-center px-4">
            say something sweet, or just check in.
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
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 px-1 mb-0.5">
                    {isMine ? "you" : "them"}
                  </span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words shadow-[0_4px_18px_-8px_rgba(0,0,0,0.45)] ${
                    isMine
                      ? "text-primary-foreground rounded-br-sm"
                      : "bg-card text-cream border border-white/[0.08] rounded-bl-sm"
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
          <p className="font-serif italic text-cream/80 text-sm max-w-xs leading-relaxed">
            chat hit a snag. refresh to keep going.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="focus-ring text-[10px] uppercase tracking-[0.28em] text-muted-foreground hover:text-cream transition"
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
