import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  DoorOpen,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  Pin,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { RoomVideo } from "@/components/RoomVideo";
import { ActivityHelp, hasActivityHelp } from "@/components/ActivityHelp";
import { MusicPlayerBar, MusicRoomProvider } from "@/components/MusicRoom";
import { ActivityBoundary } from "@/components/RoomErrorBoundary";
import { useRoomSession } from "@/context/RoomSessionContext";
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
    icon: DoorOpen,
    itemIds: ["vision_board", "fridge_notes", "bookshelf", "room_details"],
  },
  {
    id: "games",
    label: "Games",
    icon: Gamepad2,
    itemIds: ["questions", "this_or_that", "the_36", "2_truths", "truth_or_dare"],
  },
  { id: "watch", label: "Watch", icon: PlayCircle, itemIds: ["watch"] },
  { id: "music", label: "Music", icon: Headphones, itemIds: ["dj"] },
  { id: "chat", label: "Chat", icon: MessageCircle, itemIds: ["chat"] },
];

/** Partner-action → notifier copy + which stage item to open. Maps the raw
 *  activity_id (as broadcast) to a friendly line and the stage target. */
const NOTIF: Record<string, { verb: string; target: string }> = {
  chat: { verb: "sent a message", target: "chat" },
  dj: { verb: "played a song", target: "dj" },
  watch: { verb: "started a video", target: "watch" },
  vision_board: { verb: "added a dream", target: "vision_board" },
  pinned_note: { verb: "left a note", target: "fridge_notes" },
  bookshelf: { verb: "added to the shelf", target: "bookshelf" },
  // Bookshelf persists under the legacy activity_id "fridge".
  fridge: { verb: "added to the shelf", target: "bookshelf" },
  questions: { verb: "is playing Questions", target: "questions" },
  this_or_that: { verb: "is playing This or That", target: "this_or_that" },
  the_36: { verb: "is playing The 36", target: "the_36" },
  "2_truths": { verb: "is playing Two Truths", target: "2_truths" },
  truth_or_dare: { verb: "is playing Truth or Dare", target: "truth_or_dare" },
};
/** Chatty sync events that shouldn't pop a notification. */
const NOTIF_NOISY = new Set(["tick", "seek", "cursor", "typing", "presence", "pause"]);

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
  room_details: Settings,
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
  room_details: "Invite, theme & background.",
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
  partnerName = "Your partner",
  partnerInRoom = false,
  partnerInCall = false,
  partnerPresent = false,
  callActive,
  onCallIn,
  onLeaveCall,
}: {
  roomId: string;
  items: StageItem[];
  renderContent: (id: string) => ReactNode;
  partnerStatus: string;
  partnerName?: string;
  partnerInRoom?: boolean;
  partnerInCall?: boolean;
  partnerPresent?: boolean;
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

  // Each person browses activities on their own — the staged item is local
  // (cached per room in localStorage), NOT shared. Partner actions surface via
  // the notifier on the Activities button instead.
  const commitStage = useCallback((id: string) => setStaged(id), []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Two-level launcher (mirrors mobile): null = category list, else drilled in.
  const [catId, setCatId] = useState<string | null>(null);

  // Dynamic-island notifier: partner actions expand the Activities button into
  // a tappable notice for ~3s, then it settles back. (Activities are per-user,
  // so this is how you learn your partner did something.)
  const room = useRoomSession();
  const [notif, setNotif] = useState<{ id: number; text: string; target: string } | null>(null);
  const notifTimer = useRef<number | undefined>(undefined);
  // Ids removed via the delete broadcast — dropped from pinned cards instantly.
  const [removedVisionIds, setRemovedVisionIds] = useState<Set<string>>(() => new Set());
  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  useEffect(() => {
    const off = room.channel.onBroadcast((e) => {
      if (e.kind === "vision_removed") {
        const id = (e.payload as { id?: string }).id;
        if (id) setRemovedVisionIds((prev) => new Set(prev).add(id));
        return;
      }
      if (e.kind !== "activity") return;
      const d = e.payload as { activity_id?: string; type?: string; user_id?: string };
      if (!d.activity_id || d.user_id === room.senderId) return;
      if (d.type && NOTIF_NOISY.has(d.type)) return;
      const meta = NOTIF[d.activity_id];
      if (!meta) return;
      // Already viewing that activity — no need to nudge me to open it.
      if (meta.target === stagedRef.current) return;
      setNotif({ id: Date.now(), text: `${partnerName} ${meta.verb}`, target: meta.target });
      window.clearTimeout(notifTimer.current);
      notifTimer.current = window.setTimeout(() => setNotif(null), 3400);
    });
    return () => {
      off();
      window.clearTimeout(notifTimer.current);
    };
  }, [room.channel, room.senderId, partnerName]);
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

  // ── Call PiP ↔ Watch-fullscreen bridge ──
  // When Watch enters native fullscreen, the browser only paints the fullscreen
  // element's own subtree — so the call PiP would disappear. We re-parent the
  // live PiP into the fullscreen element (marked `data-dr-watch-fs`) so it
  // floats on top of the fullscreen video, and move it back on exit. The PiP is
  // portalled into a persistent, hand-managed host node (NOT reconciled by
  // React), so moving that node never remounts LiveKit — the <video> tracks
  // keep playing across the move (unlike an <iframe>, a <video> survives
  // re-parenting).
  const pipHostRef = useRef<HTMLDivElement | null>(null);
  if (!pipHostRef.current && typeof document !== "undefined") {
    pipHostRef.current = document.createElement("div");
    pipHostRef.current.style.display = "contents";
  }
  const pipAnchorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = pipHostRef.current;
    const anchor = pipAnchorRef.current;
    if (!host || !anchor) return;
    const place = () => {
      const fsEl = document.fullscreenElement as HTMLElement | null;
      const target = fsEl?.getAttribute("data-dr-watch-fs") === "1" ? fsEl : anchor;
      if (host.parentElement !== target) target.appendChild(host);
    };
    place();
    document.addEventListener("fullscreenchange", place);
    return () => {
      document.removeEventListener("fullscreenchange", place);
      host.remove();
    };
  }, []);
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
    () => parseVisionBoard(visionState).items.filter((i) => i.pinned && !removedVisionIds.has(i.id)),
    [visionState, removedVisionIds],
  );
  const { state: fridgeState } = useActivitySession("pinned_note");
  const pinnedNotes = useMemo(
    () => parseFridgeNotes(fridgeState).notes.filter((n) => n.stage_pinned),
    [fridgeState],
  );
  // Whether the bottom music bar is showing, so the launcher lifts above it.
  const { state: djState } = useActivitySession("dj");
  const musicActive =
    djState?.closed !== true &&
    (Boolean(djState?.now_playing) || (Array.isArray(djState?.queue) && djState.queue.length > 0));
  // Watch shows its own bottom bar while it's staged with a video.
  const { state: watchState } = useActivitySession("watch");
  const bottomBarActive = musicActive || (staged === "watch" && Boolean(watchState?.video_id));

  return (
    <MusicRoomProvider watchActive={staged === "watch"}>
    <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-2 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {/* Call initiator (mobile-style): a full-width CTA whose title reflects
            whether the partner's already here, with their status underneath.
            While a call is live it collapses to a slim presence bar. */}
        {callActive ? (
          <div className="perm-status-bar">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  partnerInCall
                    ? "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.65)]"
                    : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse",
                )}
              />
              <p className="truncate text-sm text-cream/80">
                {partnerInCall ? `${partnerName} is in the call` : `Ringing ${partnerName}…`}
              </p>
            </div>
          </div>
        ) : (
          (() => {
            const title = partnerInCall
              ? "Join the call"
              : partnerInRoom
                ? "Invite them to the call"
                : "Start the call";
            const sub = partnerInCall
              ? `${partnerName} is in the call`
              : partnerInRoom
                ? `${partnerName} is in the room`
                : `${partnerName} isn't in yet`;
            return (
              <button
                type="button"
                onClick={onCallIn}
                className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-cream backdrop-blur-md transition hover:border-primary/30 hover:bg-white/[0.07] active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Video className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">{title}</span>
                  <span className="block truncate text-xs leading-tight text-muted-foreground">{sub}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>
            );
          })()
        )}

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
            {staged && hasActivityHelp(staged) && (
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label="How this works"
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-cream"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <div
            key={staged}
            className="animate-stage-swell h-[clamp(400px,58vh,680px)] min-h-0 overflow-hidden"
          >
            {staged ? (
              <ActivityBoundary label={stagedItem?.title} resetKey={staged}>
                {renderContent(staged)}
              </ActivityBoundary>
            ) : null}
          </div>
        </section>

      </div>

      {/* Launcher — fixed dock at the bottom of the screen; animated dropup. */}
      {menuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden />
      )}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 transition-[bottom] duration-300",
          bottomBarActive ? "bottom-[80px]" : "bottom-4",
        )}
      >
        <div className="relative">
          <div
            className={cn(
              "absolute bottom-full left-1/2 mb-3 w-[min(26rem,92vw)] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/10 bg-card/90 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-300 ease-out",
              menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            )}
            style={{ height: menuOpen ? panelH : 0 }}
          >
            {/* Content scales up from the bottom as the tray grows, so the
                whole menu (icons included) opens as one motion. */}
            <div
              ref={panelRef}
              className={cn(
                "origin-bottom p-3.5 transition-transform duration-300 ease-out",
                menuOpen ? "scale-100" : "scale-90",
              )}
            >
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
          {(() => {
            const showNotif = notif && !menuOpen;
            const NotifIcon = showNotif ? ITEM_ICONS[notif.target] ?? LayoutGrid : LayoutGrid;
            return (
              <button
                type="button"
                onClick={
                  showNotif
                    ? () => {
                        commitStage(notif.target);
                        setNotif(null);
                      }
                    : openMenu
                }
                className={cn(
                  "focus-ring pointer-events-auto flex max-w-[80vw] items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium text-cream shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300",
                  showNotif
                    ? "border-primary/40 bg-primary/20"
                    : "border-white/10 bg-card/85 hover:border-primary/30",
                )}
              >
                {showNotif ? (
                  <NotifIcon className="h-4 w-4 shrink-0 text-primary" />
                ) : menuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <LayoutGrid className="h-4 w-4 text-primary" />
                )}
                <span key={showNotif ? notif.id : menuOpen ? "close" : "activities"} className="animate-fade-in truncate">
                  {showNotif ? notif.text : menuOpen ? "Close" : "Activities"}
                </span>
              </button>
            );
          })()}
        </div>
      </div>

      {/* Full-width music player, pinned to the very bottom under the tray. */}
      <MusicPlayerBar onOpenList={() => commitStage("dj")} />

      {/* Pinned vision cards & fridge notes — floated around the room, freely
          draggable, popped out of the stage. */}
      {pinnedVisions.map((item, i) => (
        <PinnedVisionCard key={item.id} roomId={roomId} item={item} index={i} />
      ))}
      {pinnedNotes.map((note, i) => (
        <PinnedNoteCard key={note.id} roomId={roomId} note={note} index={i} />
      ))}

      {/* Call PiP — portrait by default, rotate to landscape, draggable,
          and edge-resizable (aspect-locked) between full and 2/3 size.
          Rendered into a persistent host (see pipHostRef) so it can be
          re-parented into the Watch fullscreen layer without remounting the
          call. The anchor marks its normal home in the room. */}
      <div ref={pipAnchorRef} className="contents" />
      {callActive &&
        pipHostRef.current &&
        createPortal(
        <div
          className="group fixed z-40 select-none rounded-2xl glass p-1 shadow-[0_20px_56px_rgba(0,0,0,0.55)] touch-none"
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
            className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-cream opacity-0 backdrop-blur transition duration-200 hover:bg-black/70 group-hover:opacity-100"
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
        </div>,
          pipHostRef.current,
        )}

      {helpOpen && staged && <ActivityHelp id={staged} onClose={() => setHelpOpen(false)} />}
    </main>
    </MusicRoomProvider>
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
      {/* iOS-home-screen squircle app icon — flat solid fill + a single dark
          lucide icon (matches the mobile menu; no gradient/glow). */}
      <span
        className={cn(
          "relative flex aspect-square w-full items-center justify-center rounded-[26%] bg-primary transition duration-150 group-hover:brightness-105 group-active:scale-90",
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
