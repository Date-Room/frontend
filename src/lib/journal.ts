/**
 * Journal API — the `/v1/journal` surface backing Our Room → Journal.
 *
 * Read-only on the client. Entries are written server-side as
 * activities complete; for v1 most Our Rooms will have no entries yet
 * and the screen renders a coherent empty state.
 */
import { api } from "@/lib/api";

export type JournalEntryType =
  | "question_answered"
  | "this_or_that_round"
  | "video_watched"
  | "dj_track"
  | "chat_highlight"
  | "captured_moment"
  | "gesture"
  | "milestone"
  | "memory";

export type JournalEntry = {
  id: string;
  connection_id: string;
  room_id: string | null;
  session_id: string | null;
  type: JournalEntryType;
  payload: Record<string, unknown>;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
};

export type JournalPage = {
  items: JournalEntry[];
  next_cursor: string | null;
};

export function listJournal(
  connectionId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<JournalPage> {
  const q = new URLSearchParams({ connection_id: connectionId });
  if (opts?.cursor) q.set("cursor", opts.cursor);
  if (opts?.limit) q.set("limit", String(opts.limit));
  return api.get<JournalPage>(`/v1/journal?${q.toString()}`);
}
