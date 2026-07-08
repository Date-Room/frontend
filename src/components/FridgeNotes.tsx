import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HelpCircle,
  Loader2,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
  onSelect,
}: {
  note: FridgeNote;
  mine: boolean;
  unread: boolean;
  selected: boolean;
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
      )}
      style={{ transform: `rotate(${rot}deg)`, ["--note-rot" as string]: `${rot}deg` }}
    >
      <span className="fridge-sticky-cast" aria-hidden />
      <div
        className="fridge-sticky-paper"
        style={{ background: notePalette(note.id, mine) }}
      >
        <span className="fridge-sticky-magnet" aria-hidden />
        <span className="fridge-sticky-tape" aria-hidden />
        <span className="fridge-sticky-fold" aria-hidden />
        <span className="fridge-sticky-lines" aria-hidden />
        {unread && !mine && <span className="fridge-sticky-new" aria-label="Unread" />}
        <p className="fridge-sticky-text">{note.text}</p>
        <div className="fridge-sticky-meta">
          <span>{mine ? "You" : note.pinned_by_name || "Them"}</span>
          <span>{timeAgo(note.pinned_at)}</span>
        </div>
      </div>
    </button>
  );
}

/** A note in the list — a coloured sticky swatch + text, with pin / edit /
 *  remove. Distinct from the vision list (paper hues, not photos); notes only
 *  become draggable once stuck onto the room stage. */
