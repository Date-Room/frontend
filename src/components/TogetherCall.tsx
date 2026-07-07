import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RoomVideo } from "@/components/RoomVideo";
import { cn } from "@/lib/utils";

type CallView = "pip" | "full" | "collapsed";

const PIP = { w: 160, h: 208 };
const BUBBLE = { w: 64, h: 64 };
const EDGE = 16;
const TOP_PAD = 72;
const BOTTOM_PAD = 24;

/**
 * Together-room call surface. Activities are the primary full-width surface;
 * the live call floats over them as a draggable PiP (default), expands to a
 * full-screen call with the activities docked at the bottom, or collapses to a
 * small bubble. A single <RoomVideo> stays mounted across all states so the
 * LiveKit connection never drops when toggling.
 */
export function TogetherCall({
  activityPanel,
  onLeave,
}: {
  activityPanel: ReactNode;
  onLeave: () => void;
}) {
  const [view, setView] = useState<CallView>("pip");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  const size = view === "collapsed" ? BUBBLE : PIP;

  // Default the floating window to the bottom-right corner.
  useEffect(() => {
    if (pos !== null) return;
    setPos({
      x: window.innerWidth - PIP.w - EDGE,
      y: window.innerHeight - PIP.h - BOTTOM_PAD,
    });
  }, [pos]);

  const clamp = useCallback(
    (x: number, y: number, w: number, h: number) => ({
      x: Math.min(Math.max(x, EDGE), window.innerWidth - w - EDGE),
      y: Math.min(Math.max(y, TOP_PAD), window.innerHeight - h - BOTTOM_PAD),
    }),
    [],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.current) return;
      drag.current.moved = true;
      const w = size.w;
      const h = size.h;
      setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy, w, h));
    },
    [clamp, size.w, size.h],
  );

  const onPointerUp = useCallback(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    const wasClick = drag.current && !drag.current.moved;
    drag.current = null;
    // Tap (no drag) on the collapsed bubble → restore to PiP.
    if (wasClick && view === "collapsed") {
      setView("pip");
      return;
    }
    // Snap to the nearest vertical edge.
    setPos((p) => {
      if (!p) return p;
      const w = size.w;
      const snapRight = p.x + w / 2 > window.innerWidth / 2;
      return { x: snapRight ? window.innerWidth - w - EDGE : EDGE, y: p.y };
    });
  }, [onPointerMove, size.w, view]);

  function startDrag(e: React.PointerEvent) {
    if (view === "full" || !pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const floating = view !== "full";

  return (
    <div className="relative flex-1 flex flex-col min-h-0 gap-3 p-3 sm:p-4">
      {/* Call — one mounted instance; wrapper re-flows between states. */}
      <div
        className={cn(
          "overflow-hidden",
          view === "full" && "relative w-full h-[56%] shrink-0 rounded-3xl glass",
          view === "pip" &&
            "fixed z-40 rounded-2xl glass p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.5)] touch-none cursor-grab active:cursor-grabbing",
          view === "collapsed" &&
            "fixed z-40 rounded-full glass shadow-[0_18px_48px_rgba(0,0,0,0.5)] touch-none cursor-grab active:cursor-grabbing",
        )}
        style={
          floating && pos
            ? { left: pos.x, top: pos.y, width: size.w, height: size.h }
            : undefined
        }
        onPointerDown={floating ? startDrag : undefined}
      >
        <RoomVideo
          variant={view === "full" ? "full" : "pip"}
          collapsed={view === "collapsed"}
          onLeave={onLeave}
          onExpand={() => setView("full")}
          onMinimize={() => setView("pip")}
          onCollapse={() => setView("collapsed")}
        />
      </div>

      {/* Activities — primary surface; shares space with the call in full mode. */}
      <section className="flex-1 min-h-0 flex flex-col rounded-3xl glass overflow-hidden">
        {activityPanel}
      </section>
    </div>
  );
}
