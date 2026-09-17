import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  RotateCw,
  LayoutGrid,
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
  Columns2,
  PictureInPicture2,
  Circle,
} from "lucide-react";
import { RoomVideo } from "@/components/RoomVideo";
import { ActivityHelp, GameIntro, hasActivityHelp, shouldShowGameIntro } from "@/components/ActivityHelp";
import { RoomAmbianceSheet } from "@/components/RoomAmbianceSheet";
import { RoomThemeChip } from "@/components/RoomThemeChip";
import { useRoomThemePicker } from "@/hooks/useRoomThemePicker";
import { useHelpNow } from "@/lib/activityHelpNow";
import { MusicPlayerBar, MusicRoomProvider } from "@/components/MusicRoom";
import { ActivityBoundary } from "@/components/RoomErrorBoundary";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useChaperonController } from "@/context/ChaperonContext";
import { ChaperonSeam } from "@/components/ChaperonSeam";
import { ActivityInvite, inviteChime } from "@/components/ActivityInvite";
import { ChatToast } from "@/components/ChatToast";
import { useChatRoom } from "@/context/ChatContext";
import {
  INITIAL_INVITE_STATE,
  inviteHeadline,
  inviteReducer,
  isInvitable,
  pendingInvite,
  starterStatus,
} from "@/lib/activityInvite";
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
 *  Single-item categories stage directly (see pickCategory); multi-item
 *  ones drill in. */
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
const NOTIF_NOISY = new Set(["tick", "seek", "cursor", "typing", "presence", "pause", "sync", "sync_request"]);

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

