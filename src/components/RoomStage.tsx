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
  Columns2,
  PictureInPicture2,
  Video,
  Sparkles,
  StickyNote,
  BookOpen,
  HelpCircle,
  ArrowLeftRight,
  Heart,
  Lightbulb,
  Dice5,
  Trash2,
  BarChart3,
  PlayCircle,
  Headphones,
  MessageCircle,
  DoorOpen,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  Pin,
  Settings,
  Salad,
  type LucideIcon,
  Loader2,
  Check,
  ShieldCheck,
} from "lucide-react";
import { RoomVideo } from "@/components/RoomVideo";
import {
  ActivityHelp,
  GameIntro,
  hasActivityHelp,
  hasSeenGameIntro,
  markGameIntroSeen,
  shouldShowGameIntro,
} from "@/components/ActivityHelp";
import { RoomAmbianceSheet } from "@/components/RoomAmbianceSheet";
import { RoomThemeChip } from "@/components/RoomThemeChip";
import { useRoomThemePicker } from "@/hooks/useRoomThemePicker";
import { useHelpNow } from "@/lib/activityHelpNow";
import { MusicPlayerBar, MusicRoomProvider } from "@/components/MusicRoom";
import { ActivityBoundary } from "@/components/RoomErrorBoundary";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useBottomBarHeight } from "@/lib/bottomBar";
import {
  isSidePane,
  useCallLayout,
  useVideoOrientation,
  useWideViewport,
} from "@/lib/callLayout";
import { useChaperonController } from "@/context/ChaperonContext";
import { ChaperonSeam } from "@/components/ChaperonSeam";
import { useActivitySession } from "@/hooks/useActivitySession";
import { backgroundMoodLabel } from "@/lib/roomAmbiance";
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
    itemIds: ["questions", "this_or_that", "the_36", "2_truths", "truth_or_dare", "one_has_to_go", "pick_a_door", "rank_it", "guacamole"],
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
  guacamole: { verb: "fired up Guacamole Panic", target: "guacamole" },
  the_36: { verb: "is playing The 36", target: "the_36" },
  "2_truths": { verb: "is playing Two Truths", target: "2_truths" },
  truth_or_dare: { verb: "is playing Truth or Dare", target: "truth_or_dare" },
  one_has_to_go: { verb: "is playing One Has To Go", target: "one_has_to_go" },
  pick_a_door: { verb: "is playing Pick a Door", target: "pick_a_door" },
  rank_it: { verb: "is playing Rank It", target: "rank_it" },
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
  one_has_to_go: Trash2,
  pick_a_door: DoorOpen,
  rank_it: BarChart3,
  guacamole: Salad,
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
  questions: "Draft topics. The night escalates.",
  this_or_that: "Pick fast. Call theirs.",
  the_36: "The 36 questions, without the homework.",
  "2_truths": "Press one. Stake your call.",
  truth_or_dare: "They deal. You deliver. Warm to Bare.",
  one_has_to_go: "Cut one. Guess theirs. Defend it.",
  pick_a_door: "Choose blind. Answer what's behind it.",
  rank_it: "Order five things. Compare priorities.",
  guacamole: "Fast fingers, hidden bowls, loud sabotage.",
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
// Desktop call window: large, freely resizable/draggable.
const PORTRAIT = { w: 336, h: 576 };
const LANDSCAPE = { w: 576, h: 336 };
// Phone default: a compact corner window so the activity stays usable; the
// call enlarges to (near) full-width only when the user taps expand. Sized
// to hold the control row without covering the whole stage.
const COMPACT_PORTRAIT = { w: 168, h: 252 };
const COMPACT_LANDSCAPE = { w: 252, h: 168 };
// Phone + an activity on the stage: the call tucks into a small bubble in
// the TOP corner. Live-tested complaint — "the video is too large and
// blocks activity" — because the compact window docked bottom-right, which
// is exactly where every game puts its controls (the four cook buttons,
// the This-or-That halves, every Next round).
const COMPACT_BUBBLE = { w: 96, h: 96 };
/** Default size is the biggest; drag-resize shrinks down to 2/3 of it. */
const MIN_SCALE = 2 / 3;
type Corner = "nw" | "ne" | "sw" | "se";

