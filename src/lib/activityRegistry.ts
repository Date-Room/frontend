/**
 * The single source of truth for room activities.
 *
 * Every surface derives from `ACTIVITIES`: the LiveRoom tab/stage list, the
 * RoomStage launcher categories and taglines, the partner-action notifier,
 * the host curation picker (via roomExperience) and the seeded catalog
 * (`ACTIVITY_TAB_SEEDS`). Adding an activity means adding one entry here plus
 * its stage mount in `src/components/ActivityContent.tsx` (the mount map is
 * an exhaustive Record over ActivityId, so forgetting it is a compile error).
 * Help copy lives in `src/components/ActivityHelp.tsx` keyed by the same ids;
 * a test asserts every registry id has help.
 *
 * This module stays free of component imports so lib code (roomExperience,
 * appConfigSeed) can use it without cycles.
 */
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Dice5,
  DoorOpen,
  Gamepad2,
  Heart,
  HelpCircle,
  Headphones,
  LayoutGrid,
  Lightbulb,
  MessageCircle,
  PlayCircle,
  Settings,
  Sparkles,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";

/** Every activity the room can stage (tab / launcher / broadcast id). */
export type ActivityId =
  | "vision_board"
  | "fridge_notes"
  | "bookshelf"
  | "questions"
  | "this_or_that"
  | "the_36"
  | "2_truths"
  | "truth_or_dare"
  | "one_has_to_go"
  | "pick_a_door"
  | "rank_it"
  | "watch"
  | "dj"
  | "chat"
  | "room_details";

/** Ids as stored in `curated_activity_ids` on the room row. Mostly the same
 *  as ActivityId, except Bookshelf persists under the legacy id "fridge". */
export type CuratableActivityId =
  | "questions"
  | "this_or_that"
  | "the_36"
  | "2_truths"
  | "truth_or_dare"
  | "one_has_to_go"
  | "pick_a_door"
  | "rank_it"
  | "watch"
  | "dj"
  | "vision_board"
  | "fridge";

/** Curation-picker grouping (walls are subscription-gated). */
export type ActivityCategory = "games" | "watch" | "music" | "walls";

/** Launcher (RoomStage dropup) grouping — mirrors the mobile activity menu. */
export type LauncherCategoryId = "room" | "games" | "watch" | "music" | "chat";

export type ActivityDef = {
  id: ActivityId;
  /** In-room label (stage header, tabs, launcher rows). */
  label: string;
  /** Host curation picker label, when the fuller name reads better there. */
  curationLabel?: string;
  tagline: string;
  emoji: string;
  icon: LucideIcon;
  launcherCategory: LauncherCategoryId;
  /** null = never curated away (always-on, or gated some other way). */
  curatableId: CuratableActivityId | null;
  /** Wall surfaces (Vision Board / Fridge / Bookshelf) — subscription rooms
   *  only, and they group first in the launcher. */
  isWall?: boolean;
  /** Partner-action notifier line ("<name> <verb>"); omit for no notification. */
  notifVerb?: string;
};

/** Ordered as the room presents them: walls, then games, watch, music, chat,
 *  with room management last. */
export const ACTIVITIES: ActivityDef[] = [
  {
    id: "vision_board",
    label: "Vision Board",
    tagline: "Pin the life you're building together.",
    emoji: "✨",
    icon: Sparkles,
    launcherCategory: "room",
    curatableId: "vision_board",
    isWall: true,
    notifVerb: "added a dream",
  },
  {
    id: "fridge_notes",
    label: "Fridge Note",
    tagline: "Sticky notes for you two.",
    emoji: "🧲",
    icon: StickyNote,
    launcherCategory: "room",
    curatableId: null,
    isWall: true,
  },
  {
    id: "bookshelf",
    label: "Bookshelf",
    tagline: "Books, links, and a shared watch list.",
    emoji: "📚",
    icon: BookOpen,
    launcherCategory: "room",
    curatableId: "fridge",
    isWall: true,
    notifVerb: "added to the shelf",
  },
  {
    id: "questions",
    label: "Questions",
    curationLabel: "21 Questions",
    tagline: "Pick a deck, swap, take turns.",
    emoji: "💬",
    icon: HelpCircle,
    launcherCategory: "games",
    curatableId: "questions",
    notifVerb: "is playing Questions",
  },
  {
    id: "this_or_that",
    label: "This or That",
    tagline: "Pick blind, reveal together.",
    emoji: "⚖️",
    icon: ArrowLeftRight,
    launcherCategory: "games",
    curatableId: "this_or_that",
    notifVerb: "is playing This or That",
  },
  {
    id: "the_36",
    label: "The 36",
    tagline: "Three sets of twelve. Get closer.",
    emoji: "🫶",
    icon: Heart,
    launcherCategory: "games",
    curatableId: "the_36",
    notifVerb: "is playing The 36",
  },
  {
    id: "2_truths",
    label: "2 Truths",
    curationLabel: "2 Truths and a Lie",
    tagline: "Spot the lie. Swap roles.",
    emoji: "🎭",
    icon: Lightbulb,
    launcherCategory: "games",
    curatableId: "2_truths",
    notifVerb: "is playing Two Truths",
  },
  {
    id: "truth_or_dare",
    label: "Truth or Dare",
    tagline: "Three cards each. Two skips.",
    emoji: "🔥",
    icon: Dice5,
    launcherCategory: "games",
    curatableId: "truth_or_dare",
    notifVerb: "is playing Truth or Dare",
  },
  {
    id: "one_has_to_go",
    label: "One Has To Go",
    tagline: "Cut one. Guess theirs. Defend it.",
    emoji: "🗑️",
    icon: Trash2,
    launcherCategory: "games",
    curatableId: "one_has_to_go",
    notifVerb: "is playing One Has To Go",
  },
  {
    id: "pick_a_door",
    label: "Pick a Door",
    tagline: "Choose blind. Answer what's behind it.",
    emoji: "🚪",
    icon: DoorOpen,
    launcherCategory: "games",
    curatableId: "pick_a_door",
    notifVerb: "is playing Pick a Door",
  },
  {
    id: "rank_it",
    label: "Rank It",
    tagline: "Order five things. Compare priorities.",
    emoji: "📊",
    icon: BarChart3,
    launcherCategory: "games",
    curatableId: "rank_it",
    notifVerb: "is playing Rank It",
  },
  {
    id: "watch",
    label: "Watch",
    curationLabel: "Watch party",
    tagline: "Sync up something to watch.",
    emoji: "🎬",
    icon: PlayCircle,
    launcherCategory: "watch",
    curatableId: "watch",
    notifVerb: "started a video",
  },
  {
    id: "dj",
    label: "Music",
    curationLabel: "Music / DJ",
    tagline: "Take turns picking the soundtrack.",
    emoji: "🎧",
    icon: Headphones,
    launcherCategory: "music",
    curatableId: "dj",
    notifVerb: "played a song",
  },
  {
    id: "chat",
    label: "Chat",
    tagline: "Side chat while you play.",
    emoji: "💭",
    icon: MessageCircle,
    launcherCategory: "chat",
    curatableId: null,
    notifVerb: "sent a message",
  },
  {
    id: "room_details",
    label: "Room info",
    tagline: "Invite, theme & background.",
    emoji: "⚙️",
    icon: Settings,
    launcherCategory: "room",
    curatableId: null,
  },
];

const BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));

export function activityById(id: ActivityId): ActivityDef {
  return BY_ID.get(id)!;
}

/** Icon for an id from any source (broadcast payloads etc.) — safe fallback. */
export function activityIcon(id: string): LucideIcon {
  return BY_ID.get(id as ActivityId)?.icon ?? LayoutGrid;
}

export function activityTagline(id: string): string | undefined {
  return BY_ID.get(id as ActivityId)?.tagline;
}

/* ───────────── Launcher (RoomStage dropup) ───────────── */

/** Category tiles in display order; itemIds preserve registry order, so the
 *  Room category runs walls first with room management last. */
export const LAUNCHER_CATEGORIES: {
  id: LauncherCategoryId;
  label: string;
  icon: LucideIcon;
  itemIds: ActivityId[];
}[] = (
  [
    { id: "room", label: "Room", icon: DoorOpen },
    { id: "games", label: "Games", icon: Gamepad2 },
    { id: "watch", label: "Watch", icon: PlayCircle },
    { id: "music", label: "Music", icon: Headphones },
    { id: "chat", label: "Chat", icon: MessageCircle },
  ] as const
).map((c) => ({
  ...c,
  itemIds: ACTIVITIES.filter((a) => a.launcherCategory === c.id).map((a) => a.id),
}));

/* ───────────── Partner-action notifier ───────────── */

/** Broadcast activity_id → notifier copy + which stage item to open. Includes
 *  broadcast-only ids that don't stage under their own name. */
export const ACTIVITY_NOTIF: Record<string, { verb: string; target: ActivityId }> = {
  ...Object.fromEntries(
    ACTIVITIES.filter((a) => a.notifVerb).map((a) => [
      a.id,
      { verb: a.notifVerb!, target: a.id },
    ]),
  ),
  // Fridge notes broadcast as "pinned_note".
  pinned_note: { verb: "left a note", target: "fridge_notes" },
  // Bookshelf persists/broadcasts under the legacy activity_id "fridge".
  fridge: { verb: "added to the shelf", target: "bookshelf" },
};

/* ───────────── Host curation picker ───────────── */

export type CuratableActivityMeta = {
  id: CuratableActivityId;
  label: string;
  tagline: string;
  emoji: string;
  category: ActivityCategory;
};

const CURATION_CATEGORY_ORDER: ActivityCategory[] = ["walls", "watch", "music", "games"];

function curationCategory(a: ActivityDef): ActivityCategory {
  return a.isWall ? "walls" : (a.launcherCategory as ActivityCategory);
}

/** The curatable date activities, walls first (the picker's display order).
 *  `chat` and room management are always available and excluded here. */
export const CURATABLE_ACTIVITIES: CuratableActivityMeta[] = ACTIVITIES.filter(
  (a) => a.curatableId !== null,
)
  .map((a) => ({
    id: a.curatableId!,
    label: a.curationLabel ?? a.label,
    tagline: a.tagline,
    emoji: a.emoji,
    category: curationCategory(a),
  }))
  .sort(
    (x, y) =>
      CURATION_CATEGORY_ORDER.indexOf(x.category) - CURATION_CATEGORY_ORDER.indexOf(y.category),
  );
