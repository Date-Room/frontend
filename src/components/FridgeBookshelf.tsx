import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Film, Heart, Link2, Plus, RotateCcw } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import {
  parseFridge,
  type FridgeItem,
  type FridgeItemKind,
  type FridgeState,
} from "@/lib/roomWalls";
import { PinNotePanel } from "@/components/PinnedNoteGate";
import { cn } from "@/lib/utils";

const KIND_TABS: { id: FridgeItemKind; label: string; icon: typeof BookOpen }[] = [
  { id: "book", label: "Book", icon: BookOpen },
  { id: "link", label: "Link", icon: Link2 },
  { id: "watch", label: "Watch", icon: Film },
];

function kindIcon(kind: FridgeItemKind) {
  if (kind === "link") return Link2;
  if (kind === "watch") return Film;
  return BookOpen;
}

/** Shared bookshelf — books, links, and watch-list on the room fridge. */
export function FridgeBookshelf() {
  const room = useRoomSession();
  const { session, state: durable } = useActivitySession("fridge");

  const fridge = useMemo(() => parseFridge(durable), [durable]);
  const [kind, setKind] = useState<FridgeItemKind>("book");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [view, setView] = useState<"todo" | "done">("todo");

  async function persist(next: FridgeState) {
    if (!session) return;
    await session.persist(next as unknown as Record<string, unknown>, {
      event_type: "fridge_updated",
      payload: { item_count: next.items.length },
    });
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !session) return;
    const item: FridgeItem = {
      id: crypto.randomUUID(),
      kind,
      title: title.trim(),
      author: author.trim() || undefined,
      url: url.trim() || undefined,
      note: note.trim() || undefined,
      status: "todo",
      added_by: room.senderId,
      added_by_name: room.displayName,
      read_by: [],
      hearts: 0,
    };
    await persist({ items: [...fridge.items, item] });
    setTitle("");
    setAuthor("");
    setUrl("");
    setNote("");
  }

  async function toggleDone(item: FridgeItem) {
    const nextStatus = item.status === "todo" ? "done" : "todo";
    const readBy =
      nextStatus === "done" && !item.read_by?.includes(room.senderId)
        ? [...(item.read_by ?? []), room.senderId]
        : item.read_by;
    await persist({
      items: fridge.items.map((i) =>
        i.id === item.id ? { ...i, status: nextStatus, read_by: readBy } : i,
      ),
    });
  }

  async function setHearts(item: FridgeItem, hearts: number) {
    await persist({
      items: fridge.items.map((i) => (i.id === item.id ? { ...i, hearts } : i)),
    });
  }

  const todo = fridge.items.filter((i) => i.status === "todo");
  const done = fridge.items.filter((i) => i.status === "done");
  const visible = view === "todo" ? todo : done;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border/20 shrink-0 space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bookshelf</p>
        <PinNotePanel />
      </div>

      {room.canPersist && (
        <div className="p-4 border-b border-border/15 shrink-0 space-y-3">
          <div className="flex gap-2">
            {KIND_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setKind(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs uppercase tracking-wider border transition",
                  kind === t.id
                    ? "border-rosegold/50 text-cream bg-rosegold/15"
                    : "border-border/25 text-muted-foreground hover:text-cream",
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => void addItem(e)} className="space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="bg-secondary/50 border-white/10"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={kind === "book" ? "Author" : "Label"}
                className="bg-secondary/50 border-white/10"
              />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Link"
                className="bg-secondary/50 border-white/10"
              />
            </div>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you'd like it"
              className="bg-secondary/50 border-white/10"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" className="rounded-full gap-1" disabled={!title.trim()}>
                <Plus className="w-4 h-4" />
                Add to shelf
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-4 px-4 pt-3 text-xs uppercase tracking-[0.16em] shrink-0">
        <button
          type="button"
          onClick={() => setView("todo")}
          className={cn(view === "todo" ? "text-cream border-b border-rosegold pb-1" : "text-muted-foreground")}
        >
          To read &amp; watch ({todo.length})
        </button>
        <button
          type="button"
          onClick={() => setView("done")}
          className={cn(view === "done" ? "text-cream border-b border-rosegold pb-1" : "text-muted-foreground")}
        >
          Done ({done.length})
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 font-serif italic">
            {view === "todo" ? "Nothing on the shelf yet." : "Nothing marked done yet."}
          </p>
        ) : (
          visible.map((item) => {
            const Icon = kindIcon(item.kind);
            const readByYou = item.read_by?.includes(room.senderId);
            return (
              <div
                key={item.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex gap-3"
              >
                <div className="shrink-0 h-10 w-10 rounded-lg bg-secondary/60 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-rosegold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-cream">{item.title}</p>
                      {item.note && (
                        <p className="text-sm text-muted-foreground italic mt-0.5">&ldquo;{item.note}&rdquo;</p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-rosegold/90 hover:underline mt-1 inline-block truncate max-w-full"
                        >
                          {item.url}
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleDone(item)}
                      className="shrink-0 text-muted-foreground hover:text-cream"
                      title={item.status === "todo" ? "Mark done" : "Move back"}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                      {readByYou || item.status === "done" ? "Read by you" : "On the list"}
                    </span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => void setHearts(item, n)}
                          className="p-0.5"
                          aria-label={`Rate ${n} hearts`}
                        >
                          <Heart
                            className={cn(
                              "w-3.5 h-3.5",
                              (item.hearts ?? 0) >= n
                                ? "fill-rosegold text-rosegold"
                                : "text-muted-foreground/40",
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