/** Generated square backgrounds for dock drill-in tiles. */
const ITEM_TILE_IMAGES: Record<string, string> = {
  vision_board: "/dock-tiles/vision-board.png",
  fridge_notes: "/dock-tiles/fridge-notes.png",
  bookshelf: "/dock-tiles/bookshelf.png",
  room_details: "/dock-tiles/room-details.png",
  questions: "/dock-tiles/questions.png",
  this_or_that: "/dock-tiles/this-or-that.png",
  the_36: "/dock-tiles/the-36.png",
  "2_truths": "/dock-tiles/2-truths.png",
  truth_or_dare: "/dock-tiles/truth-or-dare.png",
  one_has_to_go: "/dock-tiles/one-has-to-go.png",
  pick_a_door: "/dock-tiles/pick-a-door.png",
  rank_it: "/dock-tiles/rank-it.png",
  guacamole: "/dock-tiles/guacamole.png",
  watch: "/dock-tiles/watch.png",
  dj: "/dock-tiles/dj.png",
  chat: "/dock-tiles/chat.png",
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
// Desktop bubble: a touch larger so a face still reads on a big monitor.
const DESKTOP_BUBBLE = { w: 128, h: 128 };

/** Desktop (≥1024px) call layouts, Zoom View-menu style. `split` is the
 *  50/50 pane; `corner` the draggable/resizable window the mid-size
 *  viewports already use; `bubble` the round tile phones use. Remembered
 *  per device, not per room — it is a preference about your screen. */
type CallMode = "split" | "corner" | "bubble";
const CALL_MODE_KEY = "dr:call-layout";
const CALL_MODES: { id: CallMode; label: string; icon: LucideIcon }[] = [
  { id: "split", label: "Side by side", icon: Columns2 },
  { id: "corner", label: "Corner window", icon: PictureInPicture2 },
  { id: "bubble", label: "Bubble", icon: Circle },
];
function readCallMode(): CallMode {
  try {
    const v = localStorage.getItem(CALL_MODE_KEY);
    if (v === "split" || v === "corner" || v === "bubble") return v;
  } catch {
    /* ignore */
  }
  return "split";
}
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

/** Desktop-wide viewport — drives the 50/50 call split layout. */
function useWideViewport(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/**
 * The Our Room "stage" — a Vision-Board-sized card that mounts the chosen
 * activity/wall, an app dock below the card (Room / Games / Watch / Music / Chat),
 * and call video (desktop: side by side / corner window / bubble, the
 * person's choice; smaller screens: draggable PiP, phones: bubble).
 * The last thing staged persists per room.
 */
export function RoomStage({
  roomId,
  items,
  renderContent,
  partnerStatus,
  partnerName = "Your partner",
  partnerPhotoUrl = null,
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
  partnerPhotoUrl?: string | null;
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
  /** Pre-game intro — shown each time you open an activity until you tap Start. */
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
  // Pre-game intro: every time you open an activity, learn the flow first,
  // then tap Start. Mid-game reference lives on the ? button.
  useEffect(() => {
    setHelpOpen(false);
    setIntroOpen(shouldShowGameIntro(staged));
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

  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  // ── "JJ started X, join them?" ─────────────────────────────────────────
  // Where the partner is (from their `stage` broadcasts, or their activity
  // events as a fallback for clients that don't send `stage`), reduced into
  // one actionable invite. See lib/activityInvite.ts for the rules.
  const [invite, dispatchInvite] = useReducer(inviteReducer, INITIAL_INVITE_STATE);
  const openedAtRef = useRef<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Tell the partner what I opened (null = a wall, the lobby, or settings).
  // Re-sent on reconnect and when the partner arrives, so a late joiner
  // still gets invited into a game I'm already sitting in.
  const partnerPresentRef = useRef(partnerPresent);
  useEffect(() => {
    openedAtRef.current = isInvitable(staged) ? Date.now() : null;
    setNowTick(Date.now());
    void room.channel.broadcast("stage", {
      activity_id: isInvitable(staged) ? staged : null,
      from: room.senderId,
      name: room.displayName,
      at: new Date().toISOString(),
    });
  }, [staged, room.channel, room.senderId, room.displayName]);
  useEffect(() => {
    const rose = partnerPresent && !partnerPresentRef.current;
    partnerPresentRef.current = partnerPresent;
    if (!partnerPresent) {
      dispatchInvite({ type: "partner_left" });
      return;
    }
    if (rose && isInvitable(stagedRef.current)) {
      void room.channel.broadcast("stage", {
        activity_id: stagedRef.current,
        from: room.senderId,
        name: room.displayName,
        at: new Date().toISOString(),
      });
    }
  }, [partnerPresent, room.channel, room.senderId, room.displayName]);
  useEffect(() => {
    if (channelStatus !== "subscribed" || !isInvitable(stagedRef.current)) return;
    void room.channel.broadcast("stage", {
      activity_id: stagedRef.current,
      from: room.senderId,
      name: room.displayName,
      at: new Date().toISOString(),
    });
  }, [channelStatus, room.channel, room.senderId, room.displayName]);
  // The "Inviting JJ…" chip on the starter's side times out on its own.
  useEffect(() => {
    if (openedAtRef.current == null) return;
    const t = window.setTimeout(() => setNowTick(Date.now()), 46_000);
    return () => window.clearTimeout(t);
  }, [staged, nowTick]);
  const inviteId = pendingInvite(invite, staged);
  const lastChimedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!inviteId) {
      lastChimedRef.current = null;
      return;
    }
    if (lastChimedRef.current === inviteId) return;
    lastChimedRef.current = inviteId;
    inviteChime();
  }, [inviteId]);
  const declineInvite = useCallback(() => dispatchInvite({ type: "decline" }), []);

  // ── Chat while the panel is closed: badge on the dock, toast up top ────
  const chat = useChatRoom();
  const chatUnread = chat?.unread ?? 0;
  const [chatToast, setChatToast] = useState<{ id: string; text: string } | null>(null);
  const lastIncomingId = chat?.lastIncoming?.id ?? null;
  useEffect(() => {
    const m = chat?.lastIncoming;
    if (!m || !lastIncomingId) return;
    if (stagedRef.current === "chat") return;
    setChatToast({ id: m.id, text: m.text });
    // Chat is how you reach someone when the mic or speakers are gone, so
    // the arrival is audible whenever the panel isn't open (not only in a
    // background tab).
    inviteChime(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastIncomingId]);
  useEffect(() => {
    if (staged === "chat") setChatToast(null);
  }, [staged]);
  const dismissChatToast = useCallback(() => setChatToast(null), []);

  const notifTimer = useRef<number | undefined>(undefined);
  // Ids removed via the delete broadcast — dropped from pinned cards instantly.
  const [removedVisionIds, setRemovedVisionIds] = useState<Set<string>>(() => new Set());
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
      if (e.kind === "stage") {
        const d = e.payload as { activity_id?: string | null; from?: string; at?: string };
        if (d.from === room.senderId) return;
        const at = d.at ? Date.parse(d.at) || Date.now() : Date.now();
        dispatchInvite({ type: "stage", id: d.activity_id ?? null, at });
        return;
      }
      if (e.kind !== "activity") return;
      const d = e.payload as { activity_id?: string; type?: string; user_id?: string };
      if (!d.activity_id || d.user_id === room.senderId) return;
      if (d.type && NOTIF_NOISY.has(d.type)) return;
      const meta = NOTIF[d.activity_id];
      if (!meta) return;
      // Joinable activities get the invite card instead of the dock pill.
      if (isInvitable(meta.target)) {
        dispatchInvite({ type: "activity", id: meta.target, eventType: d.type, at: Date.now() });
        return;
      }
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
  const [callMode, setCallModeState] = useState<CallMode>(readCallMode);
  const setCallMode = useCallback((m: CallMode) => {
    setCallModeState(m);
    try {
      localStorage.setItem(CALL_MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);
  // Watch's native fullscreen only paints its own subtree, so while it is
  // up the call must float over it regardless of the chosen desktop mode.
  const [watchFullscreen, setWatchFullscreen] = useState(false);
  /** The right-hand call pane is rendered. */
  const splitCallLayout = callActive && wide && callMode === "split";
  /** The call renders as the floating window (PiP/bubble) rather than in the pane. */
  const floatingCall = !splitCallLayout || watchFullscreen;
  const [portrait, setPortrait] = useState(true);
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
  const bubble = wide
    ? floatingCall && callMode === "bubble"
    : compact && (activityStaged ? !callOpen : manualBubble);
  const base = bubble
    ? wide
      ? DESKTOP_BUBBLE
      : COMPACT_BUBBLE
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
  const dockExpanded = Boolean(activeCat);
  /** Dock category used to open the current activity — powers “back to Games” etc. */
  const [lastCatId, setLastCatId] = useState<string | null>(null);

  function pickCategory(c: (typeof availCats)[number]) {
    // One thing inside (Watch, Music, Chat): open it. The drill-in list is
    // for choosing between things, and a list of one is just a second tap.
    if (c.items.length === 1) {
      // No list to return to either — Back goes to the lobby, not to a
      // drill-in of one tile.
      setLastCatId(null);
      commitStage(c.items[0].id);
      setCatId(null);
      return;
    }
    setCatId(c.id);
  }
  function pickItem(id: string) {
    if (activeCat) setLastCatId(activeCat.id);
    commitStage(id);
    setCatId(null);
  }

  function goBack() {
    if (staged !== "lobby") {
      commitStage("lobby");
      setCatId(lastCatId);
      return;
    }
    if (dockExpanded) {
      setCatId(null);
      setLastCatId(null);
    }
  }

  const backLabel = useMemo(() => {
    if (dockExpanded) return "Lobby";
    if (staged !== "lobby" && lastCatId) {
      return availCats.find((c) => c.id === lastCatId)?.label ?? "Lobby";
    }
    return "Lobby";
  }, [dockExpanded, staged, lastCatId, availCats]);

  const showBack = dockExpanded || staged !== "lobby";

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
  // The split pane's video slot — the host's third home (desktop side by
  // side). One <RoomVideo> lives in the host for the whole call; switching
  // layouts moves the node, so LiveKit never disconnects.
  const splitSlotRef = useRef<HTMLDivElement>(null);
  // Layout effect, not effect: React has just detached the pane (and the
  // host with it) when leaving split mode. A <video> removed from the
  // document pauses once the task yields, so re-home it in the same task.
  useLayoutEffect(() => {
    const host = pipHostRef.current;
    if (!host) return;
    const place = () => {
      const fsEl = document.fullscreenElement as HTMLElement | null;
      const inWatchFs = fsEl?.getAttribute("data-dr-watch-fs") === "1";
      setWatchFullscreen(Boolean(inWatchFs));
      const target = inWatchFs
        ? fsEl
        : splitCallLayout
          ? splitSlotRef.current
          : pipAnchorRef.current;
      if (!target || host.parentElement === target) return;
      target.appendChild(host);
      host.querySelectorAll("video").forEach((v) => {
        if (v.paused) void v.play().catch(() => {});
      });
    };
    place();
    document.addEventListener("fullscreenchange", place);
    return () => document.removeEventListener("fullscreenchange", place);
  }, [splitCallLayout]);
  useEffect(() => {
    const host = pipHostRef.current;
    return () => host?.remove();
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
    <main
      className={cn(
        "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-1 sm:px-6",
        splitCallLayout ? "lg:px-5" : "lg:px-8",
      )}
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
                <p className="truncate text-sm text-cream/80">{`Ringing ${partnerName}…`}</p>
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
                  <span className="block text-[15px] font-semibold leading-tight">{title}</span>
                  <span className="block truncate text-xs leading-tight text-muted-foreground">{sub}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>
            );
          })()
        )}

        {/* Stage — collapses to a strip when a dock category is open. */}
        <section
          className={cn(
            "perm-wall-frame flex flex-col overflow-hidden !p-0 transition-[flex] duration-300",
            dockExpanded ? "shrink-0" : "min-h-0 flex-1",
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 sm:px-4",
              dockExpanded ? "py-1.5" : "py-2",
            )}
          >
            {showBack ? (
              <button
                type="button"
                onClick={goBack}
                className="focus-ring -ml-1 inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2.5 text-[11px] font-medium text-primary transition hover:bg-white/[0.06]"
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
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-cream/80">
                  {stagedItem?.title ?? "Stage"}
                </span>
              </>
            )}
            {showBack && !dockExpanded && staged !== "lobby" && stagedItem && (
              <span className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {stagedItem.title}
              </span>
            )}
            {(() => {
              // Starter's side: did my date follow me in?
              const st = starterStatus(invite, staged, partnerPresent, nowTick, 45_000, openedAtRef.current);
              if (!st) return null;
              return (
                <span
                  data-testid="stage-partner-status"
                  className={cn(
                    "hidden min-w-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] sm:inline-flex",
                    st === "together"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/[0.1] bg-white/[0.04] text-cream/60",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      st === "together" ? "bg-emerald-400" : "bg-primary animate-pulse",
                    )}
                  />
                  <span className="truncate">{st === "together" ? `${partnerName} is here` : `Inviting ${partnerName}…`}</span>
                </span>
              );
            })()}
            <div className="ml-auto flex min-w-0 items-center gap-2">
              {staged === "lobby" && (
                <RoomThemeChip
                  current={themeMood}
                  onClick={() => setThemeOpen(true)}
                  disabled={themeBusy}
                  compact={dockExpanded}
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
                  <p className="truncate text-xs text-cream/80">
                    {partnerInCall ? `With ${partnerName}` : `Ringing ${partnerName}…`}
                  </p>
                  {wide && <CallLayoutSwitcher mode={callMode} onChange={setCallMode} />}
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
                        <span className="block text-xs font-semibold leading-tight">{title}</span>
                        <span className="block truncate text-[10px] leading-tight text-muted-foreground">{sub}</span>
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
          {!dockExpanded && (
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
          )}
        </section>

        {/* App dock — expands when a category is open; lobby collapses above. */}
        <nav
          aria-label="Activities"
          className={cn(
            "dr-app-dock flex min-h-0 flex-col",
            dockExpanded ? "min-h-0 flex-1" : "shrink-0",
            bottomBarActive && !dockExpanded && "mb-14",
          )}
        >
          {notif && (
            <button
              type="button"
              onClick={() => {
                commitStage(notif.target);
                setNotif(null);
              }}
              className="focus-ring mb-2 flex w-full items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs text-cream backdrop-blur-md transition hover:border-primary/55 hover:bg-primary/20"
            >
              {(() => {
                const NotifIcon = ITEM_ICONS[notif.target] ?? LayoutGrid;
                return <NotifIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />;
              })()}
              <span className="truncate">{notif.text}</span>
            </button>
          )}

          <div
            className={cn(
              "flex flex-col rounded-2xl border border-white/[0.12] bg-[#141019]/75 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-2.5",
              dockExpanded && "min-h-0 flex-1",
            )}
          >
            {activeCat ? (
              <>
                <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/70">
                    {activeCat.label}
                  </p>
                  <span className="text-[9px] uppercase tracking-[0.16em] text-cream/40">
                    {activeCat.items.length} items
                  </span>
                </div>
                <div
                  className={cn(
                    "dr-dock-grid grid min-h-0 flex-1 gap-2 overflow-y-auto",
                    activeCat.items.length <= 4
                      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
                  )}
                >
                  {activeCat.items.map((it) => (
                    <MenuSquareTile
                      key={it.id}
                      Icon={ITEM_ICONS[it.id] ?? LayoutGrid}
                      label={it.title}
                      tagline={ITEM_TAGLINES[it.id]}
                      image={ITEM_TILE_IMAGES[it.id]}
                      active={staged === it.id}
                      onClick={() => pickItem(it.id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div
                className="grid gap-1.5 sm:gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.max(availCats.length, 1)}, minmax(0, 1fr))` }}
              >
                {availCats.map((c) => (
                  <MenuTile
                    key={c.id}
                    Icon={c.icon}
                    label={c.label}
                    active={c.items.some((i) => i.id === staged) || catId === c.id}
                    badge={c.id === "chat" ? chatUnread || undefined : c.items.length > 1 ? c.items.length : undefined}
                    badgeTone={c.id === "chat" ? "alert" : undefined}
                    onClick={() => pickCategory(c)}
                  />
                ))}
                {/* Chaperon lives in the dock too, so it is reachable mid-game
                    (the lobby card is hidden once an activity is up). */}
                {chaperon?.enabled && (
                  <MenuTile
                    Icon={ShieldCheck}
                    label="Chaperon"
                    active={chaperon.active}
                    onClick={() => window.dispatchEvent(new CustomEvent("dr:chaperon:open-setup"))}
                  />
                )}
              </div>
            )}
          </div>
        </nav>

        {splitCallLayout && <MusicPlayerBar onOpenList={() => commitStage("dj")} />}
        </div>

        {/* Right — call video fills half the canvas on desktop. */}
        {splitCallLayout && (
          <aside className="dr-call-pane hidden min-h-0 w-full shrink-0 flex-col lg:flex lg:w-1/2">
            <section className="perm-wall-frame flex min-h-0 flex-1 flex-col overflow-hidden !p-0">
              <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2 sm:px-4">
                <Video className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-cream/80">
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
                  <p className="truncate text-xs text-cream/80">
                    {partnerInCall ? `With ${partnerName}` : `Ringing ${partnerName}…`}
                  </p>
                  <CallLayoutSwitcher mode={callMode} onChange={setCallMode} />
                </div>
              </div>
              {/* The live call is re-homed into this slot (see splitSlotRef). */}
              <div ref={splitSlotRef} className="relative min-h-0 flex-1 overflow-hidden bg-black/40" />
            </section>
          </aside>
        )}
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
      {inviteId &&
        (() => {
          const item = items.find((i) => i.id === inviteId);
          const title = item?.title ?? inviteId;
          return (
            <ActivityInvite
              partnerName={partnerName}
              partnerPhotoUrl={partnerPhotoUrl}
              activityId={inviteId}
              activityTitle={title}
              headline={inviteHeadline(partnerName, inviteId, title)}
              tileSrc={ITEM_TILE_IMAGES[inviteId]}
              Icon={ITEM_ICONS[inviteId]}
              onJoin={() => commitStage(inviteId)}
              onDecline={declineInvite}
            />
          );
        })()}

      {chatToast && (
        <ChatToast
          key={chatToast.id}
          partnerName={partnerName}
          partnerPhotoUrl={partnerPhotoUrl}
          text={chatToast.text}
          count={chatUnread}
          offset={Boolean(inviteId)}
          onOpen={() => {
            setChatToast(null);
            commitStage("chat");
          }}
          onDismiss={dismissChatToast}
        />
      )}

      <div ref={pipAnchorRef} className="contents" />
      {callActive &&
        pipHostRef.current &&
        createPortal(
        <div
          className={
            floatingCall
              ? "group fixed z-40 select-none rounded-2xl glass p-1 shadow-[0_20px_56px_rgba(0,0,0,0.55)] touch-none"
              : "relative h-full w-full"
          }
          style={floatingCall && pos ? { left: pos.x, top: pos.y, width: curW, height: curH } : undefined}
        >
          <div
            className={cn(
              "relative h-full w-full overflow-hidden",
              floatingCall && "cursor-grab active:cursor-grabbing",
              floatingCall && (bubble ? "rounded-full" : "rounded-xl"),
            )}
            onPointerDown={floatingCall ? startDrag : undefined}
            onClick={() => {
              // A tap (not a drag) on the bubble opens the call properly.
              if (!bubble || draggedRef.current) return;
              if (wide) {
                setCallMode("corner");
                return;
              }
              setCallOpen(true);
              setManualBubble(false);
            }}
          >
            {!bubble && <ChaperonSeam className={floatingCall ? undefined : "rounded-none"} />}
            <RoomVideo
              variant={floatingCall ? "pip" : "full"}
              collapsed={bubble}
              onLeave={onLeaveCall}
              // Pane → corner window (the button RoomVideo has had all along).
              onMinimize={!floatingCall ? () => setCallMode("corner") : undefined}
              // Desktop: corner → side by side. Below that: bubble ↔ compact
              // window ↔ large call, as before.
              onExpand={
                !floatingCall
                  ? undefined
                  : wide
                    ? watchFullscreen
                      ? undefined
                      : () => setCallMode("split")
                    : expanded
                      ? undefined
                      : () => setExpanded(true)
              }
              onCollapse={
                !floatingCall
                  ? undefined
                  : wide
                    ? () => setCallMode("bubble")
                    : expanded
                      ? () => setExpanded(false)
                      : compact
                        ? () => {
                            // On a phone the shrink control always has somewhere
                            // to go: down to the bubble.
                            if (activityStaged) setCallOpen(false);
                            else setManualBubble(true);
                          }
                        : undefined
              }
            />
          </div>
          {floatingCall && bubble && (
            <span
              className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-cream/80 drop-shadow"
              aria-hidden
            >
              tap
            </span>
          )}
          {floatingCall && !bubble && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPortrait((v) => !v)}
            aria-label="Rotate call"
            className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-cream opacity-0 backdrop-blur transition duration-200 hover:bg-black/70 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          )}
          {/* Corner resize handles — desktop only (invisible/unusable on touch;
              phones use the expand/shrink toggle instead). */}
          {floatingCall &&
            !compact &&
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
          onStart={() => setIntroOpen(false)}
          onBack={goBack}
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
            "pointer-events-none fixed left-1/2 top-3 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md animate-fade-in",
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

/** Desktop call layout switcher — three small toggles, Zoom View-menu style. */
function CallLayoutSwitcher({ mode, onChange }: { mode: CallMode; onChange: (m: CallMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Call layout"
      className="flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-black/30 p-0.5"
    >
      {CALL_MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={m.label}
            title={m.label}
            onClick={() => onChange(m.id)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full transition",
              active ? "bg-primary/25 text-primary" : "text-cream/55 hover:bg-white/[0.06] hover:text-cream",
            )}
          >
            <m.icon className={cn("h-3.5 w-3.5", m.id === "bubble" && "fill-current")} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function MenuTile({
  Icon,
  label,
  active,
  badge,
  badgeTone,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
  /** "alert" = unread-style (filled, like a phone app badge). */
  badgeTone?: "alert";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="group flex min-w-0 flex-col items-center gap-1.5 px-0.5"
    >
      <span
        className={cn(
          "dr-app-icon relative mx-auto flex aspect-square w-full max-w-[3.75rem] items-center justify-center rounded-[24%] border border-white/[0.14] sm:max-w-[4.25rem]",
          active ? "dr-app-icon-active" : "dr-app-icon-idle",
        )}
      >
        <span className="dr-app-icon-shine pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden />
        <Icon
          className={cn(
            "relative z-[1] h-[44%] w-[44%] transition duration-200",
            active ? "text-[#1a1207]" : "text-[#1a1207]/90",
          )}
          strokeWidth={2.15}
          aria-hidden
        />
        {badge ? (
          <span
            data-testid={badgeTone === "alert" ? "unread-badge" : undefined}
            className={cn(
              "absolute -right-1 -top-1 z-[2] flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full border px-1 text-[9px] font-bold shadow-md",
              badgeTone === "alert"
                ? "border-[#141019] bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.55)] animate-in zoom-in-50 duration-200"
                : "border-white/20 bg-[#141019] text-primary",
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-full truncate text-center text-[10px] font-medium leading-tight tracking-[0.06em] sm:text-[11px]",
          active ? "text-primary" : "text-cream/75 group-hover:text-cream",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/** Drilled-in activity — image-backed square with classic icon + label. */
function MenuSquareTile({
  Icon,
  label,
  tagline,
  image,
  active,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  tagline?: string;
  image?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tagline ? `${label} — ${tagline}` : label}
      className={cn(
        "dr-dock-tile group relative flex aspect-square min-w-0 flex-col overflow-hidden rounded-xl border text-left transition duration-200",
        active
          ? "border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_12px_32px_rgb(0_0_0_/_0.45)]"
          : "border-white/[0.10] hover:border-primary/30 hover:shadow-[0_10px_28px_rgb(0_0_0_/_0.4)]",
      )}
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <span className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-black/50" aria-hidden />
      )}
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080604]/95 via-[#080604]/45 to-[#080604]/15 transition duration-300 group-hover:via-[#080604]/35"
        aria-hidden
      />
      <span className="relative z-[1] flex flex-1 items-start justify-start p-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/35 backdrop-blur-md transition duration-200 group-hover:border-primary/40 group-hover:bg-black/50 sm:h-9 sm:w-9",
            active && "border-primary/50 bg-primary/20",
          )}
        >
          <Icon
            className={cn("h-4 w-4 sm:h-[18px] sm:w-[18px]", active ? "text-primary" : "text-cream")}
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </span>
      <span className="relative z-[1] shrink-0 px-2 pb-2 pt-1 sm:px-2.5 sm:pb-2.5">
        <span
          className={cn(
            "block truncate font-serif text-[11px] leading-tight sm:text-xs",
            active ? "text-primary" : "text-cream",
          )}
        >
          {label}
        </span>
        {tagline ? (
          <span
            className="mt-0.5 block line-clamp-2 text-[8px] leading-snug text-cream/55 sm:text-[9px]"
          >
            {tagline}
          </span>
        ) : null}
      </span>
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
