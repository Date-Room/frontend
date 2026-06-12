import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import {
  parseVisionBoard,
  type VisionBoardItem,
  type VisionBoardState,
} from "@/lib/roomWalls";
import { cn } from "@/lib/utils";

function nextZ(items: VisionBoardItem[]): number {
  return items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
}

/** Collage of shared dreams — images + captions on the room wall. */
export function VisionBoard() {
  const room = useRoomSession();
  const { session, state: durable } = useActivitySession("vision_board");

  const board = useMemo(() => parseVisionBoard(durable), [durable]);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [shape, setShape] = useState<"rect" | "circle">("rect");
  const [adding, setAdding] = useState(false);

  async function persist(next: VisionBoardState) {
    if (!session) return;
    await session.persist(next as unknown as Record<string, unknown>, {
      event_type: "vision_board_updated",
      payload: { item_count: next.items.length },
    });
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const url = imageUrl.trim();
    if (!url || !session) return;
    const items = [...board.items];
    const col = items.length % 3;
    const row = Math.floor(items.length / 3);
    items.push({
      id: crypto.randomUUID(),
      image_url: url,
      caption: caption.trim(),
      x: 4 + col * 30,
      y: 6 + row * 28,
      width: shape === "circle" ? 22 : 28,
      shape,
      z: nextZ(board.items),
    });
    await persist({ items });
    setImageUrl("");
    setCaption("");
    setAdding(false);
  }

  async function removeItem(id: string) {
    await persist({ items: board.items.filter((i) => i.id !== id) });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/20 shrink-0">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Vision Board
        </p>
        {room.canPersist && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-rosegold hover:text-cream"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {adding && room.canPersist && (
        <form onSubmit={(e) => void addItem(e)} className="p-4 border-b border-border/15 space-y-3 shrink-0">
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL…"
            className="bg-secondary/50 border-white/10"
          />
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption — what you're building toward"
            className="bg-secondary/50 border-white/10"
          />
          <div className="flex gap-2">
            {(["rect", "circle"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setShape(s)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs uppercase tracking-wider border transition",
                  shape === s
                    ? "border-rosegold/50 text-cream bg-rosegold/15"
                    : "border-border/30 text-muted-foreground",
                )}
              >
                {s === "rect" ? "Rectangle" : "Circle"}
              </button>
            ))}
          </div>
          <Button type="submit" className="rounded-full w-full" disabled={!imageUrl.trim()}>
            Pin to the board
          </Button>
        </form>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {board.items.length === 0 ? (
          <div className="h-full min-h-[240px] flex items-center justify-center text-center px-6">
            <p className="font-serif italic text-muted-foreground/80 text-lg">
              Add the first image of the life you&apos;re building.
            </p>
          </div>
        ) : (
          <div className="relative min-h-[420px] rounded-2xl bg-[#1A1410]/80 border border-white/[0.06]">
            {board.items
              .slice()
              .sort((a, b) => a.z - b.z)
              .map((item) => (
                <div
                  key={item.id}
                  className="absolute group"
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${item.width}%`,
                    zIndex: item.z,
                  }}
                >
                  <div
                    className={cn(
                      "overflow-hidden border-2 border-rosegold/35 shadow-lg bg-secondary/40",
                      item.shape === "circle" ? "rounded-full aspect-square" : "rounded-2xl aspect-[4/3]",
                    )}
                  >
                    <img
                      src={item.image_url}
                      alt={item.caption || "Vision"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {item.caption && (
                    <p className="mt-2 font-serif italic text-sm text-cream/85 text-center leading-snug px-1">
                      {item.caption}
                    </p>
                  )}
                  {room.canPersist && (
                    <button
                      type="button"
                      onClick={() => void removeItem(item.id)}
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition h-7 w-7 rounded-full bg-background/90 border border-border flex items-center justify-center"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
