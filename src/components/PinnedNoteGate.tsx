import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { parsePinnedNote, shouldShowPinnedNote, type PinnedNoteState } from "@/lib/roomWalls";

type Props = {
  enabled: boolean;
};

/**
 * First thing partners see when entering a persistent room — a pinned
 * note left on the fridge. Dismiss with "Take it in".
 */
export function PinnedNoteGate({ enabled }: Props) {
  const room = useRoomSession();
  const { session, state: durable, ready } = useActivitySession("pinned_note");

  const note = useMemo(() => parsePinnedNote(durable), [durable]);
  const visible = enabled && ready && shouldShowPinnedNote(note, room.senderId);

  if (!visible || !note || !session) return null;

  async function dismiss() {
    const next: PinnedNoteState = {
      ...note!,
      seen_by: [...new Set([...note!.seen_by, room.senderId])],
    };
    await session!.persist(next as unknown as Record<string, unknown>);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-md px-4 animate-fade-in">
      <div className="w-full max-w-md text-center">
        <p className="font-serif italic text-cream/90 text-lg sm:text-xl mb-4">
          {note.emergency ? "A note was waiting for you" : "Something was left for you"}
        </p>
        <div className="relative mx-auto max-w-sm">
          <span
            className="absolute -top-2 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-rosegold shadow-[0_0_12px_rgba(212,130,106,0.6)]"
            aria-hidden
          />
          <div className="rounded-2xl bg-[#F5E6D3] px-6 py-8 text-left shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <p className="font-serif text-[#2A2018] text-lg leading-relaxed whitespace-pre-wrap">
              {note.text}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#2A2018]/45">
              from {note.pinned_by_name}
            </p>
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                onClick={() => void dismiss()}
                className="rounded-full px-8 text-primary-foreground hover:opacity-90"
                style={{ backgroundColor: "var(--room-accent, hsl(var(--primary)))" }}
              >
                Take it in
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pin a note from the Bookshelf tab — shown to partner on next entry. */
export function PinNotePanel() {
  const room = useRoomSession();
  const { session, state: durable } = useActivitySession("pinned_note");
  const note = useMemo(() => parsePinnedNote(durable), [durable]);
  const [text, setText] = useState("");
  const [emergency, setEmergency] = useState(true);

  if (!room.canPersist || !session) return null;

  async function pin(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const next = {
      text: body,
      pinned_by: room.senderId,
      pinned_by_name: room.displayName,
      pinned_at: new Date().toISOString(),
      emergency,
      seen_by: [room.senderId],
    };
    await session!.persist(next as unknown as Record<string, unknown>, {
      event_type: "note_pinned",
      payload: { emergency },
    });
    setText("");
  }

  return (
    <form onSubmit={(e) => void pin(e)} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Pin a note for them
      </p>
      {note?.text && (
        <p className="text-xs text-muted-foreground/80">
          Current note pinned by {note.pinned_by_name}. Pinning again replaces it.
        </p>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Thinking about you today…"
        rows={3}
        className="bg-secondary/50 border-white/10 resize-none font-serif"
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={emergency}
          onChange={(e) => setEmergency(e.target.checked)}
          className="rounded border-border"
        />
        Show as the first thing they see when they enter
      </label>
      <Button type="submit" className="rounded-full w-full" disabled={!text.trim()}>
        Pin note
      </Button>
    </form>
  );
}
