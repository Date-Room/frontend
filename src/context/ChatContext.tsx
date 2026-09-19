/**
 * Room-level chat. Lives for the whole room visit (mounted around RoomStage),
 * not just while the Chat panel is open, so:
 *  - a message arrives and is counted as unread even when Chat is closed;
 *  - a signed-in member persists the partner's messages on their behalf
 *    wherever they are in the room (guests can't write durable state);
 *  - a guest who wrote before anyone else was here keeps those messages and
 *    replays them when someone arrives and asks (`sync_request`, sent on
 *    mount). Mobile's chat reducer ignores anything but `send`.
 *
 * The Chat panel is a view over this: it renders `messages`, calls `send`,
 * and marks itself open so unread stays at zero while it's on the stage.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { mergeMessages, normalizeIncoming, readMessages, type ChatMessage } from "@/lib/chatMessages";

export type ChatRoomValue = {
  messages: ChatMessage[];
  send: (text: string) => void;
  /** Messages from others that arrived while the panel was not open. */
  unread: number;
  /** The most recent message from someone else, for the toast. */
  lastIncoming: ChatMessage | null;
  /** Panel tells us when it is on the stage; unread resets and stays 0. */
  setOpen: (open: boolean) => void;
  /** Messages a guest sent that nobody has persisted yet. */
  pendingCount: number;
};

const ChatCtx = createContext<ChatRoomValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const room = useRoomSession();
  const { session, state } = useActivitySession("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [unread, setUnread] = useState(0);
  const [lastIncoming, setLastIncoming] = useState<ChatMessage | null>(null);
  const openRef = useRef(false);
  const pendingRef = useRef<ChatMessage[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const replayTimersRef = useRef<number[]>([]);

  // Durable state (hydrate + postgres_changes) folds into the list, and
  // settles any guest messages that have now landed.
  useEffect(() => {
    const durable = readMessages(state);
    if (!durable.length) return;
    setMessages((prev) => mergeMessages(prev, durable));
    if (pendingRef.current.length) {
      const landed = new Set(durable.map((m) => m.id));
      pendingRef.current = pendingRef.current.filter((m) => !landed.has(m.id));
      setPendingCount(pendingRef.current.length);
    }
  }, [state]);

  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.type === "sync_request") {
        if (e.userId === room.senderId) return;
        if (room.canPersist || pendingRef.current.length === 0) return;
        replayTimersRef.current.forEach((t) => window.clearTimeout(t));
        replayTimersRef.current = pendingRef.current.map((m, i) =>
          window.setTimeout(() => void session.sendEvent("send", { id: m.id, text: m.text }), i * 250),
        );
        return;
      }
      if (e.type !== "send") return;
      const m = normalizeIncoming(e);
      if (!m) return;
      if (messagesRef.current.some((p) => p.id === m.id)) return;
      const next = mergeMessages(messagesRef.current, [m]);
      messagesRef.current = next;
      setMessages(next);
      if (m.from_user_id === room.senderId) return;
      // Persist on the partner's behalf; our own sends persist in send().
      if (room.canPersist) void session.persist({ messages: next });
      setLastIncoming(m);
      if (!openRef.current) setUnread((n) => n + 1);
    });
  }, [session, room.senderId, room.canPersist]);

  // Ask the room for anything said before we got here.
  useEffect(() => {
    if (!session) return;
    void session.sendEvent("sync_request", {});
    return () => replayTimersRef.current.forEach((t) => window.clearTimeout(t));
  }, [session]);

  const send = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || !session) return;
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        from_user_id: room.senderId,
        text: trimmed,
        sent_at: new Date().toISOString(),
      };
      const next = mergeMessages(messagesRef.current, [msg]);
      messagesRef.current = next;
      setMessages(next);
      // Recap event rides on the durable PUT (members only).
      void session.persist({ messages: next }, { event_type: "message", payload: { text: trimmed } });
      // Minimal payload; the partner reads sender + time from the envelope.
      void session.sendEvent("send", { id: msg.id, text: msg.text });
      if (!room.canPersist) {
        pendingRef.current = [...pendingRef.current, msg];
        setPendingCount(pendingRef.current.length);
      }
    },
    [session, room.senderId, room.canPersist],
  );

  const setOpen = useCallback((open: boolean) => {
    openRef.current = open;
    if (open) setUnread(0);
  }, []);

  const value = useMemo<ChatRoomValue>(
    () => ({ messages, send, unread, lastIncoming, setOpen, pendingCount }),
    [messages, send, unread, lastIncoming, setOpen, pendingCount],
  );
  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}

export function useChatRoom(): ChatRoomValue | null {
  return useContext(ChatCtx);
}
