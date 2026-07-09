import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Film,
  Link2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { ApiError } from "@/lib/api";
import {
  parseFridge,
  type FridgeItem,
  type FridgeItemKind,
  type FridgeState,
} from "@/lib/roomWalls";
import {
  fallbackLinkTitle,
  fetchLinkPreview,
  isBookUrl,
  isHttpUrl,
} from "@/lib/linkPreview";
import { cn } from "@/lib/utils";

const KIND_TABS: { id: FridgeItemKind; label: string; icon: typeof BookOpen }[] = [
  { id: "book", label: "Book", icon: BookOpen },
  { id: "link", label: "Link", icon: Link2 },
  { id: "watch", label: "Watch", icon: Film },
];

function kindIcon(kind: FridgeItemKind) {
  return kind === "link" ? Link2 : kind === "watch" ? Film : BookOpen;
}

/** A single shelf item — icon chip + title + author/note, with a partner dot
 *  and finished tick. Tapping selects it to reveal details below. */
function ItemRow({
  item,
  selected,
  fromPartner,
  onSelect,
}: {
  item: FridgeItem;
  selected: boolean;
  fromPartner: boolean;
  onSelect: () => void;
}) {
  const Icon = kindIcon(item.kind);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
        selected
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm text-cream">{item.title}</span>
          {fromPartner && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="From your partner" />}
        </span>
        {(item.author || item.note) && (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {item.author || item.note}
          </span>
        )}
      </span>
      {item.status === "done" && <Check className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function ItemDetail({
  item,
  fromPartner,
  onClose,
  onMarkRead,
  canMarkRead,
}: {
  item: FridgeItem;
  fromPartner: boolean;
  onClose: () => void;
  onMarkRead: () => void;
  canMarkRead: boolean;
}) {
  const Icon = kindIcon(item.kind);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-cream">{item.title}</p>
            {item.author && <p className="mt-0.5 text-sm text-muted-foreground">{item.author}</p>}
            {item.note && <p className="mt-2 text-sm text-cream/80">&ldquo;{item.note}&rdquo;</p>}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block max-w-full truncate text-xs text-primary hover:underline"
              >
                Open link
              </a>
            )}
            <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              {fromPartner ? "From them" : "From you"}
              {item.status === "done" ? " · finished" : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-white/5 hover:text-cream"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {canMarkRead && item.status === "todo" && (
        <button
          type="button"
          onClick={onMarkRead}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-2 text-sm text-primary transition hover:bg-primary/20"
        >
          <Check className="h-4 w-4" />
          Mark read &amp; move to finished
        </button>
      )}
    </div>
  );
}

