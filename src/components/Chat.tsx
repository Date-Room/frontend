/**
 * Chat — ported to the shared `chat` activity protocol (mobile parity):
 *  - durable state `{ messages: [{ id, from_user_id, text, sent_at }] }`
 *  - broadcast event type `send` carrying one message
 * Messages converge via broadcast first; signed-in members persist the list.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";

type ChatMessage = {
  id: string;
  from_user_id: string;
  text: string;
  sent_at: string;
};

const MAX_KEEP = 200;

function readMessages(state: Record<string, unknown> | null): ChatMessage[] {
  const raw = state?.messages;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is ChatMessage =>
      !!m && typeof m === "object" && typeof (m as ChatMessage).id === "string",
  );
}

/** Union by id, preserving order, capped. */
function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const m of [...a, ...b]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  out.sort((x, y) => x.sent_at.localeCompare(y.sent_at));
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
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.type !== "send") return;
      const m = e.payload as unknown as ChatMessage;
      if (!m?.id) return;
      setMessages((prev) => mergeMessages(prev, [m]));
    });
  }, [session]);

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
    void session.sendEvent("send", msg as unknown as Record<string, unknown>);
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
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-secondary/60 border border-border p-3 flex flex-col gap-2"
      >
        {messages.length === 0 ? (
          <div className="m-auto text-muted-foreground font-serif italic text-sm text-center px-4">
            say something sweet, or just check in.
          </div>
        ) : (
          messages.map((m) => {
            const isMine = mine.has(m.from_user_id);
            return (
              <div
                key={m.id}
                className={`flex flex-col max-w-[80%] ${isMine ? "self-end items-end" : "self-start items-start"}`}
              >
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-1">
                  {isMine ? "you" : "them"}
                </span>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words ${
                    isMine
                      ? "bg-amber text-primary-foreground rounded-br-sm"
                      : "bg-card text-cream border border-border rounded-bl-sm"
                  }`}
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
          placeholder="Type a message..."
          className="bg-secondary border-border"
          autoComplete="off"
        />
        <Button
          type="submit"
          disabled={!text.trim()}
          className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
