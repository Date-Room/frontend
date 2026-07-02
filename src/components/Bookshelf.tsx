import { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Film,
  HelpCircle,
  Link2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
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

const SPINE_PALETTES = [
  { bg: "linear-gradient(180deg, #6b2d3c 0%, #3d1822 100%)", accent: "#e8b4bc" },
  { bg: "linear-gradient(180deg, #2c4a6e 0%, #1a2d42 100%)", accent: "#a8c8e8" },
  { bg: "linear-gradient(180deg, #3d5c3a 0%, #243622 100%)", accent: "#b8d4b0" },
  { bg: "linear-gradient(180deg, #6b4a2a 0%, #3d2810 100%)", accent: "#e8c8a0" },
  { bg: "linear-gradient(180deg, #4a3868 0%, #2a2040 100%)", accent: "#c8b8e8" },
  { bg: "linear-gradient(180deg, #5c3a2a 0%, #362018 100%)", accent: "#d8b8a0" },
  { bg: "linear-gradient(180deg, #2a5050 0%, #183030 100%)", accent: "#a0d8d8" },
  { bg: "linear-gradient(180deg, #5c2a4a 0%, #361828 100%)", accent: "#e8a8c8" },
];

function spinePalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * 17) % SPINE_PALETTES.length;
  return SPINE_PALETTES[hash] ?? SPINE_PALETTES[0];
}

function chunkRows<T>(items: T[], perRow: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows.length ? rows : [[]];
}

function BookSpine({
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
  const palette = spinePalette(item.id + item.title);
  const height = 88 + (item.title.length % 3) * 8;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="book-spine"
      data-selected={selected}
      style={{
        background: palette.bg,
        minHeight: `${height}px`,
        maxHeight: `${height + 12}px`,
      }}
      title={item.title}
    >
      {fromPartner && <span className="shelf-partner-dot" aria-label="From your partner" />}
      <span className="book-spine-title" style={{ color: palette.accent }}>
        {item.title}
      </span>
      {item.author && (
        <span
          className="text-[7px] uppercase tracking-wider opacity-70"
          style={{ color: palette.accent, writingMode: "vertical-rl" }}
        >
          {item.author.slice(0, 18)}
        </span>
      )}
    </button>
  );
}

function LinkTab({
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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("shelf-link-tab", selected && "ring-2 ring-amber/60 ring-offset-1 ring-offset-transparent")}
      title={item.title}
    >
      {fromPartner && <span className="shelf-partner-dot" />}
      <Link2 className="mb-1 h-3 w-3 text-amber" />
      <span className="max-h-12 overflow-hidden text-[7px] font-medium leading-tight text-cream/90 [writing-mode:vertical-rl]">
        {item.title.slice(0, 24)}
      </span>
    </button>
  );
}

function WatchCase({
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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("shelf-watch-case", selected && "ring-2 ring-amber/60")}
      title={item.title}
    >
      {fromPartner && <span className="shelf-partner-dot" />}
      <div className="shelf-watch-poster flex items-center justify-center">
        <Film className="h-4 w-4 text-cream/40" />
      </div>
      <div className="border-t border-white/10 bg-black/40 px-1 py-1">
        <p className="truncate text-[8px] font-medium text-cream/85">{item.title}</p>
      </div>
    </button>
  );
}

function AddSpineButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="book-spine shrink-0 border border-dashed border-amber/35 bg-amber/5 hover:bg-amber/10 hover:border-amber/55"
      style={{ minHeight: "5.5rem", maxHeight: "5.5rem", width: "2.25rem" }}
      title="Add to shelf"
    >
      <Plus className="mx-auto h-4 w-4 text-amber" />
      <span className="book-spine-title text-amber/90">Add</span>
    </button>
  );
}