/** Shared bookshelf — a simple, spaced list of books, links, and watch-list. */
export function Bookshelf() {
  const room = useRoomSession();
  const { session, state: durable, ready } = useActivitySession("fridge");

  const fridge = useMemo(() => parseFridge(durable), [durable]);
  const [kind, setKind] = useState<FridgeItemKind>("book");
  const [input, setInput] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [view, setView] = useState<"todo" | "done">("todo");
  const [noteOpen, setNoteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const focusAdd = () => {
    setView("todo");
    setSelectedId(null);
    setAdding(true);
    setTimeout(() => titleRef.current?.focus(), 60);
  };

  async function persist(next: FridgeState) {
    if (!session) {
      toast.error("Still connecting — try again.");
      return false;
    }
    setSaving(true);
    try {
      await session.persist(next as unknown as Record<string, unknown>, {
        event_type: "fridge_updated",
        payload: { item_count: next.items.length },
      });
      return true;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update the shelf.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addFromInput(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || !session) return;

    let title = raw;
    let url: string | undefined;
    let itemKind = kind;
    let resolvedAuthor = kind === "book" && author.trim() ? author.trim() : undefined;

    if (isHttpUrl(raw)) {
      url = raw;
      setResolving(true);
      const preview = await fetchLinkPreview(raw);
      setResolving(false);

      if (preview?.title) {
        title = preview.title;
        if (preview.author && !resolvedAuthor) {
          resolvedAuthor = preview.author;
        }
        if (preview.is_book || isBookUrl(raw)) {
          itemKind = "book";
        } else if (kind === "watch") {
          itemKind = "watch";
        } else {
          itemKind = "link";
        }
      } else {
        title = fallbackLinkTitle(raw);
        if (isBookUrl(raw)) {
          itemKind = "book";
          toast.message("Couldn't read the page title — edit the name after adding if needed.");
        }
      }
    }

    const item: FridgeItem = {
      id: crypto.randomUUID(),
      kind: itemKind,
      title,
      author: resolvedAuthor,
      url,
      note: note.trim() || undefined,
      status: "todo",
      added_by: room.senderId,
      added_by_name: room.displayName,
      read_by: [],
      hearts: 0,
    };
    const ok = await persist({ items: [...fridge.items, item] });
    if (ok) {
      // Ping the partner's activity button (persist alone doesn't broadcast).
      void session?.sendEvent("added", {});
      setInput("");
      setAuthor("");
      setNote("");
      setNoteOpen(false);
      if (itemKind === "book" && itemKind !== kind) {
        setKind("book");
      }
      setAdding(false);
      toast.success(itemKind === "book" ? `"${title}" added to the shelf` : "Placed on the shelf");
    }
  }

  async function markRead(item: FridgeItem) {
    const readBy = [...new Set([...(item.read_by ?? []), room.senderId])];
    const ok = await persist({
      items: fridge.items.map((i) =>
        i.id === item.id ? { ...i, status: "done", read_by: readBy } : i,
      ),
    });
    if (ok) {
      setSelectedId(null);
      toast.success("Moved to the finished shelf");
    }
  }

  const todo = fridge.items.filter((i) => i.status === "todo");
  const done = fridge.items.filter((i) => i.status === "done");
  const visible = view === "todo" ? todo : done;
  const selected = visible.find((i) => i.id === selectedId) ?? null;

  if (!ready) {
    return (
      <div className="wall-surface flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  const showForm = adding && room.canPersist;

  // ── Add screen (its own view, like Vision Board) ──
  if (showForm) {
    return (
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-5 sm:p-6">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="absolute left-0 inline-flex items-center gap-1.5 text-sm text-primary transition hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p className="text-sm font-semibold text-cream">Add to Shelf</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {KIND_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setKind(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                kind === t.id
                  ? "border-primary/50 bg-primary/10 text-cream"
                  : "border-white/10 text-muted-foreground hover:text-cream",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => void addFromInput(e)} className="space-y-3">
          <input
            ref={titleRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={kind === "book" ? "Book title…" : "Paste a link or title…"}
            className="focus-ring w-full rounded-xl border border-white/10 bg-secondary/60 px-4 py-2.5 text-sm text-cream placeholder:text-muted-foreground/60"
          />
          {kind === "book" && (
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author"
              className="focus-ring w-full rounded-xl border border-white/10 bg-secondary/60 px-4 py-2.5 text-sm text-cream placeholder:text-muted-foreground/60"
            />
          )}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A note for them (optional)…"
            className="focus-ring w-full rounded-xl border border-white/10 bg-secondary/60 px-4 py-2.5 text-sm text-cream placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={!input.trim() || saving || resolving}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            {saving || resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {resolving ? "Reading link…" : "Add to shelf"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5 sm:p-6">
      {/* Tabs + add */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08]">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => {
              setView("todo");
              setSelectedId(null);
            }}
            className={cn(
              "border-b-2 pb-2 text-sm transition",
              view === "todo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-cream",
            )}
          >
            To read &amp; watch ({todo.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setView("done");
              setSelectedId(null);
            }}
            className={cn(
              "border-b-2 pb-2 text-sm transition",
              view === "done" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-cream",
            )}
          >
            Finished ({done.length})
          </button>
        </div>
        {room.canPersist && (
          <button
            type="button"
            onClick={focusAdd}
            aria-label="Add to shelf"
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground transition hover:opacity-90"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <EmptyState
          variant="bookshelf"
          title="Bookshelf"
          subtitle={view === "done" ? "Nothing finished yet." : undefined}
          onAdd={room.canPersist && view === "todo" ? focusAdd : undefined}
          addLabel="Add to shelf"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((item) => {
            const fromPartner = !!item.added_by && item.added_by !== room.senderId;
            return (
              <ItemRow
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                fromPartner={fromPartner}
                onSelect={() => setSelectedId(selectedId === item.id ? null : item.id)}
              />
            );
          })}
        </div>
      )}

      {selected && (
        <ItemDetail
          item={selected}
          fromPartner={!!selected.added_by && selected.added_by !== room.senderId}
          onClose={() => setSelectedId(null)}
          onMarkRead={() => void markRead(selected)}
          canMarkRead={room.canPersist}
        />
      )}
    </div>
  );
}
