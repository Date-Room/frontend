/**
 * Persistent-room wall features — vision board, fridge/bookshelf, pinned notes.
 * Durable state lives in activity rows: vision_board, fridge, pinned_note.
 */

export type VisionBoardItem = {
  id: string;
  image_url: string;
  caption: string;
  x: number;
  y: number;
  width: number;
  shape: "rect" | "circle";
  z: number;
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

export type PinnedNoteState = {
  text: string;
  pinned_by: string;
  pinned_by_name: string;
  pinned_at: string;
  emergency?: boolean;
  seen_by: string[];
};

export function emptyVisionBoard(): VisionBoardState {
  return { items: [] };
}

export function emptyFridge(): FridgeState {
  return { items: [] };
}

export function emptyPinnedNote(): PinnedNoteState {
  return {
    text: "",
    pinned_by: "",
    pinned_by_name: "",
    pinned_at: "",
    seen_by: [],
  };
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
      shape: x.shape === "circle" ? "circle" : "rect",
      z: typeof x.z === "number" ? x.z : 1,
    }))
    .filter((x) => x.image_url);
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

export function parsePinnedNote(raw: Record<string, unknown> | null): PinnedNoteState | null {
  if (!raw || typeof raw.text !== "string" || !raw.text.trim()) return null;
  return {
    text: raw.text.trim(),
    pinned_by: String(raw.pinned_by ?? ""),
    pinned_by_name: String(raw.pinned_by_name ?? "Someone"),
    pinned_at: String(raw.pinned_at ?? new Date().toISOString()),
    emergency: raw.emergency === true,
    seen_by: Array.isArray(raw.seen_by) ? raw.seen_by.map(String) : [],
  };
}

export function shouldShowPinnedNote(note: PinnedNoteState | null, viewerId: string): boolean {
  if (!note?.text) return false;
  return !note.seen_by.includes(viewerId);
}
