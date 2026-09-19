import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Pin,
  Plus,
  StickyNote as StickyNoteIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Textarea } from "@/components/ui/textarea";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { ApiError } from "@/lib/api";
import {
  markPartnerNotesSeen,
  parseFridgeNotes,
  type FridgeNote,
  type FridgeNotesState,
} from "@/lib/roomWalls";
import { cn } from "@/lib/utils";

const NOTE_MAX = 500;
/** How many notes may be stuck onto the room stage at once. */
const MAX_STAGE_PINS = 2;

type Filter = "all" | "them" | "yours";

const NOTE_PALETTES_MINE = [
  "linear-gradient(168deg, #fffef5 0%, #fef08a 48%, #fde047 100%)",
  "linear-gradient(168deg, #fff8fb 0%, #fbcfe8 50%, #f9a8d4 100%)",
  "linear-gradient(168deg, #f7fdf9 0%, #bbf7d0 50%, #86efac 100%)",
  "linear-gradient(168deg, #fffaf5 0%, #fed7aa 50%, #fdba74 100%)",
  "linear-gradient(168deg, #fffaf7 0%, #f6e3cf 50%, #e8c9a8 100%)",
] as const;

const NOTE_PALETTES_THEIRS = [
  "linear-gradient(168deg, #fffef5 0%, #fef08a 48%, #fde047 100%)",
  "linear-gradient(168deg, #f8fbff 0%, #bfdbfe 50%, #93c5fd 100%)",
  "linear-gradient(168deg, #f7fdf9 0%, #bbf7d0 50%, #86efac 100%)",
  "linear-gradient(168deg, #fdf8ff 0%, #ddd6fe 50%, #c4b5fd 100%)",
  "linear-gradient(168deg, #fffaf7 0%, #f6e3cf 50%, #e8c9a8 100%)",
] as const;

function notePalette(id: string, mine: boolean): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) | 0;
  const palette = Math.abs(h) % 5;
  return mine ? NOTE_PALETTES_MINE[palette] : NOTE_PALETTES_THEIRS[palette];
}

function rotationDeg(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 5) - 2) * 1.1;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StickyNote({
  note,
  mine,
  unread,
  selected,
  pinned,
  onSelect,
}: {
  note: FridgeNote;
  mine: boolean;
  unread: boolean;
  selected: boolean;
  pinned?: boolean;
  onSelect: () => void;
}) {
  const rot = rotationDeg(note.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "fridge-sticky-wrap",
        selected && "fridge-sticky-wrap-selected",
        unread && !selected && "fridge-sticky-wrap-unread",
        pinned && "fridge-sticky-wrap-pinned",
      )}
      style={{ transform: `rotate(${rot}deg)`, ["--note-rot" as string]: `${rot}deg` }}
    >
      <span className="fridge-sticky-cast" aria-hidden />
      <div
        className="fridge-sticky-paper"
        style={{ background: notePalette(note.id, mine) }}
      >
        <span className="fridge-sticky-pin" aria-hidden />
        <span className="fridge-sticky-tape" aria-hidden />
        <span className="fridge-sticky-fold" aria-hidden />
        <span className="fridge-sticky-lines" aria-hidden />
        {unread && !mine && <span className="fridge-sticky-new" aria-label="Unread" />}
        {pinned && (
          <span className="fridge-sticky-room-pin" aria-label="Pinned to room">
            <Pin className="h-2.5 w-2.5 fill-current" aria-hidden />
          </span>
        )}
        <p className="fridge-sticky-text">{note.text}</p>
        <div className="fridge-sticky-meta">
          <span>{mine ? "You" : note.pinned_by_name || "Them"}</span>
          <span>{timeAgo(note.pinned_at)}</span>
        </div>
      </div>
    </button>
  );
}