function ShelfRow({
  items,
  children,
  trailing,
}: {
  items: FridgeItem[];
  children: (item: FridgeItem) => React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="bookshelf-row">
      <div className="bookshelf-plank" aria-hidden />
      <div className="bookshelf-cavity">
        {items.length === 0 && !trailing ? (
          <div className="flex flex-1 items-center justify-center py-4">
            <p className="font-serif text-xs italic text-cream/20">empty shelf</p>
          </div>
        ) : (
          <>
            {items.map((item) => (
              <span key={item.id}>{children(item)}</span>
            ))}
            {trailing}
          </>
        )}
      </div>
    </div>
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
  const palette = item.kind === "book" ? spinePalette(item.id + item.title) : null;

  return (
    <div className="bookshelf-detail animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          {item.kind === "book" && palette && (
            <div
              className="book-spine shrink-0 cursor-default pointer-events-none"
              style={{ background: palette.bg, minHeight: "5rem", maxHeight: "5rem", width: "2rem" }}
              data-selected={false}
            >
              <span className="book-spine-title text-[8px]" style={{ color: palette.accent }}>
                {item.title}
              </span>
            </div>
          )}
          {item.kind === "link" && (
            <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-t-md bg-amber/20">
              <Bookmark className="h-5 w-5 text-amber" />
            </div>
          )}
          {item.kind === "watch" && (
            <div className="shelf-watch-case shrink-0 pointer-events-none h-16 w-12">
              <div className="shelf-watch-poster flex items-center justify-center">
                <Film className="h-4 w-4 text-cream/50" />
              </div>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-cream leading-snug">{item.title}</p>
            {item.author && <p className="mt-0.5 text-sm text-muted-foreground">{item.author}</p>}
            {item.note && (
              <p className="mt-2 font-serif text-sm italic text-cream/80">&ldquo;{item.note}&rdquo;</p>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block truncate max-w-full text-xs text-amber hover:underline"
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
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-white/5 hover:text-cream"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {canMarkRead && item.status === "todo" && (
        <button
          type="button"
          onClick={onMarkRead}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-amber/35 bg-amber/10 py-2 text-sm text-amber transition hover:bg-amber/20"
        >
          <Check className="h-4 w-4" />
          Mark read &amp; move to finished shelf
        </button>
      )}
    </div>
  );
}

/** Shared bookshelf — a cozy wooden cabinet of books, links, and watch-list. */
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
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const focusAdd = () => {
    titleRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    titleRef.current?.focus();
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
      setInput("");
      setAuthor("");
      setNote("");
      setNoteOpen(false);
      if (itemKind === "book" && itemKind !== kind) {
        setKind("book");
      }
      toast.success(
        itemKind === "book" ? `"${title}" added to the shelf` : "Placed on the shelf — add another?",
      );
      focusAdd();
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
  const shelfRows = chunkRows(visible, 5);

  if (!ready) {
    return (
      <div className="wall-surface flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber" aria-hidden />
      </div>
    );
  }

  return (
    <div className="wall-surface relative">
      {/* Always-visible quick add — todo shelf only */}
      {room.canPersist && view === "todo" && (
        <div className="border-b border-white/[0.06] shrink-0 px-4 py-3">
          <p className="mb-2 font-serif italic text-amber text-base">Add to the shelf</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {KIND_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setKind(t.id)}
                className="wall-kind-chip"
                data-active={kind === t.id}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => void addFromInput(e)}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              ref={titleRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={kind === "book" ? "Book title…" : "Paste a link or title…"}
              className="focus-ring min-w-0 flex-1 rounded-xl border border-white/10 bg-[#120e0c] px-4 py-2.5 text-sm text-cream placeholder:text-muted-foreground/60"
            />
            {kind === "book" && (
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author"
                className="focus-ring w-full rounded-xl border border-white/10 bg-[#120e0c] px-4 py-2.5 text-sm text-cream placeholder:text-muted-foreground/60 sm:w-36"
              />
            )}
            <button
              type="submit"
              disabled={!input.trim() || saving || resolving}
              className="wall-cta inline-flex shrink-0 items-center justify-center gap-1.5 px-5 py-2.5"
            >
              {saving || resolving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {resolving ? "Reading link…" : "Add"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-cream"
          >
            {noteOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {noteOpen ? "Hide note" : "Add a note for them (optional)"}
          </button>
          {noteOpen && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you'd like it…"
              className="focus-ring mt-2 w-full rounded-xl border border-white/10 bg-[#120e0c] px-4 py-2.5 text-sm text-cream placeholder:text-muted-foreground/60 font-serif italic"
            />
          )}
        </div>
      )}

      <div className="flex gap-6 border-b border-white/[0.06] px-4 pt-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setView("todo");
            setSelectedId(null);
          }}
          className={cn(
            "pb-2 text-sm transition border-b-2",
            view === "todo"
              ? "border-amber text-amber"
              : "border-transparent text-muted-foreground hover:text-cream",
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
            "pb-2 text-sm transition border-b-2",
            view === "done"
              ? "border-amber text-amber"
              : "border-transparent text-muted-foreground hover:text-cream",
          )}
        >
          Finished ({done.length})
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-auto p-4 space-y-4">
        {visible.length === 0 ? (
          <div className="bookshelf-cabinet opacity-90">
            <div className="bookshelf-lamp-glow" aria-hidden />
            <div className="relative flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-cream/15" strokeWidth={1} />
              <p className="font-serif text-lg italic text-cream/40">
                {view === "todo" ? "Your shelf is waiting" : "Nothing finished yet"}
              </p>
              <p className="mt-2 max-w-xs text-xs text-muted-foreground/60">
                {view === "todo"
                  ? "Type a title above and hit Add — it'll appear as a spine on the shelf."
                  : "Mark something read and it'll move up to the finished shelf."}
              </p>
              {room.canPersist && view === "todo" && (
                <button type="button" onClick={focusAdd} className="wall-cta mt-6 inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add your first book
                </button>
              )}
            </div>
            <ShelfRow items={[]} trailing={room.canPersist && view === "todo" ? <AddSpineButton onClick={focusAdd} /> : undefined}>
              {() => null}
            </ShelfRow>
            <ShelfRow items={[]}>{() => null}</ShelfRow>
          </div>
        ) : (
          <>
            <div className="bookshelf-cabinet">
              <div className="bookshelf-lamp-glow" aria-hidden />
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cream/40">
                  {view === "todo" ? "Shared reading shelf" : "Finished together"}
                </p>
                <button
                  type="button"
                  aria-label="Help"
                  title="Tap a spine, bookmark, or case to read details. Gold dot = from your partner."
                  className="text-muted-foreground/50 hover:text-cream"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </div>

              {shelfRows.map((row, ri) => (
                <ShelfRow
                  key={ri}
                  items={row}
                  trailing={
                    room.canPersist && view === "todo" && ri === shelfRows.length - 1 ? (
                      <AddSpineButton onClick={focusAdd} />
                    ) : undefined
                  }
                >
                  {(item) => {
                    const fromPartner = !!item.added_by && item.added_by !== room.senderId;
                    const selectedItem = selectedId === item.id;
                    const displayKind =
                      item.kind === "link" && item.url && isBookUrl(item.url) ? "book" : item.kind;
                    const displayItem =
                      displayKind !== item.kind ? { ...item, kind: displayKind as FridgeItemKind } : item;
                    const props = {
                      item: displayItem,
                      selected: selectedItem,
                      fromPartner,
                      onSelect: () => setSelectedId(selectedItem ? null : item.id),
                    };
                    if (displayKind === "link") return <LinkTab {...props} />;
                    if (displayKind === "watch") return <WatchCase {...props} />;
                    return <BookSpine {...props} />;
                  }}
                </ShelfRow>
              ))}

              {shelfRows.length === 1 && shelfRows[0].length <= 3 && (
                <ShelfRow items={[]} trailing={undefined}>{() => null}</ShelfRow>
              )}
            </div>

            {room.canPersist && view === "todo" && (
              <button
                type="button"
                onClick={focusAdd}
                className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-amber px-4 py-2.5 text-sm font-semibold text-[#1a120c] shadow-[0_8px_32px_rgba(232,157,77,0.45)] transition hover:scale-[1.02]"
              >
                <Plus className="h-4 w-4" />
                Add more
              </button>
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
          </>
        )}
      </div>
    </div>
  );
}
