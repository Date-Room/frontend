import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X, Maximize2, Sparkles, Plus } from "lucide-react";
import { RoomVideo } from "@/components/RoomVideo";
import { cn } from "@/lib/utils";

/** One thing that can live on the canvas — an activity, a wall, or the call. */
export type CanvasItem = {
  id: string;
  title: string;
  /** Emoji shown in the launcher + window title. */
  icon: string;
  /** Walls (Vision Board / Fridge / Bookshelf) sort first in the launcher. */
  isWall?: boolean;
};

type Geom = { x: number; y: number; w: number; h: number };
type WinState = Geom & { z: number };

const CALL_ID = "call";
const CALL_ASPECT = 16 / 9;
const MIN_W = 240;
const MIN_H = 180;
const EDGE = 12;
const TOP_PAD = 8;
const BOTTOM_PAD = 84; // clear the launcher bar

type Corner = "tl" | "tr" | "bl" | "br";
const CORNER_CLASS: Record<Corner, string> = {
  tl: "left-0 top-0 cursor-nwse-resize",
  tr: "right-0 top-0 cursor-nesw-resize",
  bl: "left-0 bottom-0 cursor-nesw-resize",
  br: "right-0 bottom-0 cursor-nwse-resize",
};

type Persisted = { open: string[]; geom: Record<string, Geom> };