/** True on phone-width / touch viewports — drives the compact call layout. */
function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setCompact(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return compact;
}

/**
 * The Our Room "stage" — a Vision-Board-sized card that mounts the chosen
 * activity/wall, an app dock below the card (Room / Games / Watch / Music / Chat),
 * and call video (50/50 split on desktop, draggable PiP on smaller screens).
 * The last thing staged persists per room.
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
  renderContent: (id: string, launch: (id: string) => void) => ReactNode;
  partnerStatus: string;
  partnerName?: string;
  partnerInRoom?: boolean;
  partnerInCall?: boolean;
  partnerPresent?: boolean;
  callActive: boolean;
  onCallIn: () => void;
  onLeaveCall: () => void;
}) {
  // The lobby is the neutral default: nothing preloaded, nothing presumed.
  const fallback =
    items.find((i) => i.id === "lobby")?.id ?? items.find((i) => i.isWall)?.id ?? items[0]?.id ?? "";
  const [staged, setStaged] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`dr:stage2:${roomId}`);
      return saved && items.some((i) => i.id === saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`dr:stage2:${roomId}`, staged);
    } catch {
      /* ignore */
    }
  }, [roomId, staged]);

  // Each person browses activities on their own — the staged item is local
  // (cached per room in localStorage), NOT shared. Partner actions surface via
  // the notifier on the Activities button instead.
  const commitStage = useCallback((id: string) => setStaged(id), []);

  const [helpOpen, setHelpOpen] = useState(false);
  /** Pre-game intro — shown the FIRST time you open an activity. After that
   *  the ? in the stage header is the way back to it. */
  const [introOpen, setIntroOpen] = useState(false);
  // The ? button pulses briefly when the game's "right now" step changes —
  // a reminder of where help lives at exactly the moments its answer is new.
  const helpSnap = useHelpNow(staged);
  const [helpPulse, setHelpPulse] = useState(false);
  const prevStepRef = useRef<number | null>(null);
  useEffect(() => {
    const step = helpSnap?.step ?? null;
    if (step != null && prevStepRef.current != null && step !== prevStepRef.current) {
      setHelpPulse(true);
      const t = window.setTimeout(() => setHelpPulse(false), 2600);
      prevStepRef.current = step;
      return () => window.clearTimeout(t);
    }
    prevStepRef.current = step;
  }, [helpSnap?.step]);
  // Pre-game intro: learn the flow before your first go at a game. Once it
  // has been read and dismissed, opening the game drops you straight in —
  // the ? button in the stage header reopens the same card any time.
  useEffect(() => {
    setHelpOpen(false);
    setIntroOpen(shouldShowGameIntro(staged) && !hasSeenGameIntro(staged));
  }, [staged]);

  /** Close the intro and don't open it for this game again. Both exits count:
   *  reading the card is what "seen" means, whether you then start or step
   *  back out. */
  const dismissIntro = useCallback(() => {
    if (staged) markGameIntroSeen(staged);
    setIntroOpen(false);
  }, [staged]);
  // Two-level launcher (mirrors mobile): null = category list, else drilled in.
  const [catId, setCatId] = useState<string | null>(null);

  // Dynamic-island notifier: partner actions expand the Activities button into
  // a tappable notice for ~3s, then it settles back. (Activities are per-user,
  // so this is how you learn your partner did something.)
  const room = useRoomSession();
  const chaperon = useChaperonController();

  // Game-channel connection state — NOT the video call, which is a separate
  // LiveKit connection that survives networks this WebSocket doesn't. Shown
  // after a short grace so quick blips don't flicker, and followed by a
  // brief "caught up" so the player knows the game re-synced (live-tested
  // gap: taps into a void with no indication why).
  const [channelStatus, setChannelStatus] = useState(room.channel.status);
  useEffect(() => room.channel.onStatus(setChannelStatus), [room.channel]);
  const [linkDown, setLinkDown] = useState(false);
  const [caughtUp, setCaughtUp] = useState(false);
  useEffect(() => {
    if (channelStatus === "subscribed") {
      setLinkDown((was) => {
        if (was) {
          setCaughtUp(true);
          window.setTimeout(() => setCaughtUp(false), 2200);
        }
        return false;
      });
      return;
    }
    const t = window.setTimeout(() => setLinkDown(true), 1500);
    return () => window.clearTimeout(t);
  }, [channelStatus]);
  const { current: themeMood, open: themeOpen, setOpen: setThemeOpen, pick: pickTheme, busy: themeBusy } =
    useRoomThemePicker();
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
      if (e.kind === "customize") {
        // Partner changed the room's look — announce it so a background
        // swap reads as a deliberate gesture, not a glitch.
        const d = e.payload as { background_id?: string; from?: string; by?: string };
        if (d.from === room.senderId) return; // don't notify my own change
        const label = backgroundMoodLabel(d.background_id ?? null);
        const who = d.by?.trim() || partnerName;
        setNotif({ id: Date.now(), text: `${who} set the room to ${label}`, target: "room_details" });
        window.clearTimeout(notifTimer.current);
        notifTimer.current = window.setTimeout(() => setNotif(null), 3400);
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
  const compact = useCompactViewport();
  const wide = useWideViewport();
  /** `side` puts the call in its own pane next to the stage, `float` keeps it
   *  as the draggable window over it. Side-by-side needs width to be worth
   *  anything, so a narrow screen floats regardless of what's stored. The
   *  choice itself is offered in the in-call settings menu. */
  const [callLayout, chooseCallLayout] = useCallLayout();
  const splitCallLayout = callActive && wide && isSidePane(callLayout);
  // The window's shape follows the capture orientation, so the frame always
  // matches the stream inside it (and therefore what the partner receives).
  const [orientation, chooseOrientation, orientationPinned] =
    useVideoOrientation(callLayout);
  const portrait = orientation === "portrait";
  const setPortrait = useCallback(
    (fn: (v: boolean) => boolean) =>
      chooseOrientation(fn(portrait) ? "portrait" : "landscape"),
    [chooseOrientation, portrait],
  );
  const [scale, setScale] = useState(1);
  // Phones start as a small bubble; expand toggles a large (near-fullscreen)
  // call. Desktop keeps the large window and freeform corner-resize. Lazy
  // init off the viewport so desktop paints large immediately (no flicker).
  const [expanded, setExpanded] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 640px)").matches,
  );
  useEffect(() => {
    setExpanded(!compact);
  }, [compact]);
  // An activity (not the lobby or room settings) owns the stage.
  const activityStaged = Boolean(staged) && staged !== "lobby" && staged !== "room_details";
  // Tapping the bubble opens the call properly; staging something else
  // tucks it away again.
  const [callOpen, setCallOpen] = useState(false);
  // Shrunk by hand on a view that doesn't auto-tuck (the lobby, room
  // settings) — phones had no way down from 168x252 at all, which is why
  // "it can only be minimized so much".
  const [manualBubble, setManualBubble] = useState(false);
  useEffect(() => {
    setCallOpen(false);
    setManualBubble(false);
  }, [staged]);
  const bubble = compact && (activityStaged ? !callOpen : manualBubble);
  const base = bubble
    ? COMPACT_BUBBLE
    : expanded
      ? portrait
        ? PORTRAIT
        : LANDSCAPE
      : portrait
        ? COMPACT_PORTRAIT
        : COMPACT_LANDSCAPE;
  const effScale = compact ? 1 : scale;
  const size = base;
  const curW = Math.round(size.w * effScale);
  const curH = Math.round(size.h * effScale);

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
  /** The launcher is a floating dropup again, not a resident dock: the stage
   *  keeps the full canvas and the menu is summoned over it. `menuOpen` is
   *  the dropup; `activeCat` is which level it is showing. */
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(0);
  useLayoutEffect(() => {
    if (menuOpen && panelRef.current) setPanelH(panelRef.current.scrollHeight);
  }, [menuOpen, catId, availCats]);
  /** Dock category used to open the current activity — powers “back to Games” etc. */
  const [lastCatId, setLastCatId] = useState<string | null>(null);

  function openMenu() {
    setCatId(null);
    setMenuOpen((v) => !v);
  }
  function pickCategory(c: (typeof availCats)[number]) {
    // A category with one thing in it is just that thing — don't make the
    // user drill into a list of one.
    if (c.items.length === 1) {
      commitStage(c.items[0].id);
      setMenuOpen(false);
      return;
    }
    setCatId(c.id);
  }
  function pickItem(id: string) {
    if (activeCat) setLastCatId(activeCat.id);
    commitStage(id);
    setMenuOpen(false);
    setCatId(null);
  }

  /** Back always means "out of this activity", since the menu is no longer
   *  part of the layout — closing it is what the pill and the scrim do. */
  function goBack() {
    if (staged === "lobby") return;
    commitStage("lobby");
    setCatId(null);
  }

  const backLabel = useMemo(() => {
    if (staged !== "lobby" && lastCatId) {
      return availCats.find((c) => c.id === lastCatId)?.label ?? "Lobby";
    }
    return "Lobby";
  }, [staged, lastCatId, availCats]);

  const showBack = staged !== "lobby";

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
    // Top-right on every viewport: the bottom of the stage belongs to the
    // activity's controls, so the call never starts on top of them.
    setPos({
      x: Math.max(EDGE, window.innerWidth - curW - EDGE),
      y: TOP_PAD + 8,
    });
  }, [pos, callActive, curW, curH]);

  // Re-dock when the call changes mode (bubble ↔ open), so it can't be left
  // sitting over the controls it just grew past.
  const prevBubble = useRef(bubble);
  useEffect(() => {
    if (prevBubble.current === bubble) return;
    prevBubble.current = bubble;
    if (!callActive) return;
    setPos({
      x: Math.max(EDGE, window.innerWidth - curW - EDGE),
      y: TOP_PAD + 8,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubble, callActive]);

  // Keep the window on-screen when its size changes (expand/collapse/rotate).
  useEffect(() => {
    setPos((p) => (p ? clamp(p.x, p.y, curW, curH) : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curW, curH]);

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
      draggedRef.current = true;
      setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy, curW, curH));
    },
    [clamp, curW, curH],
  );
  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);
  const draggedRef = useRef(false);
  function startDrag(e: React.PointerEvent) {
    if (!pos) return;
    draggedRef.current = false;
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


  // The launcher sits in the gutter between the stage and whatever is pinned
  // to the bottom of the screen, with the SAME gap above and below it. Both
  // heights are measured rather than assumed: the player bar's height is
  // content-driven (it grows with its controls), and the old hardcoded
  // `bottom-[80px]` guess is what let the pill drift up over the stage.
  const GUTTER = 14;
  const launcherRef = useRef<HTMLDivElement>(null);
  const barH = useBottomBarHeight();
  const [pillH, setPillH] = useState(44);
  useLayoutEffect(() => {
    const el = launcherRef.current;
    if (!el) return;
    const read = () => setPillH(el.offsetHeight || 44);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /** Where the launcher floats, and how much room the stage gives up for it. */
  const launcherBottom = barH + GUTTER;
  const stagePadBottom = barH + GUTTER + pillH + GUTTER;

  return (
    <MusicRoomProvider watchActive={staged === "watch"}>
    <main
      className={cn(
        "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-1 transition-[padding-bottom] duration-300 ease-out sm:px-6",
        splitCallLayout ? "lg:px-5" : "lg:px-8",
      )}
      style={{ paddingBottom: stagePadBottom }}
    >
      <div
        className={cn(
          "flex h-full min-h-0 w-full gap-2 sm:gap-2.5",
          splitCallLayout
            ? "max-w-none flex-col lg:flex-row lg:items-stretch lg:gap-3"
            : "mx-auto max-w-6xl flex-col",
        )}
      >
        {/* Left — lobby card + app dock (half width when in a call on desktop). */}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col gap-2 sm:gap-2.5",
            splitCallLayout ? "flex-1 lg:w-1/2 lg:flex-none" : "h-full flex-1",
          )}
        >
        {/* Call initiator — full-width on mobile; on desktop it sits in the
            stage header so the lobby card can use the full canvas. */}
        {callActive && !splitCallLayout ? (
          // Ringing is a status worth a strip; a connected call is not (the
          // video says it). The strip leaves once they are in.
          !partnerInCall ? (
            <div className="perm-status-bar lg:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                <p className="truncate text-body text-cream/80">{`Ringing ${partnerName}…`}</p>
              </div>
            </div>
          ) : null
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
                className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-cream backdrop-blur-md transition hover:border-primary/30 hover:bg-white/[0.07] active:scale-[0.99] lg:hidden"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Video className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold leading-tight">{title}</span>
                  <span className="block truncate text-label leading-tight text-muted-foreground">{sub}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>
            );
          })()
        )}

        {/* Stage — owns the canvas. The launcher floats over it. */}
        <section className="perm-wall-frame flex min-h-0 flex-1 flex-col overflow-hidden !p-0">
          <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2 sm:px-4">
            {showBack ? (
              <button
                type="button"
                onClick={goBack}
                className="focus-ring -ml-1 inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2.5 text-label font-medium text-primary transition hover:bg-white/[0.06]"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">Back to {backLabel}</span>
              </button>
            ) : (
              <>
                {stagedItem &&
                  (() => {
                    const Icon = ITEM_ICONS[stagedItem.id] ?? LayoutGrid;
                    return <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />;
                  })()}
                <span className="text-label font-medium uppercase tracking-[0.16em] text-cream/80">
                  {stagedItem?.title ?? "Stage"}
                </span>
              </>
            )}
            {showBack && stagedItem && (
              <span className="truncate text-label uppercase tracking-[0.14em] text-muted-foreground">
                {stagedItem.title}
              </span>
            )}
            <div className="ml-auto flex min-w-0 items-center gap-2">
              {staged === "lobby" && (
                <RoomThemeChip
                  current={themeMood}
                  onClick={() => setThemeOpen(true)}
                  disabled={themeBusy}
                />
              )}
              {callActive && !splitCallLayout ? (
                <div className="hidden min-w-0 items-center gap-2 lg:flex">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      partnerInCall
                        ? "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.65)]"
                        : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse",
                    )}
                  />
                  <p className="truncate text-label text-cream/80">
                    {partnerInCall ? `With ${partnerName}` : `Ringing ${partnerName}…`}
                  </p>
                </div>
              ) : !callActive ? (
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
                      className="group hidden max-w-md items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3 text-left text-cream transition hover:border-primary/30 hover:bg-white/[0.07] lg:flex"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Video className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-label font-semibold leading-tight">{title}</span>
                        <span className="block truncate text-label leading-tight text-muted-foreground">{sub}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </button>
                  );
                })()
              ) : null}
              {staged && hasActivityHelp(staged) && !introOpen && (
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  aria-label="How this works"
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-cream",
                    helpPulse ? "dr-help-pulse" : "",
                  ].join(" ")}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div key={staged} className="animate-stage-swell relative min-h-0 flex-1 overflow-hidden">
            {staged ? (
              <ActivityBoundary label={stagedItem?.title} resetKey={staged}>
                <div
                  className={[
                    "h-full min-h-0 transition duration-300",
                    introOpen ? "pointer-events-none scale-[0.98] opacity-40 blur-[2px]" : "",
                  ].join(" ")}
                  aria-hidden={introOpen}
                >
                  {renderContent(staged, commitStage)}
                </div>
              </ActivityBoundary>
            ) : null}
          </div>
        </section>

        {splitCallLayout && <MusicPlayerBar onOpenList={() => commitStage("dj")} />}
        </div>

        {/* Right — call video fills half the canvas on desktop. */}
        {splitCallLayout && (
          <aside className="dr-call-pane hidden min-h-0 w-full shrink-0 flex-col lg:flex lg:w-1/2">
            <section className="perm-wall-frame flex min-h-0 flex-1 flex-col overflow-hidden !p-0">
              <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2 sm:px-4">
                <Video className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="text-label font-medium uppercase tracking-[0.16em] text-cream/80">
                  Call
                </span>
                <div className="ml-auto flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      partnerInCall
                        ? "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.65)]"
                        : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse",
                    )}
                  />
                  <p className="truncate text-label text-cream/80">
                    {partnerInCall ? `With ${partnerName}` : `Ringing ${partnerName}…`}
                  </p>
                  <button
                    type="button"
                    onClick={() => chooseCallLayout("float")}
                    aria-label="Float the call over the room"
                    title="Float the call over the room"
                    className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-cream"
                  >
                    <PictureInPicture2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden bg-black/40">
                <ChaperonSeam className="rounded-none" />
                {/* `side` fills the pane with both tiles; `side-pip` gives the
                    pane the phone-call shape — one feed full-bleed, the other
                    floating over it. */}
                <RoomVideo
                  variant={callLayout === "side-pip" ? "pip" : "full"}
                  framed
                  onLeave={onLeaveCall}
                />
              </div>
            </section>
          </aside>
        )}
      </div>

      {/* Launcher — one pill at the bottom of the screen with an animated
          dropup. It floats over the stage instead of occupying a row of it,
          which is the whole point: the activity gets the canvas, the menu is
          summoned and dismissed. */}
      {menuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden />
      )}
      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 transition-[bottom] duration-300 ease-out"
        style={{ bottom: launcherBottom }}
      >
        <div ref={launcherRef} className="relative">
          <div
            className={cn(
              "absolute bottom-full left-1/2 mb-3 w-[min(29rem,94vw)] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/10 bg-card/90 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-300 ease-out",
              menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            )}
            style={{ height: menuOpen ? panelH : 0 }}
          >
            {/* Content scales up from the bottom as the tray grows, so the
                whole menu (icons included) opens as one motion. */}
            <div
              ref={panelRef}
              className={cn(
                "origin-bottom p-5 transition-transform duration-300 ease-out",
                menuOpen ? "scale-100" : "scale-90",
              )}
            >
              {activeCat ? (
                /* Level 2 — the category's activities as a list. */
                <>
                  <button
                    type="button"
                    onClick={() => setCatId(null)}
                    className="mb-2.5 -ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-label font-semibold uppercase tracking-[0.16em] text-muted-foreground transition hover:text-cream"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {activeCat.label}
                  </button>
                  <div className="flex max-h-[min(28rem,56vh)] flex-col gap-2.5 overflow-y-auto">
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
                   centered squircle tiles. Chaperon sits alongside them so it
                   stays reachable mid-activity. */
                <div className="flex flex-wrap justify-center gap-4">
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
                  {chaperon?.enabled && (
                    <MenuTile
                      Icon={ShieldCheck}
                      label="Chaperon"
                      active={chaperon.active}
                      onClick={() => {
                        setMenuOpen(false);
                        window.dispatchEvent(new CustomEvent("dr:chaperon:open-setup"));
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
          {(() => {
            // The pill doubles as the nudge surface: when an activity wants
            // attention it becomes that invitation, and tapping takes you
            // there instead of opening the menu.
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
                  "focus-ring pointer-events-auto flex max-w-[80vw] items-center gap-2 rounded-full border px-5 py-2.5 text-body font-medium text-cream shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300",
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
                <span
                  key={showNotif ? notif.id : menuOpen ? "close" : "activities"}
                  className="animate-fade-in truncate"
                >
                  {showNotif ? notif.text : menuOpen ? "Close" : "Activities"}
                </span>
              </button>
            );
          })()}
        </div>
      </div>

      {!splitCallLayout && <MusicPlayerBar onOpenList={() => commitStage("dj")} />}

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
        !splitCallLayout &&
        pipHostRef.current &&
        createPortal(
        <div
          className="group fixed z-40 select-none rounded-2xl glass p-1 shadow-[0_20px_56px_rgba(0,0,0,0.55)] touch-none"
          style={pos ? { left: pos.x, top: pos.y, width: curW, height: curH } : undefined}
        >
          <div
            className={cn(
              "relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing",
              bubble ? "rounded-full" : "rounded-xl",
            )}
            onPointerDown={startDrag}
            onClick={() => {
              // A tap (not a drag) on the bubble opens the call properly.
              if (!bubble || draggedRef.current) return;
              setCallOpen(true);
              setManualBubble(false);
            }}
          >
            {!bubble && <ChaperonSeam />}
            <RoomVideo
              variant="pip"
              collapsed={bubble}
              onLeave={onLeaveCall}
              // bubble ↔ compact window ↔ large call. On a phone the shrink
              // control returns to the bubble rather than doing nothing.
              onExpand={expanded ? undefined : () => setExpanded(true)}
              // No shrink control: below a certain size the in-video control
              // row has nowhere to lay out and collapses on itself. The window
              // is draggable and corner-resizable, which covers getting it out
              // of the way without a button that can wreck its own UI.
            />
          </div>
          {bubble && (
            <span
              className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-label font-semibold uppercase tracking-[0.14em] text-cream/80 drop-shadow"
              aria-hidden
            >
              tap
            </span>
          )}
          {!bubble && !orientationPinned && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPortrait((v) => !v)}
            aria-label={portrait ? "Switch to landscape" : "Switch to portrait"}
            title={portrait ? "Switch to landscape" : "Switch to portrait"}
            className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-cream opacity-0 backdrop-blur transition duration-200 hover:bg-black/70 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          )}
          {/* Dock it beside the stage. Only offered where there is room for
              two panes — on a phone the side-by-side layout has nothing to
              give, so the control would be a dead end. */}
          {!bubble && wide && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => chooseCallLayout("side")}
            aria-label="Dock the call beside the room"
            title="Dock the call beside the room"
            className="absolute right-11 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-cream opacity-0 backdrop-blur transition duration-200 hover:bg-black/70 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Columns2 className="h-3.5 w-3.5" />
          </button>
          )}
          {/* Corner resize handles — desktop only (invisible/unusable on touch;
              phones use the expand/shrink toggle instead). */}
          {!compact &&
            (["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
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

      {introOpen && staged && shouldShowGameIntro(staged) && (
        <GameIntro
          id={staged}
          onStart={dismissIntro}
          onBack={() => {
            dismissIntro();
            goBack();
          }}
          backLabel={backLabel === "Lobby" ? "Back to lobby" : `Back to ${backLabel}`}
        />
      )}
      {helpOpen && staged && !introOpen && (
        <ActivityHelp id={staged} onClose={() => setHelpOpen(false)} />
      )}

      {(linkDown || caughtUp) && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "pointer-events-none fixed left-1/2 top-3 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border px-3.5 py-1.5 text-label font-medium shadow-lg backdrop-blur-md animate-fade-in",
            linkDown
              ? "border-amber-300/50 bg-black/70 text-amber-200"
              : "border-emerald-400/50 bg-black/70 text-emerald-200",
          )}
        >
          {linkDown ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Reconnecting to the room… your moves will catch up
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden />
              Back on — caught up
            </>
          )}
        </div>
      )}

      <RoomAmbianceSheet
        open={themeOpen}
        onOpenChange={setThemeOpen}
        current={themeMood}
        onPick={(id) => void pickTheme(id)}
      />
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
      // shrink-0: these wrap onto rows of differing counts, and a shrinkable
      // tile ends up a different size per row.
      className="group flex w-[4rem] shrink-0 flex-col items-center gap-2.5"
    >
      {/* Squircle app icon — the drilled-in row's icon chip at tile size:
          the same primary wash (bg-primary/15) and amber glyph. Tinting from
          `primary` rather than white means a themed room retints these with
          everything else; a white wash would stay grey while the room warmed
          around it. */}
      <span
        className={cn(
          "relative flex aspect-square w-full items-center justify-center rounded-[26%] border transition duration-150 group-active:scale-90",
          active
            ? "border-primary/50 bg-primary/20"
            : "border-primary/20 bg-primary/10 group-hover:bg-primary/15",
        )}
      >
        <Icon className="h-[42%] w-[42%] text-primary" strokeWidth={2.25} aria-hidden />
        {badge ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-card px-1 text-label font-semibold text-cream ring-1 ring-white/15">
            {badge}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-full truncate text-label font-medium",
          active ? "text-cream" : "text-cream/70",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/** A drilled-in activity as a list row — icon chip + title + tagline +
 *  chevron. The compact form the dropup wants; the dock's big square tiles
 *  needed a grid the stage can no longer spare. */
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
        "flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition",
        active
          ? "border-primary/40 bg-primary/[0.08]"
          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
        <Icon className="h-[18px] w-[18px] text-primary" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-cream">{label}</span>
        {tagline ? (
          <span className="block truncate text-label text-muted-foreground">{tagline}</span>
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
              <span className="rounded-full bg-black/45 px-2 py-0.5 text-label font-semibold uppercase tracking-wider text-amber">
                PDF
              </span>
            )}
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[#1a1207] shadow">
          <Pin className="h-3 w-3 fill-current" />
        </span>
      </div>
      <p className="truncate px-0.5 pt-1.5 text-center text-label font-medium text-cream/90">{label}</p>
    </div>
  );
}

/** Matches `.fridge-sticky-wrap` — used for drag clamping on stage pins. */
const NOTE_W = 148;
const NOTE_H = 156;
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
      x: Math.max(EDGE, window.innerWidth - NOTE_W - EDGE - index * 18),
      y: TOP_PAD + 8 + index * (NOTE_H + 14),
    };
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - NOTE_W - EDGE)),
    y: Math.min(Math.max(y, TOP_PAD), Math.max(TOP_PAD, window.innerHeight - NOTE_H - BOTTOM_PAD)),
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
        transform: `rotate(${rot}deg)`,
        ["--note-rot" as string]: `${rot}deg`,
      }}
      className="fridge-stage-pin fixed z-30 cursor-grab touch-none select-none active:cursor-grabbing"
    >
      <span className="fridge-sticky-cast" aria-hidden />
      <div
        className="fridge-sticky-paper"
        style={{ background: STICKY_PALETTE[hash % STICKY_PALETTE.length] }}
      >
        <span className="fridge-sticky-pin" aria-hidden />
        <span className="fridge-sticky-tape" aria-hidden />
        <span className="fridge-sticky-fold" aria-hidden />
        <span className="fridge-sticky-lines" aria-hidden />
        <p className="fridge-sticky-text">{note.text}</p>
        <div className="fridge-sticky-meta">
          <span className="truncate">{note.pinned_by_name || "Someone"}</span>
        </div>
      </div>
    </div>
  );
}