/** Sticky on the fridge — pin-sticker paper + hover actions. */
function StickyNoteCard({
  note,
  mine,
  unread,
  canEdit,
  pinDisabled,
  selected,
  onSelect,
  onEdit,
  onRemove,
  onTogglePin,
}: {
  note: FridgeNote;
  mine: boolean;
  unread: boolean;
  canEdit: boolean;
  pinDisabled: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div className="group relative pb-3 pt-1">
      <StickyNote
        note={note}
        mine={mine}
        unread={unread}
        selected={selected}
        onSelect={onSelect}
        pinned={note.stage_pinned}
      />
      {canEdit && (
        <div className="absolute -bottom-0.5 left-1/2 z-20 flex -translate-x-1/2 gap-1 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            disabled={pinDisabled}
            aria-pressed={note.stage_pinned}
            title={note.stage_pinned ? "Unpin from room" : pinDisabled ? "Two notes already pinned" : "Pin to room"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border bg-[#141019]/90 shadow-md backdrop-blur-sm transition disabled:opacity-35",
              note.stage_pinned
                ? "border-primary/50 text-primary"
                : "border-white/15 text-cream/80 hover:text-cream",
            )}
          >
            <Pin className={cn("h-3.5 w-3.5", note.stage_pinned && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Edit"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#141019]/90 text-cream/80 shadow-md backdrop-blur-sm transition hover:text-cream"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#141019]/90 text-cream/80 shadow-md backdrop-blur-sm transition hover:border-red-400/40 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function FridgeAppliance({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="fridge-appliance">
      <div className="fridge-body">
        <div className="fridge-crown" aria-hidden />
        <div className="fridge-freezer">
          <div className="fridge-freezer-face">
            <span className="fridge-freezer-handle" aria-hidden />
            <span className="fridge-freezer-badge" aria-hidden />
          </div>
        </div>
        <div className="fridge-seam" aria-hidden />
        <div className="fridge-door">
          <div className="fridge-door-top">
            <span className="fridge-brand">Our fridge</span>
            <span className="fridge-door-hint">tap a note to read</span>
          </div>
          <div className="fridge-door-panel">
            <div className="fridge-handle" aria-hidden />
            <div className={cn("fridge-surface", empty && "fridge-surface-empty")}>
              {children}
            </div>
          </div>
        </div>
        <div className="fridge-toe-kick" aria-hidden />
      </div>
    </div>
  );
}

function NoteDetail({
  note,
  mine,
  canEdit,
  onClose,
  onEdit,
  onRemove,
}: {
  note: FridgeNote;
  mine: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="fridge-note-detail animate-fade-in">
      <div
        className="fridge-detail-paper mx-auto max-w-xs"
        style={{ background: notePalette(note.id, mine), transform: `rotate(${rotationDeg(note.id)}deg)` }}
      >
        <span className="fridge-sticky-pin" aria-hidden />
        <span className="fridge-sticky-tape" aria-hidden />
        <span className="fridge-sticky-fold" aria-hidden />
        <span className="fridge-sticky-lines" aria-hidden />
        <p className="fridge-detail-text">{note.text}</p>
        <p className="fridge-detail-meta">
          {mine ? "From you" : `From ${note.pinned_by_name}`}
          {" · "}
          {timeAgo(note.pinned_at)}
          {note.emergency ? " · greets on entry" : ""}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-2 text-body text-muted-foreground hover:text-cream"
        >
          Close
        </button>
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber/35 bg-amber/10 px-4 py-2 text-body text-amber hover:bg-amber/20"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 px-4 py-2 text-body text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

type Props = {
  /** True when the Fridge tab is visible — marks partner notes read. */
  active?: boolean;
};

/** Fridge notes — sticky notes that greet your partner and stay on the fridge. */
export function FridgeNotes({ active = true }: Props) {
  const room = useRoomSession();
  const { session, state: durable, ready } = useActivitySession("pinned_note");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const data = useMemo(() => parseFridgeNotes(durable), [durable]);
  const [localNotes, setLocalNotes] = useState<FridgeNote[] | null>(null);
  const notes = localNotes ?? data.notes;

  const [text, setText] = useState("");
  const [emergency, setEmergency] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const editingNote = useMemo(
    () => (editingId ? notes.find((n) => n.id === editingId) ?? null : null),
    [editingId, notes],
  );
  const selected = useMemo(
    () => (selectedId ? notes.find((n) => n.id === selectedId) ?? null : null),
    [selectedId, notes],
  );

  const filtered = useMemo(() => {
    if (filter === "them") {
      return notes.filter((n) => n.pinned_by && n.pinned_by !== room.senderId);
    }
    if (filter === "yours") {
      return notes.filter((n) => n.pinned_by === room.senderId);
    }
    return notes;
  }, [filter, notes, room.senderId]);

  const persist = useCallback(
    async (next: FridgeNotesState) => {
      if (!session) {
        toast.error("Still connecting — try again in a moment.");
        return false;
      }
      if (!room.canPersist) {
        toast.error("Sign in to leave notes on the fridge.");
        return false;
      }
      // Optimistic — hold the change locally so rapid successive edits build on
      // each other (avoids a stale write clobbering a prior one) until the
      // durable state echoes back.
      setLocalNotes(next.notes);
      setSaving(true);
      try {
        await session.persist(next as unknown as Record<string, unknown>, {
          event_type: "note_pinned",
          payload: { count: next.notes.length },
        });
        setLocalNotes(null);
        return true;
      } catch (e) {
        setLocalNotes(null);
        toast.error(e instanceof ApiError ? e.message : "Could not save to the fridge.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [session, room.canPersist],
  );

  const markRead = useCallback(async () => {
    if (!session || !room.canPersist) return;
    const nextNotes = markPartnerNotesSeen(notes, room.senderId);
    if (nextNotes.every((n, i) => n.seen_by.length === notes[i]?.seen_by.length)) return;
    await persist({ notes: nextNotes });
  }, [session, room.canPersist, notes, room.senderId, persist]);

  useEffect(() => {
    if (active && ready) void markRead();
  }, [active, ready, markRead]);

  async function stickNote(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;

    if (editingNote) {
      const nextNotes = notes.map((n) =>
        n.id === editingNote.id
          ? { ...n, text: body, emergency, pinned_at: new Date().toISOString() }
          : n,
      );
      const ok = await persist({ notes: nextNotes });
      if (ok) {
        setText("");
        setEditingId(null);
        toast.success("Note updated");
      }
      return;
    }

    const newNote: FridgeNote = {
      id: crypto.randomUUID(),
      text: body,
      pinned_by: room.senderId,
      pinned_by_name: room.displayName,
      pinned_at: new Date().toISOString(),
      emergency,
      seen_by: [room.senderId],
    };
    const ok = await persist({ notes: [...notes, newNote] });
    if (ok) {
      // Ping the partner's activity button (persist alone doesn't broadcast).
      void session?.sendEvent("added", {});
      setText("");
      setEmergency(true);
      setAdding(false);
      toast.success("Stuck on the fridge");
    }
  }

  async function removeNote(id: string) {
    const ok = await persist({ notes: notes.filter((n) => n.id !== id) });
    if (ok) {
      setSelectedId(null);
      setEditingId(null);
      setText("");
      toast.success("Note removed");
    }
  }

  async function togglePin(note: FridgeNote) {
    const willPin = !note.stage_pinned;
    if (willPin && pinnedCount >= MAX_STAGE_PINS) {
      toast.message(`Only ${MAX_STAGE_PINS} notes can sit on the stage — unpin one first.`);
      return;
    }
    const ok = await persist({
      notes: notes.map((n) => (n.id === note.id ? { ...n, stage_pinned: willPin } : n)),
    });
    if (ok) toast.success(willPin ? "Pinned to the room" : "Unpinned");
  }

  function startEdit(note: FridgeNote) {
    setEditingId(note.id);
    setSelectedId(null);
    setAdding(true);
    setText(note.text);
    setEmergency(note.emergency ?? false);
  }

  function cancelEdit() {
    setEditingId(null);
    setAdding(false);
    setText("");
    setEmergency(true);
  }

  function focusAdd() {
    setEditingId(null);
    setSelectedId(null);
    setText("");
    setEmergency(true);
    setAdding(true);
  }

  if (!ready) {
    return (
      <div className="wall-surface flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (!room.canPersist) {
    return (
      <div className="wall-surface">
        <EmptyState variant="fridge" title="Fridge Note" subtitle="Sign in to leave notes on your shared fridge." />
      </div>
    );
  }

  const empty = notes.length === 0;
  const canStick = text.trim().length > 0;
  const pinnedCount = notes.filter((n) => n.stage_pinned).length;

  const showForm = adding || Boolean(editingNote);

  return (
    <div className="wall-surface relative">
      {/* Header — list shows a count + add; the form gets Back + a centred title. */}
      <div className="shrink-0 border-b border-white/[0.06] px-5 py-3">
        {showForm ? (
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={cancelEdit}
              className="absolute left-0 inline-flex items-center gap-1.5 text-body text-primary transition hover:opacity-80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <p className="text-body font-semibold text-cream">{editingNote ? "Edit Note" : "Add Note"}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-label uppercase tracking-[0.2em] text-muted-foreground/70">
              {notes.length} note{notes.length === 1 ? "" : "s"}
              {pinnedCount > 0 ? ` · ${pinnedCount}/${MAX_STAGE_PINS} pinned` : ""}
            </p>
            {room.canPersist && (
              <button
                type="button"
                onClick={focusAdd}
                aria-label="Add a note"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground transition hover:opacity-90"
                style={{ backgroundColor: "var(--room-accent)" }}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {showForm ? (
        <div className="flex-1 min-h-0 overflow-auto p-5">
          <form onSubmit={(e) => void stickNote(e)} className="space-y-3">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
              placeholder="Thinking about you today…"
              rows={4}
              className="resize-none border-white/10 bg-secondary/60 text-body leading-relaxed"
            />
            <label className="flex cursor-pointer items-center gap-2 text-label text-muted-foreground">
              <input
                type="checkbox"
                checked={emergency}
                onChange={(e) => setEmergency(e.target.checked)}
                className="rounded border-border"
              />
              Greet them with this on entry
            </label>
            <button
              type="submit"
              disabled={!canStick || saving}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-body font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "var(--room-accent)" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingNote ? "Save" : "Add note"}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4">
          {empty ? (
            <FridgeAppliance empty>
              <div className="fridge-empty-embedded">
                <EmptyState variant="fridge" title="Fridge Note" onAdd={focusAdd} addLabel="Add a note" />
              </div>
            </FridgeAppliance>
          ) : (
            <>
              <FridgeAppliance>
                <div className="fridge-notes-grid">
                  {notes.map((note) => {
                    const mine = note.pinned_by === room.senderId;
                    const unread = !mine && !!note.pinned_by && !note.seen_by.includes(room.senderId);
                    return (
                      <StickyNoteCard
                        key={note.id}
                        note={note}
                        mine={mine}
                        unread={unread}
                        canEdit={room.canPersist}
                        pinDisabled={!note.stage_pinned && pinnedCount >= MAX_STAGE_PINS}
                        selected={selectedId === note.id}
                        onSelect={() => setSelectedId(selectedId === note.id ? null : note.id)}
                        onEdit={() => startEdit(note)}
                        onRemove={() => void removeNote(note.id)}
                        onTogglePin={() => void togglePin(note)}
                      />
                    );
                  })}
                </div>
              </FridgeAppliance>
              {selected && (
                <div className="mt-4 px-1">
                  <NoteDetail
                    note={selected}
                    mine={selected.pinned_by === room.senderId}
                    canEdit={room.canPersist}
                    onClose={() => setSelectedId(null)}
                    onEdit={() => startEdit(selected)}
                    onRemove={() => void removeNote(selected.id)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FridgeEmpty({
  readonly,
  noteCount = 0,
  onFocusAdd,
  embedded,
}: {
  readonly?: boolean;
  noteCount?: number;
  onFocusAdd?: () => void;
  embedded?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-muted-foreground">
      <span className="text-display" aria-hidden>🧲</span>
      <p className="text-body">No notes yet.</p>
      {readonly ? (
        <p className="text-body">Sign in to leave notes on your shared fridge.</p>
      ) : (
        onFocusAdd && (
          <button
            type="button"
            onClick={onFocusAdd}
            className="rounded-full px-5 py-2 text-body font-semibold text-primary-foreground transition hover:opacity-90"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            {noteCount ? "Write a note" : "Leave the first note"}
          </button>
        )
      )}
    </div>
  );
}
