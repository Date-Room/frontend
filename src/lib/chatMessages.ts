/**
 * Chat message shapes and merging, shared by the room-level ChatProvider and
 * the Chat panel. Pure, so the reconciliation rules are unit-testable.
 *
 * Wire format (mobile parity):
 *  - durable state `{ messages: [{ id, from_user_id, text, sent_at }] }`
 *  - broadcast event type `send` carrying `{ id, text }`; sender + timestamp
 *    come from the activity envelope.
 */
import type { ActivityEvent } from "@/lib/activitySession";

export type ChatMessage = {
  id: string;
  from_user_id: string;
  text: string;
  sent_at: string;
};

export const MAX_KEEP = 200;

/** Read one message out of the durable state blob, fully validated. Anything
 *  missing required fields is dropped (rather than coerced) so a single
 *  malformed row from a future schema can't crash the renderer. */
export function asChatMessage(raw: unknown): ChatMessage | null {
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

export function readMessages(state: Record<string, unknown> | null): ChatMessage[] {
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
export function normalizeIncoming(e: ActivityEvent): ChatMessage | null {
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
export function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
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
