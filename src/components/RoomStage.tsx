import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  RotateCw,
  LayoutGrid,
  X,
  Video,
  Sparkles,
  StickyNote,
  BookOpen,
  HelpCircle,
  ArrowLeftRight,
  Heart,
  Lightbulb,
  Dice5,
  PlayCircle,
  Headphones,
  MessageCircle,
  Home,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  Pin,
  type LucideIcon,
} from "lucide-react";
import { RoomVideo } from "@/components/RoomVideo";
import { useActivitySession } from "@/hooks/useActivitySession";
import {
  parseFridgeNotes,
  parseVisionBoard,
  pickVisionGradient,
  visionMediaType,
  type FridgeNote,
  type VisionBoardItem,
} from "@/lib/roomWalls";
import { cn } from "@/lib/utils";

/** Two-level launcher categories — mirrors the mobile activity menu.
 *  Single-item categories stage directly; multi-item ones drill in. */
const CATEGORIES: { id: string; label: string; icon: LucideIcon; itemIds: string[] }[] = [
  {
    id: "room",
    label: "Room",
    icon: Home,
    itemIds: ["vision_board", "fridge_notes", "bookshelf"],
  },
  {
    id: "games",
    label: "Games",
    icon: Gamepad2,
    itemIds: ["questions", "this_or_that", "the_36", "2_truths", "truth_or_dare"],
  },
  { id: "watch", label: "Watch", icon: PlayCircle, itemIds: ["watch"] },
  { id: "music", label: "DJ", icon: Headphones, itemIds: ["dj"] },
  { id: "chat", label: "Chat", icon: MessageCircle, itemIds: ["chat"] },
];

/** Lucide equivalents of the mobile activity-menu icons (Material) — keeps
 *  the two clients visually consistent (no ad-hoc emojis). */
const ITEM_ICONS: Record<string, LucideIcon> = {
  vision_board: Sparkles,
  fridge_notes: StickyNote,
  bookshelf: BookOpen,
  questions: HelpCircle,
  this_or_that: ArrowLeftRight,
  the_36: Heart,
  "2_truths": Lightbulb,
  truth_or_dare: Dice5,
  watch: PlayCircle,
  dj: Headphones,
  chat: MessageCircle,
};

/** One-line taglines for the drilled-in list rows — mirror the mobile menu. */
const ITEM_TAGLINES: Record<string, string> = {
  vision_board: "The life you're building.",
  fridge_notes: "Sticky notes for you two.",
  bookshelf: "Books, links, things to watch.",
  questions: "Pick 24, swap decks, take turns.",
  this_or_that: "Pick blind, reveal together.",
  the_36: "Three sets of twelve. Get closer.",
  "2_truths": "Spot the lie. Swap roles.",
  truth_or_dare: "Three cards each. Two skips.",
  watch: "Sync up something to watch.",
  dj: "Take turns picking the soundtrack.",
  chat: "Side chat while you play.",
};

export type StageItem = {
  id: string;
  title: string;
  icon: string;
  /** Walls (Vision Board / Fridge / Bookshelf) group first in the launcher. */
  isWall?: boolean;
};

const EDGE = 12;
const TOP_PAD = 68;
const BOTTOM_PAD = 96;
const PORTRAIT = { w: 336, h: 576 };
const LANDSCAPE = { w: 576, h: 336 };
/** Default size is the biggest; drag-resize shrinks down to 2/3 of it. */
const MIN_SCALE = 2 / 3;
type Corner = "nw" | "ne" | "sw" | "se";

/**
 * The Our Room "stage" — a Vision-Board-sized card that mounts the chosen
 * activity/wall, a dropup launcher (mobile activity-menu pattern) to swap it,
 * and a draggable call PiP (portrait by default, rotate toggle) shown only
 * while a call is active. The last thing staged persists per room.
 */
