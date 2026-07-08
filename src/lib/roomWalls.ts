/**
 * Persistent-room wall features — vision board, fridge/bookshelf, pinned notes.
 * Durable state lives in activity rows: vision_board, fridge, pinned_note.
 */

export type VisionMediaType = "image" | "pdf" | "none";

export type VisionBoardItem = {
  id: string;
  image_url: string;
  caption: string;
  x: number;
  y: number;
  width: number;
  /** Canvas height % — defaults from shape when omitted. */
  height?: number;
  shape: "rect" | "circle";
  z: number;
  /** Tailwind gradient classes when no image is set. */
  gradient?: string;
  /** Attached media kind — inferred from URL when omitted. */
  media_type?: VisionMediaType;
  /** Original filename for uploads (PDFs, etc.). */
  filename?: string;
  added_by?: string;
  added_by_name?: string;
  /** Pinned onto the room stage — pops out as a draggable card (max 2). */
  pinned?: boolean;
};

export type VisionBoardState = {
  items: VisionBoardItem[];
};

export type FridgeItemKind = "book" | "link" | "watch";

export type FridgeItem = {
  id: string;
  kind: FridgeItemKind;
  title: string;
  author?: string;
  url?: string;
  note?: string;
  status: "todo" | "done";
  added_by: string;
  added_by_name?: string;
  read_by?: string[];
  hearts?: number;
};

export type FridgeState = {
  items: FridgeItem[];
};

/** A sticky note on the couples fridge. */
export type FridgeNote = {
  id: string;
  text: string;
  pinned_by: string;
  pinned_by_name: string;
  pinned_at: string;
  emergency?: boolean;
  seen_by: string[];
  /** Stuck onto the room stage — pops out as a draggable note (max 2). */
  stage_pinned?: boolean;
};

export type FridgeNotesState = {
  notes: FridgeNote[];
};

/** @deprecated Use FridgeNote — kept for welcome-gate compatibility. */
export type PinnedNoteState = FridgeNote;

export function emptyVisionBoard(): VisionBoardState {
  return { items: [] };
}

export function emptyFridge(): FridgeState {
  return { items: [] };
}

export function emptyFridgeNotes(): FridgeNotesState {
  return { notes: [] };
}

export function emptyPinnedNote(): PinnedNoteState {
  return {
    id: "",
    text: "",
    pinned_by: "",
    pinned_by_name: "",
    pinned_at: "",
    seen_by: [],
  };
}

export const VISION_GRADIENTS = [
  "from-rose-900/90 via-amber-800/50 to-indigo-900/80",
  "from-fuchsia-900/80 via-rose-700/50 to-violet-900/70",
  "from-amber-900/80 via-lime-800/40 to-emerald-900/60",
  "from-sky-900/80 via-indigo-800/50 to-purple-900/70",
  "from-orange-900/80 via-rose-800/45 to-pink-900/65",
] as const;

export function pickVisionGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % VISION_GRADIENTS.length;
  return VISION_GRADIENTS[hash] ?? VISION_GRADIENTS[0];
}

/** Resolve how a board item should render (image, PDF, or caption-only). */
export function visionMediaType(item: Pick<VisionBoardItem, "image_url" | "media_type">): VisionMediaType {
  if (item.media_type === "image" || item.media_type === "pdf" || item.media_type === "none") {
    return item.media_type;
  }
  const url = item.image_url.trim();
  if (!url) return "none";
  if (url.startsWith("data:application/pdf") || /\.pdf(\?|#|$)/i.test(url)) return "pdf";
  return "image";
}

export function parseVisionBoard(raw: Record<string, unknown> | null): VisionBoardState {
  if (!raw || !Array.isArray(raw.items)) return emptyVisionBoard();
  const items = raw.items
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      id: String(x.id ?? crypto.randomUUID()),
      image_url: String(x.image_url ?? ""),
      caption: String(x.caption ?? ""),
      x: typeof x.x === "number" ? x.x : 8,
      y: typeof x.y === "number" ? x.y : 8,
      width: typeof x.width === "number" ? x.width : 28,
      height: typeof x.height === "number" ? x.height : undefined,
      shape: x.shape === "circle" ? "circle" : "rect",
      z: typeof x.z === "number" ? x.z : 1,
      gradient: typeof x.gradient === "string" ? x.gradient : undefined,
      media_type:
        x.media_type === "image" || x.media_type === "pdf" || x.media_type === "none"
          ? x.media_type
          : undefined,
      filename: typeof x.filename === "string" ? x.filename : undefined,
      added_by: typeof x.added_by === "string" ? x.added_by : undefined,
      added_by_name: typeof x.added_by_name === "string" ? x.added_by_name : undefined,
      pinned: x.pinned === true,
    }))
    .filter((x) => x.image_url.trim() || x.caption.trim());
  return { items };
}

