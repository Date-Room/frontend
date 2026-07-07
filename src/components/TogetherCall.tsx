import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RoomVideo } from "@/components/RoomVideo";
import { cn } from "@/lib/utils";

const ASPECT = 16 / 9;
const MIN_W = 240;
const MAX_W = 620;
const EDGE = 12;
const TOP_PAD = 68;
const BOTTOM_PAD = 16;
const DEFAULT_W = 340;

type Corner = "tl" | "tr" | "bl" | "br";

/**
 * Together-room call surface. Activities are the primary canvas; the live call
 * floats over them as a draggable, aspect-locked PiP window that can be resized
 * from any corner (within min/max bounds). First step toward the free-floating
 * "desktop" window model for Our Room — a single always-mounted <RoomVideo> so
 * the LiveKit connection never drops.
 */
export function TogetherCall({
  activityPanel,
  onLeave,
}: {
  activityPanel: ReactNode;
  onLeave: () => void;
}) {
  const [w, setW] = useState(DEFAULT_W);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const h = Math.round(w / ASPECT);

  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ corner: Corner; startX: number; startW: number; startPos: { x: number; y: number } } | null>(null);

  const clampPos = useCallback(
    (x: number, y: number, width: number, height: number) => ({
      x: Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - width - EDGE)),
      y: Math.min(Math.max(y, TOP_PAD), Math.max(TOP_PAD, window.innerHeight - height - BOTTOM_PAD)),
    }),
    [],
  );

  // Default the window to the bottom-right corner.
  useEffect(() => {
    if (pos !== null) return;
    setPos({
      x: window.innerWidth - DEFAULT_W - EDGE,
      y: window.innerHeight - Math.round(DEFAULT_W / ASPECT) - BOTTOM_PAD,
    });
  }, [pos]);

  // ── Drag (move) ──
  const onDragMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.current) return;
      setPos(clampPos(e.clientX - drag.current.dx, e.clientY - drag.current.dy, w, h));
    },
    [clampPos, w, h],
  );
  const onDragUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
  }, [onDragMove]);

  function startDrag(e: React.PointerEvent) {
    if (!pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  }

  // ── Resize (corner, aspect-locked) ──
  const onResizeMove = useCallback(
    (e: PointerEvent) => {
      const r = resize.current;
      if (!r) return;
      const dx = e.clientX - r.startX;
      const left = r.corner === "tl" || r.corner === "bl";
      const top = r.corner === "tl" || r.corner === "tr";
      let newW = left ? r.startW - dx : r.startW + dx;
      newW = Math.min(MAX_W, Math.max(MIN_W, newW));
      const newH = Math.round(newW / ASPECT);
      const startH = Math.round(r.startW / ASPECT);
      // Keep the opposite corner pinned.
      const x = left ? r.startPos.x + (r.startW - newW) : r.startPos.x;
      const y = top ? r.startPos.y + (startH - newH) : r.startPos.y;
      setW(newW);
      setPos(clampPos(x, y, newW, newH));
    },
    [clampPos],
  );
  const onResizeUp = useCallback(() => {
    resize.current = null;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeUp);
  }, [onResizeMove]);

  function startResize(e: React.PointerEvent, corner: Corner) {
    e.stopPropagation();
    if (!pos) return;
    resize.current = { corner, startX: e.clientX, startW: w, startPos: pos };
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeUp);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragUp);
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", onResizeUp);
    };
  }, [onDragMove, onDragUp, onResizeMove, onResizeUp]);

  const handleClasses: Record<Corner, string> = {
    tl: "left-0 top-0 cursor-nwse-resize",
    tr: "right-0 top-0 cursor-nesw-resize",
    bl: "left-0 bottom-0 cursor-nesw-resize",
    br: "right-0 bottom-0 cursor-nwse-resize",
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 gap-3 p-3 sm:p-4">
      {/* Activities — primary canvas. */}
      <section className="flex-1 min-h-0 flex flex-col rounded-3xl glass overflow-hidden">
        {activityPanel}
      </section>

      {/* Call — draggable, aspect-locked, corner-resizable PiP window. */}
      <div
        className="fixed z-40 select-none rounded-2xl glass p-1 shadow-[0_20px_56px_rgba(0,0,0,0.55)] touch-none"
        style={pos ? { left: pos.x, top: pos.y, width: w, height: h } : undefined}
      >
        <div
          className="h-full w-full cursor-grab overflow-hidden rounded-xl active:cursor-grabbing"
          onPointerDown={startDrag}
        >
          <RoomVideo variant="pip" onLeave={onLeave} />
        </div>
        {(Object.keys(handleClasses) as Corner[]).map((corner) => (
          <div
            key={corner}
            onPointerDown={(e) => startResize(e, corner)}
            className={cn("absolute z-10 h-4 w-4", handleClasses[corner])}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