function FridgeRow({
  note,
  mine,
  unread,
  canEdit,
  pinDisabled,
  onEdit,
  onRemove,
  onTogglePin,
}: {
  note: FridgeNote;
  mine: boolean;
  unread: boolean;
  canEdit: boolean;
  pinDisabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex gap-3 rounded-2xl border p-3 transition",
        note.stage_pinned
          ? "border-primary/40 bg-primary/[0.07]"
          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]",
      )}
    >
      <span
        className="mt-0.5 w-1.5 shrink-0 self-stretch rounded-full"
        style={{ background: notePalette(note.id, mine) }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm leading-snug text-cream/90 line-clamp-4">
          {note.text}
        </p>
        <p className="mt-1.5 truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
          {mine ? "You" : note.pinned_by_name || "Them"} · {timeAgo(note.pinned_at)}
          {note.emergency ? " · greets on entry" : ""}
          {note.stage_pinned ? " · on stage" : ""}
          {unread ? " · new" : ""}
        </p>
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-start gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            disabled={pinDisabled}
            aria-pressed={note.stage_pinned}
            title={note.stage_pinned ? "Unpin from room" : pinDisabled ? "Two notes already pinned" : "Pin to room"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-35",
              note.stage_pinned
                ? "border-primary/50 bg-primary/20 text-primary"
                : "border-white/10 text-muted-foreground hover:text-cream",
            )}
          >
            <Pin className={cn("h-4 w-4", note.stage_pinned && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-muted-foreground opacity-0 transition hover:text-cream group-hover:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-muted-foreground opacity-0 transition hover:border-red-400/30 hover:text-red-300 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
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
        <span className="fridge-sticky-magnet" aria-hidden />
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
          className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-cream"
        >
          Close
        </button>
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber/35 bg-amber/10 px-4 py-2 text-sm text-amber hover:bg-amber/20"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
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
      setText("");
      setEmergency(true);
      toast.success("Stuck on the fridge — add another?");
      textareaRef.current?.focus();
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
    setText(note.text);
    setEmergency(note.emergency ?? false);
    textareaRef.current?.focus();
  }

  function cancelEdit() {
    setEditingId(null);
    setText("");
    setEmergency(true);
  }

  function focusAdd() {
    setEditingId(null);
    setSelectedId(null);
    setText("");
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    textareaRef.current?.focus();
  }

  if (!ready) {
    return (
      <div className="wall-surface flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber" aria-hidden />
      </div>
    );
  }

  if (!room.canPersist) {
    return (
      <div className="wall-surface">
        <FridgeEmpty readonly noteCount={notes.length} onFocusAdd={focusAdd} />
      </div>
    );
  }

  const empty = notes.length === 0;
  const canStick = text.trim().length > 0;
  const pinnedCount = notes.filter((n) => n.stage_pinned).length;

  return (
    <div className="wall-surface relative">
      {/* Always-visible quick add */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-serif italic text-amber text-base">
            {editingNote ? "Edit your note" : "Stick a note on the fridge"}
          </p>
          <button
            type="button"
            aria-label="Help"
            title="Notes stay on the fridge for both of you. Check 'Greet on entry' to show yours first when they arrive."
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-muted-foreground hover:text-cream"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={(e) => void stickNote(e)} className="space-y-2">
          <div className="fridge-draft-wrap">
            <div
              className="fridge-sticky-paper fridge-draft-paper"
              style={{ background: NOTE_PALETTES_MINE[0] }}
            >
              <span className="fridge-sticky-magnet" aria-hidden />
              <span className="fridge-sticky-tape" aria-hidden />
              <span className="fridge-sticky-fold" aria-hidden />
              <span className="fridge-sticky-lines" aria-hidden />
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
                placeholder="Thinking about you today. Don't let me forget we said we'd plan the trip tonight. x"
                rows={5}
                className="fridge-draft-input"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={emergency}
                onChange={(e) => setEmergency(e.target.checked)}
                className="rounded border-border"
              />
              Greet them with this when they enter
            </label>
            <div className="flex gap-2">
              {editingNote && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-cream"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!canStick || saving}
                className="wall-cta inline-flex items-center justify-center gap-1.5 px-5 py-2.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingNote ? "Save changes" : "Stick on fridge"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Filter tabs */}
      {!empty && (
        <div className="flex gap-6 border-b border-white/[0.06] px-4 pt-2 shrink-0">
          {(
            [
              { id: "all" as const, label: `All (${notes.length})` },
              {
                id: "them" as const,
                label: `From them (${notes.filter((n) => n.pinned_by !== room.senderId).length})`,
              },
              {
                id: "yours" as const,
                label: `Yours (${notes.filter((n) => n.pinned_by === room.senderId).length})`,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setFilter(t.id);
                setSelectedId(null);
              }}
              className={cn(
                "pb-2 text-sm transition border-b-2",
                filter === t.id
                  ? "border-amber text-amber"
                  : "border-transparent text-muted-foreground hover:text-cream",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1 min-h-0 overflow-auto p-3 sm:p-4">
        {empty ? (
          <FridgeEmpty onFocusAdd={focusAdd} />
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No notes in this view yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((note) => {
              const mine = note.pinned_by === room.senderId;
              const unread = !mine && !!note.pinned_by && !note.seen_by.includes(room.senderId);
              return (
                <FridgeRow
                  key={note.id}
                  note={note}
                  mine={mine}
                  unread={unread}
                  canEdit={room.canPersist}
                  pinDisabled={!note.stage_pinned && pinnedCount >= MAX_STAGE_PINS}
                  onEdit={() => startEdit(note)}
                  onRemove={() => void removeNote(note.id)}
                  onTogglePin={() => void togglePin(note)}
                />
              );
            })}
          </div>
        )}

        {!empty && !editingNote && (
          <button
            type="button"
            onClick={focusAdd}
            className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-amber px-4 py-2.5 text-sm font-semibold text-[#1a120c] shadow-[0_8px_32px_rgba(232,157,77,0.45)] transition hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Another note
          </button>
        )}
      </div>
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
  const content = (
    <>
      <span className="text-3xl" aria-hidden>
        🧲
      </span>
      <p className="mt-3 font-serif text-base italic text-[#2a2018]/45">
        {embedded ? "The door is empty — stick your first note above" : "Fridge Notes"}
      </p>
      {!embedded && (
        <div className="wall-empty-copy mt-4 space-y-3">
          <p>Like notes on the kitchen fridge. Leave a thought, a reminder, an I-love-you.</p>
          <p>Every note stays here — yours and theirs — so you can look back anytime.</p>
        </div>
      )}
      {!readonly && onFocusAdd && (
        <button
          type="button"
          className={cn("wall-cta inline-flex items-center gap-2", embedded ? "mt-4" : "mt-8")}
          onClick={onFocusAdd}
        >
          <Plus className="h-4 w-4" />
          {noteCount || embedded ? "Write a note above" : "Leave the first note"}
        </button>
      )}
      {readonly && !embedded && (
        <p className="mt-6 text-sm text-muted-foreground">Sign in to leave notes on your shared fridge.</p>
      )}
    </>
  );

  if (embedded) {
    return <div className="fridge-empty-embedded">{content}</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {content}
    </div>
  );
}