export function parseFridge(raw: Record<string, unknown> | null): FridgeState {
  if (!raw || !Array.isArray(raw.items)) return emptyFridge();
  const items = raw.items
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      id: String(x.id ?? crypto.randomUUID()),
      kind: (x.kind === "link" || x.kind === "watch" ? x.kind : "book") as FridgeItemKind,
      title: String(x.title ?? ""),
      author: typeof x.author === "string" ? x.author : undefined,
      url: typeof x.url === "string" ? x.url : undefined,
      note: typeof x.note === "string" ? x.note : undefined,
      status: x.status === "done" ? "done" : "todo",
      added_by: String(x.added_by ?? ""),
      added_by_name: typeof x.added_by_name === "string" ? x.added_by_name : undefined,
      read_by: Array.isArray(x.read_by) ? x.read_by.map(String) : [],
      hearts: typeof x.hearts === "number" ? x.hearts : 0,
    }))
    .filter((x) => x.title);
  return { items };
}

function parseFridgeNoteEntry(x: Record<string, unknown>): FridgeNote | null {
  const text = typeof x.text === "string" ? x.text.trim() : "";
  if (!text) return null;
  return {
    id: String(x.id ?? x.pinned_at ?? crypto.randomUUID()),
    text,
    pinned_by: String(x.pinned_by ?? ""),
    pinned_by_name: String(x.pinned_by_name ?? "Someone"),
    pinned_at: String(x.pinned_at ?? new Date().toISOString()),
    emergency: x.emergency === true,
    seen_by: Array.isArray(x.seen_by) ? x.seen_by.map(String) : [],
    stage_pinned: x.stage_pinned === true,
  };
}

function sortNotesNewest(notes: FridgeNote[]): FridgeNote[] {
  return [...notes].sort((a, b) => b.pinned_at.localeCompare(a.pinned_at));
}

/** Parse fridge notes — supports legacy single-note blobs and `{ notes: [] }`. */
export function parseFridgeNotes(raw: Record<string, unknown> | null): FridgeNotesState {
  if (!raw) return emptyFridgeNotes();

  if (Array.isArray(raw.notes)) {
    const notes = raw.notes
      .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
      .map(parseFridgeNoteEntry)
      .filter((n): n is FridgeNote => n !== null);
    return { notes: sortNotesNewest(notes) };
  }

  // Legacy: one note stored at the root of the activity state.
  const legacy = parseFridgeNoteEntry(raw);
  return legacy ? { notes: [legacy] } : emptyFridgeNotes();
}

/** Unread notes left by the partner for this viewer. */
export function unreadPartnerNotes(notes: FridgeNote[], viewerId: string): FridgeNote[] {
  return sortNotesNewest(
    notes.filter(
      (n) => n.pinned_by && n.pinned_by !== viewerId && !n.seen_by.includes(viewerId),
    ),
  );
}

/** Best note to greet the viewer with on room entry. */
export function greetingFridgeNote(notes: FridgeNote[], viewerId: string): FridgeNote | null {
  const unread = unreadPartnerNotes(notes, viewerId);
  if (!unread.length) return null;
  const urgent = unread.filter((n) => n.emergency);
  return urgent[0] ?? unread[0];
}

export function markPartnerNotesSeen(notes: FridgeNote[], viewerId: string): FridgeNote[] {
  return notes.map((n) =>
    n.pinned_by !== viewerId && !n.seen_by.includes(viewerId)
      ? { ...n, seen_by: [...new Set([...n.seen_by, viewerId])] }
      : n,
  );
}

/** @deprecated Prefer parseFridgeNotes + greetingFridgeNote. */
export function parsePinnedNote(raw: Record<string, unknown> | null): PinnedNoteState | null {
  const { notes } = parseFridgeNotes(raw);
  return notes[0] ?? null;
}

/** @deprecated Prefer unreadPartnerNotes().length > 0. */
export function shouldShowPinnedNote(note: PinnedNoteState | null, viewerId: string): boolean {
  if (!note?.text) return false;
  return !note.seen_by.includes(viewerId);
}

/* ── Last-visited tracking (localStorage) ───────────────────────── */

const LAST_VISIT_KEY_PREFIX = "dr.room_last_visit.";

export function getLastVisitedAt(roomId: string): string | null {
  try {
    return localStorage.getItem(`${LAST_VISIT_KEY_PREFIX}${roomId}`);
  } catch {
    return null;
  }
}

export function markRoomVisited(roomId: string): void {
  try {
    localStorage.setItem(`${LAST_VISIT_KEY_PREFIX}${roomId}`, new Date().toISOString());
  } catch { /* quota */ }
}

/** Count vision-board items added by someone else after `since`. */
export function newVisionBoardCount(
  board: VisionBoardState,
  _since: string | null,
): number {
  if (!_since) return board.items.length > 0 ? board.items.length : 0;
  return board.items.length;
}

/** Fridge items added by someone other than the viewer. */
export function newFridgeItems(
  fridge: FridgeState,
  viewerId: string,
): FridgeItem[] {
  return fridge.items.filter(
    (i) => i.added_by && i.added_by !== viewerId && !(i.read_by ?? []).includes(viewerId),
  );
}