export function RoomStage({
  roomId,
  items,
  renderContent,
  partnerStatus,
  callActive,
  onCallIn,
  onLeaveCall,
}: {
  roomId: string;
  items: StageItem[];
  renderContent: (id: string) => ReactNode;
  partnerStatus: string;
  callActive: boolean;
  onCallIn: () => void;
  onLeaveCall: () => void;
}) {
  const fallback = items.find((i) => i.isWall)?.id ?? items[0]?.id ?? "";
  const [staged, setStaged] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`dr:stage:${roomId}`);
      return saved && items.some((i) => i.id === saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`dr:stage:${roomId}`, staged);
    } catch {
      /* ignore */
    }
  }, [roomId, staged]);

  // The staged item is shared server-side so both partners see the same thing
  // (and it persists after they both leave). localStorage is just a warm cache
  // for the first paint before the durable state hydrates.
  const { session: stageSession, state: stageState } = useActivitySession("room_stage");
  const serverStaged = typeof stageState?.staged === "string" ? stageState.staged : null;
  useEffect(() => {
    if (serverStaged && serverStaged !== staged && items.some((i) => i.id === serverStaged)) {
      setStaged(serverStaged);
    }
  }, [serverStaged, items, staged]);
  const commitStage = useCallback(
    (id: string) => {
      setStaged(id);
      if (!stageSession) return;
      void stageSession
        .persist({ staged: id }, { event_type: "stage_set", payload: { staged: id } })
        .catch(() => {
          /* stays on local state if the sync fails */
        });
    },
    [stageSession],
  );

  const [menuOpen, setMenuOpen] = useState(false);
  // Two-level launcher (mirrors mobile): null = category list, else drilled in.
  const [catId, setCatId] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(true);
  const [scale, setScale] = useState(1);
  const size = portrait ? PORTRAIT : LANDSCAPE;
  const curW = Math.round(size.w * scale);
  const curH = Math.round(size.h * scale);

  // Categories that actually have staged items available, each carrying its
  // resolved StageItem[] — mirrors the mobile activity menu groupings.
  const availCats = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        items: c.itemIds
          .map((id) => items.find((i) => i.id === id))
          .filter((i): i is StageItem => Boolean(i)),
      })).filter((c) => c.items.length > 0),
    [items],
  );
  const activeCat = catId ? availCats.find((c) => c.id === catId) ?? null : null;

  // Animate the tray's height as it opens and as it drills between levels.
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(0);
  useLayoutEffect(() => {
    if (menuOpen && panelRef.current) setPanelH(panelRef.current.scrollHeight);
  }, [menuOpen, catId, availCats]);

  function openMenu() {
    setCatId(null);
    setMenuOpen((v) => !v);
  }
  function pickCategory(c: (typeof availCats)[number]) {
    if (c.items.length === 1) {
      commitStage(c.items[0].id);
      setMenuOpen(false);
    } else {
      setCatId(c.id);
    }
  }
  function pickItem(id: string) {
    commitStage(id);
    setMenuOpen(false);
  }

  // ── Call PiP drag ──
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const clamp = useCallback(
    (x: number, y: number, w: number, h: number) => ({
      x: Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - w - EDGE)),
      y: Math.min(Math.max(y, TOP_PAD), Math.max(TOP_PAD, window.innerHeight - h - BOTTOM_PAD)),
    }),
    [],
  );
  useEffect(() => {
    if (pos !== null || !callActive) return;
    setPos({ x: window.innerWidth - PORTRAIT.w - EDGE, y: TOP_PAD + 8 });
  }, [pos, callActive]);
  const onMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.current) return;
      setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy, curW, curH));
    },
    [clamp, curW, curH],
  );
  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);
  function startDrag(e: React.PointerEvent) {
    if (!pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    },
    [onMove, onUp],
  );

  // ── Call PiP resize (aspect-locked; the opposite corner stays anchored) ──
  const resize = useRef<{ corner: Corner; fixedX: number; fixedY: number } | null>(null);
  const onResizeMove = useCallback(
    (e: PointerEvent) => {
      const r = resize.current;
      if (!r) return;
      // Width the pointer implies, measured from the anchored corner.
      const wantW = r.corner === "ne" || r.corner === "se" ? e.clientX - r.fixedX : r.fixedX - e.clientX;
      const nextScale = Math.min(1, Math.max(MIN_SCALE, wantW / size.w));
      const w = Math.round(size.w * nextScale);
      const h = Math.round(size.h * nextScale);
      const left = r.corner === "nw" || r.corner === "sw" ? r.fixedX - w : r.fixedX;
      const top = r.corner === "nw" || r.corner === "ne" ? r.fixedY - h : r.fixedY;
      setScale(nextScale);
      setPos(clamp(left, top, w, h));
    },
    [clamp, size.w, size.h],
  );
  const onResizeUp = useCallback(() => {
    resize.current = null;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeUp);
  }, [onResizeMove]);
  function startResize(corner: Corner) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      if (!pos) return;
      // Anchor the diagonally-opposite corner so it holds still while dragging.
      resize.current = {
        corner,
        fixedX: corner === "nw" || corner === "sw" ? pos.x + curW : pos.x,
        fixedY: corner === "nw" || corner === "ne" ? pos.y + curH : pos.y,
      };
      window.addEventListener("pointermove", onResizeMove);
      window.addEventListener("pointerup", onResizeUp);
    };
  }
  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", onResizeUp);
    },
    [onResizeMove, onResizeUp],
  );

  const stagedItem = items.find((i) => i.id === staged);

  // Vision items & fridge notes pinned to the room "pop out" of the stage as
  // draggable cards that float free of it.
  const { state: visionState } = useActivitySession("vision_board");
  const pinnedVisions = useMemo(
    () => parseVisionBoard(visionState).items.filter((i) => i.pinned),
    [visionState],
  );
  const { state: fridgeState } = useActivitySession("pinned_note");
  const pinnedNotes = useMemo(
    () => parseFridgeNotes(fridgeState).notes.filter((n) => n.stage_pinned),
    [fridgeState],
  );

  return (
    <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-2 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {/* Status bar — partner presence + call. */}
        <div className="perm-status-bar">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_10px_rgba(232,166,83,0.65)]" />
            <p className="truncate text-sm text-cream/80">{partnerStatus}</p>
          </div>
          {!callActive && (
            <button type="button" onClick={onCallIn} className="perm-call-btn shrink-0">
              <Video className="h-4 w-4" />
              Call them in
            </button>
          )}
        </div>

        {/* Stage — Vision-Board-sized card that mounts the chosen activity. */}
        <section className="perm-wall-frame flex flex-col overflow-hidden !p-0">
          <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
            {stagedItem &&
              (() => {
                const Icon = ITEM_ICONS[stagedItem.id] ?? LayoutGrid;
                return <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />;
              })()}
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-cream/80">
              {stagedItem?.title ?? "Stage"}
            </span>
          </div>
          <div className="h-[clamp(400px,58vh,680px)] min-h-0 overflow-hidden">
            {staged ? renderContent(staged) : null}
          </div>
        </section>

      </div>

      {/* Launcher — fixed dock at the bottom of the screen; animated dropup. */}
      {menuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden />
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
        <div className="relative">
          <div
            className={cn(
              "absolute bottom-full left-1/2 mb-3 w-[min(26rem,92vw)] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/10 bg-card/90 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-300 ease-out",
              menuOpen
                ? "pointer-events-auto translate-y-0 opacity-100"
                : "pointer-events-none translate-y-3 opacity-0",
            )}
            style={{ height: menuOpen ? panelH : 0 }}
          >
            <div ref={panelRef} className="p-3.5">
              {activeCat ? (
                /* Level 2 — the category's activities as a list (mobile style). */
                <>
                  <button
                    type="button"
                    onClick={() => setCatId(null)}
                    className="mb-2.5 -ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition hover:text-cream"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {activeCat.label}
                  </button>
                  <div className="flex flex-col gap-1.5">
                    {activeCat.items.map((it) => (
                      <MenuListRow
                        key={it.id}
                        Icon={ITEM_ICONS[it.id] ?? LayoutGrid}
                        label={it.title}
                        tagline={ITEM_TAGLINES[it.id]}
                        active={staged === it.id}
                        onClick={() => pickItem(it.id)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                /* Level 1 — categories (Room / Games / Watch / DJ / Chat),
                   centered squircle tiles. */
                <div className="flex flex-wrap justify-center gap-2.5">
                  {availCats.map((c) => (
                    <MenuTile
                      key={c.id}
                      Icon={c.icon}
                      label={c.label}
                      active={c.items.some((i) => i.id === staged)}
                      badge={c.items.length > 1 ? c.items.length : undefined}
                      onClick={() => pickCategory(c)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={openMenu}
            className="focus-ring pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-card/85 px-5 py-2.5 text-sm font-medium text-cream shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition hover:border-primary/30"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4 text-primary" />}
            {menuOpen ? "Close" : "Activities"}
          </button>
        </div>
      </div>

      {/* Pinned vision cards & fridge notes — floated around the room, freely
          draggable, popped out of the stage. */}
      {pinnedVisions.map((item, i) => (
        <PinnedVisionCard key={item.id} roomId={roomId} item={item} index={i} />
      ))}
      {pinnedNotes.map((note, i) => (
        <PinnedNoteCard key={note.id} roomId={roomId} note={note} index={i} />
      ))}

      {/* Call PiP — portrait by default, rotate to landscape, draggable,
          and edge-resizable (aspect-locked) between full and 2/3 size. */}
      {callActive && (
        <div
          className="fixed z-40 select-none rounded-2xl glass p-1 shadow-[0_20px_56px_rgba(0,0,0,0.55)] touch-none"
          style={pos ? { left: pos.x, top: pos.y, width: curW, height: curH } : undefined}
        >
          <div
            className="h-full w-full cursor-grab overflow-hidden rounded-xl active:cursor-grabbing"
            onPointerDown={startDrag}
          >
            <RoomVideo variant="pip" onLeave={onLeaveCall} />
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPortrait((v) => !v)}
            aria-label="Rotate call"
            className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-cream backdrop-blur transition hover:bg-black/70"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          {/* Corner resize handles — anchored to the opposite corner. */}
          {(["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
            <span
              key={corner}
              onPointerDown={startResize(corner)}
              className={cn(
                "absolute z-10 h-5 w-5",
                corner === "nw" && "left-0 top-0 cursor-nwse-resize",
                corner === "ne" && "right-0 top-0 cursor-nesw-resize",
                corner === "sw" && "bottom-0 left-0 cursor-nesw-resize",
                corner === "se" && "bottom-0 right-0 cursor-nwse-resize",
              )}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function MenuTile({
  Icon,
  label,
  active,
  badge,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="group flex w-[3.5rem] flex-col items-center gap-1.5"
    >
      {/* iOS-home-screen squircle app icon — uniform amber gradient + a single
          dark lucide icon (matches the mobile menu; no multicolor emoji). */}
      <span
        className={cn(
          "relative flex aspect-square w-full items-center justify-center rounded-[26%] bg-gradient-to-br from-primary/90 to-primary/60 shadow-[0_4px_12px_rgba(232,166,83,0.3)] transition duration-150 group-hover:brightness-110 group-active:scale-90",
          active && "ring-2 ring-cream/85 ring-offset-2 ring-offset-card",
        )}
      >
        <Icon className="h-[42%] w-[42%] text-[#1a1207]" strokeWidth={2.25} aria-hidden />
        {badge ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-card px-1 text-[9px] font-semibold text-cream ring-1 ring-white/15">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate text-[10px] font-medium text-cream/70">{label}</span>
    </button>
  );
}

/** A drilled-in activity as a list row — icon chip + title + tagline + chevron,
 *  mirroring the mobile category list. */
function MenuListRow({
  Icon,
  label,
  tagline,
  active,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  tagline?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-2.5 text-left transition",
        active
          ? "border-primary/40 bg-primary/[0.08]"
          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
        <Icon className="h-[18px] w-[18px] text-primary" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-cream">{label}</span>
        {tagline ? (
          <span className="block truncate text-[11px] text-muted-foreground">{tagline}</span>
        ) : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

const PIN_W = 148;
const PIN_H = 188;

/** A vision item pinned to the room — a small polaroid-ish card that floats
 *  free of the stage and can be dragged anywhere. Position persists locally. */
function PinnedVisionCard({
  roomId,
  item,
  index,
}: {
  roomId: string;
  item: VisionBoardItem;
  index: number;
}) {
  const key = `dr:pincard:${roomId}:${item.id}`;
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved) as { x: number; y: number };
    } catch {
      /* ignore */
    }
    return { x: EDGE + index * 18, y: TOP_PAD + 8 + index * (PIN_H + 14) };
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - PIN_W - EDGE)),
    y: Math.min(Math.max(y, TOP_PAD), Math.max(TOP_PAD, window.innerHeight - PIN_H - BOTTOM_PAD)),
  });
  const onMove = useCallback((e: PointerEvent) => {
    if (!drag.current) return;
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  }, []);
  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [key, pos]);
  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    },
    [onMove, onUp],
  );
  function startDrag(e: React.PointerEvent) {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const media = visionMediaType(item);
  const gradient = item.gradient ?? pickVisionGradient(item.caption || item.id);
  const showImage = media === "image" && item.image_url.trim();
  const label = item.caption || item.filename || (media === "pdf" ? "Document" : "Dream");

  return (
    <div
      onPointerDown={startDrag}
      style={{ left: pos.x, top: pos.y, width: PIN_W }}
      className="fixed z-30 cursor-grab touch-none select-none rounded-2xl border border-white/15 bg-[#141019]/90 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-md transition active:cursor-grabbing"
    >
      <div className="relative overflow-hidden rounded-xl" style={{ height: PIN_H - 52 }}>
        {showImage ? (
          <img
            src={item.image_url}
            alt={label}
            className="h-full w-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
            {media === "pdf" && (
              <span className="rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber">
                PDF
              </span>
            )}
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[#1a1207] shadow">
          <Pin className="h-3 w-3 fill-current" />
        </span>
      </div>
      <p className="truncate px-0.5 pt-1.5 text-center text-xs font-medium text-cream/90">{label}</p>
    </div>
  );
}

const NOTE_SIZE = 172;
const STICKY_PALETTE = [
  "linear-gradient(168deg, #fffef5 0%, #fef08a 48%, #fde047 100%)",
  "linear-gradient(168deg, #fff8fb 0%, #fbcfe8 50%, #f9a8d4 100%)",
  "linear-gradient(168deg, #f7fdf9 0%, #bbf7d0 50%, #86efac 100%)",
  "linear-gradient(168deg, #f8fbff 0%, #bfdbfe 50%, #93c5fd 100%)",
];

function stickyHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A fridge note stuck to the room — a draggable paper sticky that floats free
 *  of the stage. Position persists locally. */
function PinnedNoteCard({
  roomId,
  note,
  index,
}: {
  roomId: string;
  note: FridgeNote;
  index: number;
}) {
  const key = `dr:pinnote:${roomId}:${note.id}`;
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved) as { x: number; y: number };
    } catch {
      /* ignore */
    }
    return {
      x: Math.max(EDGE, window.innerWidth - NOTE_SIZE - EDGE - index * 18),
      y: TOP_PAD + 8 + index * (NOTE_SIZE + 14),
    };
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - NOTE_SIZE - EDGE)),
    y: Math.min(Math.max(y, TOP_PAD), Math.max(TOP_PAD, window.innerHeight - NOTE_SIZE - BOTTOM_PAD)),
  });
  const onMove = useCallback((e: PointerEvent) => {
    if (!drag.current) return;
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  }, []);
  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [key, pos]);
  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    },
    [onMove, onUp],
  );
  function startDrag(e: React.PointerEvent) {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const hash = stickyHash(note.id);
  const rot = ((hash % 5) - 2) * 1.1;

  return (
    <div
      onPointerDown={startDrag}
      style={{
        left: pos.x,
        top: pos.y,
        width: NOTE_SIZE,
        height: NOTE_SIZE,
        transform: `rotate(${rot}deg)`,
        background: STICKY_PALETTE[hash % STICKY_PALETTE.length],
      }}
      className="fixed z-30 flex cursor-grab touch-none select-none flex-col rounded-[6px] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] active:cursor-grabbing"
    >
      <span className="absolute -top-1.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-[#1a1207] shadow">
        <Pin className="h-3 w-3 fill-current" />
      </span>
      <p className="mt-1 flex-1 overflow-hidden whitespace-pre-wrap break-words text-[13px] leading-snug text-[#2a2018] line-clamp-6">
        {note.text}
      </p>
      <p className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-[#2a2018]/55">
        {note.pinned_by_name || "Someone"}
      </p>
    </div>
  );
}
