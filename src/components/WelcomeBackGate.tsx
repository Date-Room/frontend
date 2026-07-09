import { useCallback, useMemo, useState } from "react";
import { BookOpen, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import {
  greetingFridgeNote,
  markPartnerNotesSeen,
  parseFridgeNotes,
  parseVisionBoard,
  parseFridge,
  newFridgeItems,
  markFridgeItemsRead,
  newVisionItems,
  markVisionItemsSeen,
  markRoomVisited,
  type FridgeItem,
} from "@/lib/roomWalls";

type Props = {
  enabled: boolean;
};

/**
 * Welcome-back gate for persistent rooms. Aggregates every update the
 * partner left since last visit:
 *   1. Pinned fridge note (urgent, shown front-and-centre)
 *   2. New bookshelf items (books / links / watch)
 *   3. New vision-board pictures
 *
 * If nothing is new, the gate is invisible — the couple lands directly
 * on the room view (vision board + activities).
 */
export function WelcomeBackGate({ enabled }: Props) {
  const room = useRoomSession();
  const { session: noteSession, state: noteRaw, ready: noteReady } =
    useActivitySession("pinned_note");
  const { session: fridgeSession, state: fridgeRaw, ready: fridgeReady } =
    useActivitySession("fridge");
  const { session: boardSession, state: boardRaw, ready: boardReady } =
    useActivitySession("vision_board");

  const [dismissed, setDismissed] = useState(false);

  const fridgeNotes = useMemo(() => parseFridgeNotes(noteRaw), [noteRaw]);
  const greetingNote = useMemo(
    () => (enabled && noteReady ? greetingFridgeNote(fridgeNotes.notes, room.senderId) : null),
    [enabled, noteReady, fridgeNotes.notes, room.senderId],
  );
  const hasNote = !!greetingNote;

  const fridgeUpdates = useMemo(() => {
    if (!fridgeReady) return [];
    return newFridgeItems(parseFridge(fridgeRaw), room.senderId);
  }, [fridgeRaw, fridgeReady, room.senderId]);

  const boardCount = useMemo(() => {
    if (!boardReady) return 0;
    return newVisionItems(parseVisionBoard(boardRaw), room.senderId).length;
  }, [boardRaw, boardReady, room.senderId]);

  const allReady = noteReady && fridgeReady && boardReady;
  const hasUpdates = hasNote || fridgeUpdates.length > 0 || boardCount > 0;

  const handleDismiss = useCallback(async () => {
    // Mark everything the gate just showed as seen/read so it never re-appears.
    const writes: Promise<void>[] = [];
    if (hasNote && noteSession) {
      writes.push(
        noteSession.persist({
          notes: markPartnerNotesSeen(fridgeNotes.notes, room.senderId),
        } as unknown as Record<string, unknown>),
      );
    }
    if (fridgeUpdates.length > 0 && fridgeSession) {
      writes.push(
        fridgeSession.persist({
          items: markFridgeItemsRead(parseFridge(fridgeRaw), room.senderId),
        } as unknown as Record<string, unknown>),
      );
    }
    if (boardCount > 0 && boardSession) {
      writes.push(
        boardSession.persist({
          items: markVisionItemsSeen(parseVisionBoard(boardRaw), room.senderId),
        } as unknown as Record<string, unknown>),
      );
    }
    markRoomVisited(room.roomId);
    setDismissed(true);
    try {
      await Promise.all(writes);
    } catch {
      /* best-effort; the gate is already dismissed locally */
    }
  }, [
    hasNote,
    noteSession,
    fridgeNotes.notes,
    fridgeUpdates.length,
    fridgeSession,
    fridgeRaw,
    boardCount,
    boardSession,
    boardRaw,
    room.senderId,
    room.roomId,
  ]);

  if (!enabled || dismissed || !allReady || !hasUpdates) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-md px-4 animate-fade-in">
      <div className="w-full max-w-md space-y-5 text-center">
        {/* Pinned note */}
        {hasNote && greetingNote && (
          <>
            <p className="font-serif italic text-cream/90 text-lg sm:text-xl">
              {greetingNote.emergency ? "A note was waiting for you" : "Something was left for you"}
            </p>
            <div className="relative mx-auto max-w-sm">
              <span
                className="absolute -top-2 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-rosegold shadow-[0_0_12px_rgba(232,166,83,0.6)]"
                aria-hidden
              />
              <div className="rounded-2xl bg-[#F5E6D3] px-6 py-8 text-left shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                <p className="font-serif text-[#2A2018] text-lg leading-relaxed whitespace-pre-wrap">
                  {greetingNote.text}
                </p>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#2A2018]/45">
                  from {greetingNote.pinned_by_name}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Update summary chips */}
        {(fridgeUpdates.length > 0 || boardCount > 0) && (
          <div className="space-y-2">
            {fridgeUpdates.length > 0 && (
              <UpdateChip
                icon={<BookOpen className="h-4 w-4 shrink-0" />}
                text={fridgeLabel(fridgeUpdates)}
              />
            )}
            {boardCount > 0 && (
              <UpdateChip
                icon={<ImageIcon className="h-4 w-4 shrink-0" />}
                text={`${boardCount} picture${boardCount === 1 ? "" : "s"} on the wall`}
              />
            )}
          </div>
        )}

        <Button
          type="button"
          onClick={() => void handleDismiss()}
          className="rounded-full px-8 text-primary-foreground hover:opacity-90"
          style={{ backgroundColor: "var(--room-accent, hsl(var(--primary)))" }}
        >
          Take it in
        </Button>
      </div>
    </div>
  );
}

function UpdateChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="mx-auto flex max-w-sm items-center gap-3 rounded-xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/[0.08]">
      <span className="text-amber">{icon}</span>
      <span className="text-sm text-cream/85">{text}</span>
    </div>
  );
}

function fridgeLabel(items: FridgeItem[]): string {
  const books = items.filter((i) => i.kind === "book");
  const links = items.filter((i) => i.kind === "link");
  const watches = items.filter((i) => i.kind === "watch");
  const parts: string[] = [];
  if (books.length) {
    parts.push(
      books.length === 1
        ? `"${books[0].title}" landed on the shelf`
        : `${books.length} new books on the shelf`,
    );
  }
  if (links.length) parts.push(`${links.length} new link${links.length > 1 ? "s" : ""}`);
  if (watches.length) parts.push(`${watches.length} new watch item${watches.length > 1 ? "s" : ""}`);
  return parts.join(" · ") || `${items.length} new item${items.length > 1 ? "s" : ""} on the shelf`;
}