function loadLayout(roomId: string): Persisted | null {
  try {
    const raw = localStorage.getItem(`dr:canvas:${roomId}`);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}
function saveLayout(roomId: string, data: Persisted) {
  try {
    localStorage.setItem(`dr:canvas:${roomId}`, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * Free-floating window desktop for the Our Room. Activities/walls open as
 * draggable, resizable windows; the call is a window too. Layout persists
 * per room in localStorage (server-shared sync is a later phase). Falls back
 * to a stacked single-column layout on narrow screens.
 */
export function RoomCanvas({
  roomId,
  items,
  renderContent,
  onLeave,
}: {
  roomId: string;
  items: CanvasItem[];
  renderContent: (id: string) => ReactNode;
  onLeave: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const itemById = useMemo(() => {
    const m: Record<string, CanvasItem> = {};
    for (const it of items) m[it.id] = it;
    return m;
  }, [items]);

  // ── Window state ──
  const [wins, setWins] = useState<Record<string, WinState>>({});
  const [zTop, setZTop] = useState(10);
  const hydrated = useRef(false);

  // Hydrate from saved layout (or sensible defaults) once.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadLayout(roomId);
    const vw = window.innerWidth;
    const next: Record<string, WinState> = {};
    let z = 10;
    const openIds = saved?.open?.length
      ? saved.open
      : [CALL_ID, items.find((i) => i.isWall)?.id].filter(Boolean) as string[];
    for (const id of openIds) {
      const g = saved?.geom?.[id];
      if (g) {
        next[id] = { ...g, z: z++ };
      } else if (id === CALL_ID) {
        const w = 340;
        next[id] = { x: vw - w - EDGE, y: 420, w, h: Math.round(w / CALL_ASPECT), z: z++ };
      } else {
        next[id] = { x: 40 + z * 8, y: 40 + z * 8, w: 520, h: 420, z: z++ };
      }
    }
    setWins(next);
    setZTop(z);
  }, [roomId, items]);

  // Persist on change.
  useEffect(() => {
    if (!hydrated.current) return;
    const open = Object.keys(wins).sort((a, b) => wins[a].z - wins[b].z);
    const geom: Record<string, Geom> = {};
    for (const id of open) {
      const { x, y, w, h } = wins[id];
      geom[id] = { x, y, w, h };
    }
    saveLayout(roomId, { open, geom });
  }, [roomId, wins]);

  const clamp = useCallback((x: number, y: number, w: number, h: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.min(Math.max(x, EDGE), Math.max(EDGE, vw - w - EDGE)),
      y: Math.min(Math.max(y, TOP_PAD), Math.max(TOP_PAD, vh - h - BOTTOM_PAD)),
    };
  }, []);

  const focus = useCallback((id: string) => {
    setWins((prev) => {
      if (!prev[id]) return prev;
      const nz = zTop + 1;
      setZTop(nz);
      return { ...prev, [id]: { ...prev[id], z: nz } };
    });
  }, [zTop]);

  const open = useCallback(
    (id: string) => {
      setWins((prev) => {
        if (prev[id]) {
          const nz = zTop + 1;
          setZTop(nz);
          return { ...prev, [id]: { ...prev[id], z: nz } };
        }
        const isCall = id === CALL_ID;
        const w = isCall ? 340 : 520;
        const h = isCall ? Math.round(w / CALL_ASPECT) : 420;
        const nz = zTop + 1;
        setZTop(nz);
        const p = clamp(80 + (nz % 6) * 24, 60 + (nz % 6) * 24, w, h);
        return { ...prev, [id]: { x: p.x, y: p.y, w, h, z: nz } };
      });
    },
    [zTop, clamp],
  );

  const close = useCallback(
    (id: string) => {
      if (id === CALL_ID) {
        onLeave();
        return;
      }
      setWins((prev) => {
        const { [id]: _gone, ...rest } = prev;
        return rest;
      });
    },
    [onLeave],
  );

  // ── Drag / resize gestures ──
  const gesture = useRef<
    | { id: string; kind: "drag"; dx: number; dy: number }
    | { id: string; kind: "resize"; corner: Corner; sx: number; sy: number; g: Geom; aspect: boolean }
    | null
  >(null);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      setWins((prev) => {
        const win = prev[g.id];
        if (!win) return prev;
        if (g.kind === "drag") {
          const p = clamp(e.clientX - g.dx, e.clientY - g.dy, win.w, win.h);
          return { ...prev, [g.id]: { ...win, x: p.x, y: p.y } };
        }
        // resize
        const dx = e.clientX - g.sx;
        const dy = e.clientY - g.sy;
        const left = g.corner === "tl" || g.corner === "bl";
        const top = g.corner === "tl" || g.corner === "tr";
        let w = left ? g.g.w - dx : g.g.w + dx;
        w = Math.min(window.innerWidth - 2 * EDGE, Math.max(MIN_W, w));
        let h: number;
        if (g.aspect) {
          h = Math.round(w / CALL_ASPECT);
        } else {
          h = top ? g.g.h - dy : g.g.h + dy;
          h = Math.min(window.innerHeight - TOP_PAD - BOTTOM_PAD, Math.max(MIN_H, h));
        }
        const x = left ? g.g.x + (g.g.w - w) : g.g.x;
        const y = top ? g.g.y + (g.g.h - h) : g.g.y;
        const p = clamp(x, y, w, h);
        return { ...prev, [g.id]: { ...win, x: p.x, y: p.y, w, h } };
      });
    },
    [clamp],
  );
  const onPointerUp = useCallback(() => {
    gesture.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);
  const arm = useCallback(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, [onPointerMove, onPointerUp]);

  function startDrag(e: React.PointerEvent, id: string) {
    const win = wins[id];
    if (!win) return;
    focus(id);
    gesture.current = { id, kind: "drag", dx: e.clientX - win.x, dy: e.clientY - win.y };
    arm();
  }
  function startResize(e: React.PointerEvent, id: string, corner: Corner) {
    e.stopPropagation();
    const win = wins[id];
    if (!win) return;
    focus(id);
    gesture.current = {
      id,
      kind: "resize",
      corner,
      sx: e.clientX,
      sy: e.clientY,
      g: { x: win.x, y: win.y, w: win.w, h: win.h },
      aspect: id === CALL_ID,
    };
    arm();
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  function fullscreen(id: string) {
    const el = document.getElementById(`canvas-win-${id}`);
    el?.requestFullscreen?.().catch(() => {});
  }

  const openIds = Object.keys(wins);
  const launcherItems = items.filter((it) => !openIds.includes(it.id));

  // ── Narrow fallback: stacked single-column (no windowing) ──
  if (!isDesktop) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto p-3">
        <div className="rounded-2xl glass p-1.5">
          <div className="mx-auto aspect-video max-w-sm overflow-hidden rounded-xl">
            <RoomVideo variant="pip" onLeave={onLeave} />
          </div>
        </div>
        {items.map((it) => (
          <details key={it.id} className="rounded-2xl glass overflow-hidden" open={it.isWall}>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-cream">
              <span>{it.icon}</span> {it.title}
            </summary>
            <div className="h-[70vh] min-h-0">{renderContent(it.id)}</div>
          </details>
        ))}
      </div>
    );
  }

  return (
    <div ref={canvasRef} className="relative flex-1 min-h-0 overflow-hidden">
      {openIds
        .sort((a, b) => wins[a].z - wins[b].z)
        .map((id) => {
          const win = wins[id];
          const isCall = id === CALL_ID;
          const meta = isCall
            ? { title: "Call", icon: "📹" }
            : itemById[id] ?? { title: id, icon: "•" };
          return (
            <div
              key={id}
              id={`canvas-win-${id}`}
              onPointerDown={() => focus(id)}
              className="absolute flex flex-col overflow-hidden rounded-2xl glass shadow-[0_20px_56px_rgba(0,0,0,0.5)]"
              style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
            >
              {/* Title bar */}
              <div
                onPointerDown={(e) => startDrag(e, id)}
                className="flex shrink-0 cursor-grab items-center gap-2 border-b border-white/[0.06] px-3 py-2 active:cursor-grabbing"
              >
                <span className="text-sm" aria-hidden>{meta.icon}</span>
                <span className="flex-1 truncate text-xs font-medium uppercase tracking-[0.16em] text-cream/80">
                  {meta.title}
                </span>
                {!isCall && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => fullscreen(id)}
                    aria-label="Full screen"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-cream"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => close(id)}
                  aria-label={isCall ? "Leave call" : "Close"}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/70 hover:text-cream"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Body */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {isCall ? <RoomVideo variant="pip" onLeave={onLeave} /> : renderContent(id)}
              </div>
              {/* Corner resize handles */}
              {(Object.keys(CORNER_CLASS) as Corner[]).map((c) => (
                <div
                  key={c}
                  onPointerDown={(e) => startResize(e, id, c)}
                  className={cn("absolute z-10 h-4 w-4", CORNER_CLASS[c])}
                  aria-hidden
                />
              ))}
            </div>
          );
        })}

      {/* Suggester / launcher — Siri-style bar of things you can open. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[999] flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-card/80 px-2.5 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
            <Sparkles className="h-4 w-4" />
          </span>
          {launcherItems.length === 0 ? (
            <span className="px-2 text-xs text-muted-foreground">Everything&apos;s open</span>
          ) : (
            launcherItems.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => open(it.id)}
                title={`Open ${it.title}`}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-cream/80 transition hover:bg-white/10 hover:text-cream"
              >
                <span aria-hidden>{it.icon}</span>
                <span className="whitespace-nowrap">{it.title}</span>
              </button>
            ))
          )}
          {!openIds.includes(CALL_ID) && (
            <button
              type="button"
              onClick={() => open(CALL_ID)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/25 transition hover:bg-primary/25"
            >
              <Plus className="h-3.5 w-3.5" /> Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
