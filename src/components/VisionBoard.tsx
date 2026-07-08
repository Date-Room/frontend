import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  FileDown,
  FileText,
  HelpCircle,
  ImagePlus,
  Loader2,
  Pencil,
  Pin,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { ApiError } from "@/lib/api";
import {
  parseVisionBoard,
  pickVisionGradient,
  visionMediaType,
  type VisionBoardItem,
  type VisionBoardState,
  type VisionMediaType,
} from "@/lib/roomWalls";
import { cn } from "@/lib/utils";

type ShapePreset = "rect" | "circle" | "wide" | "tall";
type PhotoMode = "upload" | "link";
type BoardMode = "board" | "add" | "edit";

const DRAG_THRESHOLD_PX = 8;
const MAX_IMAGE_BYTES = 900_000;
const MAX_PDF_BYTES = 2_500_000;
/** How many vision items may be pinned onto the room stage at once. */
const MAX_STAGE_PINS = 2;

const SHAPE_PRESETS: Record<ShapePreset, { width: number; height: number; shape: "rect" | "circle" }> = {
  rect: { width: 24, height: 28, shape: "rect" },
  circle: { width: 22, height: 22, shape: "circle" },
  wide: { width: 36, height: 18, shape: "rect" },
  tall: { width: 18, height: 34, shape: "rect" },
};

const DREAM_STARTERS: { caption: string; shape: ShapePreset }[] = [
  { caption: "Kyoto in the spring", shape: "circle" },
  { caption: "A porch like this one", shape: "tall" },
  { caption: "Our someday kitchen", shape: "wide" },
  { caption: "The trip we're saving for", shape: "rect" },
];

function presetFromItem(item: VisionBoardItem): ShapePreset {
  if (item.shape === "circle") return "circle";
  if (item.width >= 34) return "wide";
  if (item.height && item.height >= 30) return "tall";
  return "rect";
}

function nextZ(items: VisionBoardItem[]): number {
  return items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
}

function itemHeight(item: VisionBoardItem): number {
  if (item.height) return item.height;
  if (item.shape === "circle") return item.width;
  return Math.round(item.width * 0.75);
}

function defaultPlacement(index: number): { x: number; y: number } {
  const spots = [
    { x: 6, y: 10 },
    { x: 38, y: 6 },
    { x: 62, y: 28 },
    { x: 14, y: 48 },
    { x: 48, y: 52 },
    { x: 70, y: 58 },
  ];
  return spots[index % spots.length];
}

function resolveMediaType(url: string, uploadType: VisionMediaType | null): VisionMediaType {
  if (uploadType) return uploadType;
  if (!url.trim()) return "none";
  if (url.startsWith("data:application/pdf") || /\.pdf(\?|#|$)/i.test(url)) return "pdf";
  return "image";
}

/** A single dream in the gallery grid — image-forward card with a caption
 *  scrim and hover actions. Not draggable (only pinned items are, out on the
 *  room stage). */
function VisionGridCard({
  item,
  canEdit,
  pinDisabled,
  onView,
  onEdit,
  onRemove,
  onTogglePin,
}: {
  item: VisionBoardItem;
  canEdit: boolean;
  pinDisabled: boolean;
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onTogglePin: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const gradient = item.gradient ?? pickVisionGradient(item.caption || item.id);
  const media = visionMediaType(item);
  const showImage = media === "image" && item.image_url.trim() && !imgFailed;
  const label = item.caption || item.filename || (media === "pdf" ? "Document" : "Dream");

  return (
    <div
      className={cn(
        "group relative aspect-[4/5] overflow-hidden rounded-2xl border shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]",
        item.pinned ? "border-primary/50 ring-1 ring-primary/30" : "border-white/[0.1]",
      )}
    >
      <button
        type="button"
        onClick={onView}
        className="absolute inset-0 h-full w-full"
        aria-label={`View ${label}`}
      >
        {showImage ? (
          <img
            src={item.image_url}
            alt={label}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            loading="lazy"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : media === "pdf" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-950/90 via-[#2a1810] to-indigo-950/80 px-3">
            <FileText className="h-8 w-8 text-amber/80" strokeWidth={1.25} />
            <p className="max-w-full truncate text-center text-[11px] text-cream/70">
              {item.filename || "PDF document"}
            </p>
          </div>
        ) : (
          <div className={cn("h-full w-full bg-gradient-to-br", gradient)} />
        )}
      </button>

      {/* Caption scrim */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-3 pb-2.5 pt-8">
        <p className="truncate text-sm font-medium text-cream drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
          {label}
        </p>
        {item.added_by_name ? (
          <p className="truncate text-[10px] uppercase tracking-[0.16em] text-cream/55">
            {item.added_by_name}
          </p>
        ) : null}
      </div>

      {/* Pinned marker */}
      {item.pinned && (
        <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[#1a1207] shadow">
          <Pin className="h-3.5 w-3.5 fill-current" />
        </span>
      )}

      {/* Hover actions */}
      {canEdit && (
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={onTogglePin}
            disabled={pinDisabled}
            aria-pressed={item.pinned}
            title={item.pinned ? "Unpin from room" : pinDisabled ? "Two dreams already pinned" : "Pin to room"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition disabled:opacity-35",
              item.pinned ? "bg-primary text-[#1a1207]" : "bg-black/50 text-cream hover:bg-black/70",
            )}
          >
            <Pin className={cn("h-4 w-4", item.pinned && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-cream backdrop-blur-md transition hover:bg-black/70"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-cream backdrop-blur-md transition hover:bg-red-500/70"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function MediaViewer({
  item,
  canEdit,
  onClose,
  onEdit,
  onRemove,
}: {
  item: VisionBoardItem;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const media = visionMediaType(item);
  const url = item.image_url.trim();
  const label = item.caption || item.filename || (media === "pdf" ? "Document" : "Dream");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#120e0c] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-serif italic text-cream">{label}</p>
            {item.filename && media === "pdf" && (
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {item.filename}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-cream hover:bg-white/5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-1 rounded-full border border-red-400/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                download={item.filename || undefined}
                className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-xs text-amber hover:bg-amber/20"
              >
                <FileDown className="h-3.5 w-3.5" />
                Open
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-white/5 hover:text-cream"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-[240px] flex-1 items-center justify-center overflow-auto bg-black/40 p-4">
          {media === "pdf" && url ? (
            <iframe
              title={label}
              src={url}
              className="h-[70vh] w-full rounded-lg border border-white/10 bg-white"
            />
          ) : media === "image" && url ? (
            <img
              src={url}
              alt={label}
              className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-lg"
            />
          ) : (
            <div
              className={cn(
                "flex h-48 w-full max-w-sm items-center justify-center rounded-2xl bg-gradient-to-br px-6 text-center text-lg font-medium text-cream/90",
                item.gradient ?? pickVisionGradient(item.caption || item.id),
              )}
            >
              {item.caption || "Your dream"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VisionCard({
  item,
  isDragging,
  canEdit,
  onDragStart,
  onView,
  onEdit,
  onRemove,
}: {
  item: VisionBoardItem;
  isDragging: boolean;
  canEdit: boolean;
  onDragStart: (e: React.PointerEvent) => void;
  onView: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const h = itemHeight(item);
  const gradient = item.gradient ?? pickVisionGradient(item.caption || item.id);
  const media = visionMediaType(item);
  const showImage = media === "image" && item.image_url.trim() && !imgFailed;

  return (
    <div
      className={cn(
        "absolute group touch-none select-none",
        canEdit && "cursor-pointer",
        isDragging && "z-50 scale-[1.02]",
      )}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: `${item.width}%`,
        zIndex: isDragging ? 999 : item.z,
      }}
      onPointerDown={canEdit ? onDragStart : undefined}
    >
      <div className="relative">
        <span
          className="absolute -top-1.5 left-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-amber shadow-[0_0_10px_hsl(var(--primary)/0.7)]"
          aria-hidden
        />
        {media === "pdf" && (
          <span className="absolute right-1 top-1 z-20 rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber">
            PDF
          </span>
        )}
        <div
          className={cn(
            "relative overflow-hidden border border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.5)]",
            item.shape === "circle" ? "rounded-full aspect-square" : "rounded-2xl",
            canEdit && "cursor-grab active:cursor-grabbing",
          )}
          style={item.shape === "circle" ? undefined : { aspectRatio: `${item.width} / ${h}` }}
        >
          {showImage ? (
            <img
              src={item.image_url}
              alt={item.caption || "Shared dream"}
              className="h-full w-full object-cover pointer-events-none"
              loading="lazy"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : media === "pdf" ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-950/90 via-[#2a1810] to-indigo-950/80 px-2">
              <FileText className="h-8 w-8 text-amber/80" strokeWidth={1.25} />
              <p className="max-w-full truncate text-center text-[10px] font-medium text-cream/80">
                {item.filename || "PDF document"}
              </p>
            </div>
          ) : (
            <div className={cn("relative h-full w-full bg-gradient-to-br", gradient)}>
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 70% 80%, rgba(255,200,150,0.25), transparent 40%)",
                }}
              />
            </div>
          )}

          {canEdit && (
            <div
              className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/75 to-transparent p-2 opacity-0 transition group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                className="rounded-full bg-black/60 p-1.5 text-cream hover:bg-black/80"
                title="View"
                aria-label="View"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full bg-black/60 p-1.5 text-cream hover:bg-black/80"
                title="Edit"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="rounded-full bg-black/60 p-1.5 text-cream hover:bg-red-500/80"
                title="Remove"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
      {item.caption && (
        <p className="mt-2 px-1 text-center text-sm leading-snug text-cream/90 pointer-events-none">
          {item.caption}
        </p>
      )}
    </div>
  );
}

type DreamFormProps = {
  title: string;
  caption: string;
  setCaption: (v: string) => void;
  photoMode: PhotoMode;
  setPhotoMode: (v: PhotoMode) => void;
  imageUrl: string;
  setImageUrl: (v: string) => void;
  uploadDataUrl: string;
  setUploadDataUrl: (v: string) => void;
  uploadMediaType: VisionMediaType | null;
  uploadFilename: string;
  shapePreset: ShapePreset;
  setShapePreset: (v: ShapePreset) => void;
  canPin: boolean;
  saving: boolean;
  submitLabel: string;
  onSubmit: (e?: React.FormEvent) => void;
  onFilePick: (file: File | null) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  showStarters?: boolean;
  onStarter?: (starter: { caption: string; shape: ShapePreset }) => void;
};

function DreamForm({
  title,
  caption,
  setCaption,
  photoMode,
  setPhotoMode,
  imageUrl,
  setImageUrl,
  uploadDataUrl,
  uploadMediaType,
  uploadFilename,
  shapePreset,
  setShapePreset,
  canPin,
  saving,
  submitLabel,
  onSubmit,
  onFilePick,
  fileRef,
  showStarters,
  onStarter,
}: DreamFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-base font-medium text-amber">{title}</p>

      {showStarters && onStarter && (
        <div className="flex flex-wrap gap-2">
          {DREAM_STARTERS.map((d) => (
            <button
              key={d.caption}
              type="button"
              disabled={saving}
              onClick={() => onStarter(d)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-cream/80 transition hover:border-amber/40 hover:text-cream"
            >
              <Sparkles className="mr-1 inline h-3 w-3 text-amber" />
              {d.caption}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="A porch like this one…"
          className="bg-secondary/50 border-white/10 text-base"
        />

        <div className="flex gap-2">
          <button type="button" onClick={() => setPhotoMode("upload")} className="wall-kind-chip" data-active={photoMode === "upload"}>
            <Upload className="h-3.5 w-3.5" />
            Upload file
          </button>
          <button type="button" onClick={() => setPhotoMode("link")} className="wall-kind-chip" data-active={photoMode === "link"}>
            <ImagePlus className="h-3.5 w-3.5" />
            Paste link
          </button>
        </div>

        {photoMode === "upload" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => onFilePick(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-sm text-muted-foreground hover:border-amber/30 hover:text-cream"
            >
              {uploadDataUrl
                ? uploadMediaType === "pdf"
                  ? "PDF chosen — tap to replace"
                  : "Photo chosen — tap to replace"
                : "Choose a photo or PDF from your device"}
            </button>
            {uploadDataUrl && uploadMediaType === "image" && (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
                <img src={uploadDataUrl} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            {uploadDataUrl && uploadMediaType === "pdf" && (
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-amber/15 ring-1 ring-white/10">
                <FileText className="h-5 w-5 text-amber" />
                <span className="mt-0.5 text-[8px] text-cream/70">PDF</span>
              </div>
            )}
            {uploadFilename && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{uploadFilename}</p>
            )}
          </div>
        ) : (
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://… photo or PDF link (optional)"
            className="bg-secondary/50 border-white/10"
          />
        )}

        <div className="flex flex-wrap gap-2">
          {(Object.keys(SHAPE_PRESETS) as ShapePreset[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShapePreset(s)}
              className="wall-kind-chip"
              data-active={shapePreset === s}
            >
              {s === "rect" ? "Rectangle" : s === "circle" ? "Circle" : s === "wide" ? "Wide" : "Tall"}
            </button>
          ))}
        </div>

        <button
          type="submit"
          className="wall-cta inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          disabled={!canPin || saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </button>
      </form>
    </div>
  );
}

/** Shared couples vision board — pin dreams, photos, and captions together. */
export function VisionBoard() {
  const room = useRoomSession();
  const { session, state: durable, ready } = useActivitySession("vision_board");
  const canvasRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const board = useMemo(() => parseVisionBoard(durable), [durable]);
  const [localItems, setLocalItems] = useState<VisionBoardItem[] | null>(null);
  const items = localItems ?? board.items;

  const [mode, setMode] = useState<BoardMode>("board");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState<PhotoMode>("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadDataUrl, setUploadDataUrl] = useState("");
  const [uploadMediaType, setUploadMediaType] = useState<VisionMediaType | null>(null);
  const [uploadFilename, setUploadFilename] = useState("");
  const [caption, setCaption] = useState("");
  const [shapePreset, setShapePreset] = useState<ShapePreset>("rect");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const viewingItem = useMemo(
    () => (viewingId ? items.find((i) => i.id === viewingId) ?? null : null),
    [viewingId, items],
  );

  const editingItem = useMemo(
    () => (mode === "edit" ? items.find((i) => i.id === editingId) : null),
    [mode, editingId, items],
  );

  const resetForm = useCallback(() => {
    setCaption("");
    setImageUrl("");
    setUploadDataUrl("");
    setUploadMediaType(null);
    setUploadFilename("");
    setShapePreset("rect");
    setPhotoMode("upload");
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    setEditingId(null);
    setMode("add");
  }, [resetForm]);

  const backToBoard = useCallback(() => {
    setMode("board");
    setEditingId(null);
    setViewingId(null);
    resetForm();
  }, [resetForm]);

  const openEdit = useCallback((item: VisionBoardItem) => {
    setViewingId(null);
    setEditingId(item.id);
    setCaption(item.caption);
    setImageUrl(item.image_url.startsWith("data:") ? "" : item.image_url);
    setUploadDataUrl(item.image_url.startsWith("data:") ? item.image_url : "");
    setUploadMediaType(item.image_url ? visionMediaType(item) : null);
    setUploadFilename(item.filename ?? "");
    setShapePreset(presetFromItem(item));
    setPhotoMode(item.image_url.startsWith("data:") ? "upload" : item.image_url ? "link" : "upload");
    setMode("edit");
  }, []);

  const openView = useCallback((item: VisionBoardItem) => {
    setViewingId(item.id);
  }, []);

  const persist = useCallback(
    async (next: VisionBoardState, optimistic = true) => {
      if (!session) {
        toast.error("Still connecting — try again in a moment.");
        return false;
      }
      if (!room.canPersist) {
        toast.error("Sign in to pin to your shared board.");
        return false;
      }
      if (optimistic) setLocalItems(next.items);
      setSaving(true);
      try {
        await session.persist(next as unknown as Record<string, unknown>, {
          event_type: "vision_board_updated",
          payload: { item_count: next.items.length },
        });
        setLocalItems(null);
        return true;
      } catch (e) {
        setLocalItems(null);
        toast.error(e instanceof ApiError ? e.message : "Could not save to the board.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [session, room.canPersist],
  );

  async function addItem(e?: React.FormEvent, starter?: { caption: string; shape: ShapePreset }) {
    e?.preventDefault();
    const cap = (starter?.caption ?? caption).trim();
    const url = uploadDataUrl || imageUrl.trim();
    if (!cap && !url) {
      toast.message("Add a few words, a photo, or a PDF — that's your dream.");
      return;
    }
    const preset = SHAPE_PRESETS[starter?.shape ?? shapePreset];
    const spot = defaultPlacement(items.length);
    const mediaType = resolveMediaType(url, uploadMediaType);
    const newItem: VisionBoardItem = {
      id: crypto.randomUUID(),
      image_url: url,
      caption: cap,
      x: spot.x,
      y: spot.y,
      width: preset.width,
      height: preset.height,
      shape: preset.shape,
      z: nextZ(items),
      gradient: pickVisionGradient(cap || url),
      media_type: mediaType,
      filename: uploadFilename || undefined,
      added_by: room.senderId,
      added_by_name: room.displayName,
    };
    const ok = await persist({ items: [...items, newItem] });
    if (ok) {
      resetForm();
      setMode("board");
      toast.success("Added to your board");
    }
  }

  async function saveEdit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!editingItem) return;
    const cap = caption.trim();
    const url = uploadDataUrl || imageUrl.trim();
    if (!cap && !url) {
      toast.message("Keep a caption, photo, or PDF on the card.");
      return;
    }
    const preset = SHAPE_PRESETS[shapePreset];
    const mediaType = resolveMediaType(url, uploadMediaType);
    const nextItems = items.map((i) =>
      i.id === editingItem.id
        ? {
            ...i,
            caption: cap,
            image_url: url,
            width: preset.width,
            height: preset.height,
            shape: preset.shape,
            gradient: pickVisionGradient(cap || url),
            media_type: mediaType,
            filename: uploadFilename || i.filename,
          }
        : i,
    );
    const ok = await persist({ items: nextItems });
    if (ok) {
      backToBoard();
      toast.success("Dream updated");
    }
  }

  async function removeItem(id: string) {
    const ok = await persist({ items: items.filter((i) => i.id !== id) });
    if (ok) {
      setViewingId(null);
      backToBoard();
      toast.success("Removed from the board");
    }
  }

  async function togglePin(item: VisionBoardItem) {
    const willPin = !item.pinned;
    if (willPin && pinnedCount >= MAX_STAGE_PINS) {
      toast.message(`Only ${MAX_STAGE_PINS} dreams can sit on the stage — unpin one first.`);
      return;
    }
    const ok = await persist({
      items: items.map((i) => (i.id === item.id ? { ...i, pinned: willPin } : i)),
    });
    if (ok) toast.success(willPin ? "Pinned to the room" : "Unpinned");
  }

  function startDrag(item: VisionBoardItem, e: React.PointerEvent) {
    if (!room.canPersist || !canvasRef.current || mode !== "board") return;
    e.preventDefault();
    const canvas = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = item.x;
    const originY = item.y;
    let dragging = false;

    function onMove(ev: PointerEvent) {
      const dxPx = ev.clientX - startX;
      const dyPx = ev.clientY - startY;
      if (!dragging && Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;

      if (!dragging) {
        dragging = true;
        setDraggingId(item.id);
        setLocalItems(items);
      }

      const dx = (dxPx / canvas.width) * 100;
      const dy = (dyPx / canvas.height) * 100;
      setLocalItems((prev) => {
        const base = prev ?? items;
        return base.map((i) =>
          i.id === item.id
            ? {
                ...i,
                x: Math.min(90, Math.max(0, originX + dx)),
                y: Math.min(82, Math.max(0, originY + dy)),
                z: nextZ(base),
              }
            : i,
        );
      });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      if (dragging) {
        setDraggingId(null);
        setLocalItems((current) => {
          if (current) void persist({ items: current }, false);
          return null;
        });
      } else {
        openView(item);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function onFilePick(file: File | null) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isPdf) {
      toast.error("Pick a photo (JPEG, PNG, WebP) or PDF.");
      return;
    }
    const maxSize = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxSize) {
      toast.error(
        isPdf
          ? "PDF is too large — try one under 2.5 MB."
          : "Photo is too large — try one under 900 KB.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadDataUrl(reader.result);
        setUploadMediaType(isPdf ? "pdf" : "image");
        setUploadFilename(file.name);
        setPhotoMode("upload");
      }
    };
    reader.readAsDataURL(file);
  }

  function exportPdf() {
    if (!boardRef.current || items.length === 0) {
      toast.message("Pin something first, then export.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Allow pop-ups to export the board.");
      return;
    }
    printWindow.document.write(`
      <html><head><title>Our Vision Board</title>
      <style>
        body { font-family: Georgia, serif; padding: 32px; background: #f5f0e8; }
        h1 { text-align: center; font-weight: normal; font-style: italic; }
      </style></head><body>
      <h1>The life we're building</h1>
      ${boardRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const empty = items.length === 0;
  const canPin = caption.trim() || uploadDataUrl || imageUrl.trim();
  const pinnedCount = items.filter((i) => i.pinned).length;
  const showBoard = mode === "board" || (mode === "add" && !empty);

  if (!ready) {
    return (
      <div className="wall-surface flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber" aria-hidden />
      </div>
    );
  }

  if (empty && mode === "board") {
    return (
      <div className="wall-surface">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-5 h-14 w-14 overflow-hidden rounded-lg ring-1 ring-white/10">
            <div className="h-full w-full bg-gradient-to-br from-amber/40 via-rose-400/30 to-indigo-500/40" />
          </div>
          <h2 className="font-serif text-2xl italic text-cream">Vision Board</h2>
          <div className="wall-empty-copy mt-5 space-y-4">
            <p>Add photos, PDFs, or words for the life you&apos;re building — trips, a home, a feeling, a goal.</p>
            <p>Tap any dream to view, edit, or remove — and pin up to two onto the room.</p>
          </div>
          {room.canPersist ? (
            <button type="button" className="wall-cta mt-8" onClick={openAdd}>
              Start pinning
            </button>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Sign in to add to your shared board.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="wall-surface relative">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3 shrink-0">
        <div className="min-w-0">
          {mode !== "board" ? (
            <button
              type="button"
              onClick={backToBoard}
              className="mb-1 inline-flex items-center gap-1.5 text-sm text-amber hover:text-cream"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to board
            </button>
          ) : null}
          <p className="font-serif italic text-cream text-base sm:text-lg truncate">
            {mode === "add" ? "Pin a new dream" : mode === "edit" ? "Edit dream" : "The life we're building"}
          </p>
          {mode === "board" && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
              {items.length} dream{items.length === 1 ? "" : "s"}
              {pinnedCount > 0 ? ` · ${pinnedCount}/${MAX_STAGE_PINS} pinned` : " · tap to view"}
            </p>
          )}
        </div>
        {mode === "board" && (
          <div className="flex items-center gap-1.5 shrink-0">
            {room.canPersist && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/15 px-3 py-1.5 text-[11px] font-semibold text-amber"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            )}
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-cream"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </button>
            <button
              type="button"
              aria-label="Help"
              title="Tap a dream to view. Pin up to two onto the room. Hover for edit & remove."
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-muted-foreground hover:text-cream"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Add / edit panel — replaces board while editing */}
      {mode === "add" && room.canPersist && (
        <div className="border-b border-white/[0.06] p-4 shrink-0">
          <DreamForm
            title="What are you dreaming about?"
            caption={caption}
            setCaption={setCaption}
            photoMode={photoMode}
            setPhotoMode={setPhotoMode}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            uploadDataUrl={uploadDataUrl}
            setUploadDataUrl={setUploadDataUrl}
            uploadMediaType={uploadMediaType}
            uploadFilename={uploadFilename}
            shapePreset={shapePreset}
            setShapePreset={setShapePreset}
            canPin={!!canPin}
            saving={saving}
            submitLabel="Pin to the board"
            onSubmit={addItem}
            onFilePick={onFilePick}
            fileRef={fileRef}
            showStarters
            onStarter={(d) => void addItem(undefined, d)}
          />
        </div>
      )}

      {mode === "edit" && editingItem && room.canPersist && (
        <div className="border-b border-white/[0.06] p-4 shrink-0">
          <DreamForm
            title={`Editing “${editingItem.caption || editingItem.filename || "your dream"}”`}
            caption={caption}
            setCaption={setCaption}
            photoMode={photoMode}
            setPhotoMode={setPhotoMode}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            uploadDataUrl={uploadDataUrl}
            setUploadDataUrl={setUploadDataUrl}
            uploadMediaType={uploadMediaType}
            uploadFilename={uploadFilename}
            shapePreset={shapePreset}
            setShapePreset={setShapePreset}
            canPin={!!canPin}
            saving={saving}
            submitLabel="Save changes"
            onSubmit={saveEdit}
            onFilePick={onFilePick}
            fileRef={fileRef}
          />
          <button
            type="button"
            onClick={() => void removeItem(editingItem.id)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-red-400/30 py-2 text-sm text-red-300/90 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Remove from board
          </button>
        </div>
      )}

      {/* Board — a clean, scrollable list of dreams with images. Items only
          become draggable once pinned onto the room stage. */}
      {showBoard && (
        <div className={cn("flex-1 min-h-0 overflow-auto p-3 sm:p-4", mode !== "board" && "max-h-[220px] opacity-80")}>
          <div
            ref={boardRef}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {items.map((item) => (
              <VisionGridCard
                key={item.id}
                item={item}
                canEdit={room.canPersist && mode === "board"}
                pinDisabled={!item.pinned && pinnedCount >= MAX_STAGE_PINS}
                onView={() => openView(item)}
                onEdit={() => openEdit(item)}
                onRemove={() => void removeItem(item.id)}
                onTogglePin={() => void togglePin(item)}
              />
            ))}
          </div>
        </div>
      )}

      {viewingItem && mode === "board" && (
        <MediaViewer
          item={viewingItem}
          canEdit={room.canPersist}
          onClose={() => setViewingId(null)}
          onEdit={() => openEdit(viewingItem)}
          onRemove={() => void removeItem(viewingItem.id)}
        />
      )}

      {/* Floating add on board view (mobile-friendly) */}
      {mode === "board" && room.canPersist && items.length > 0 && (
        <button
          type="button"
          onClick={openAdd}
          className="absolute bottom-6 right-4 z-20 flex items-center gap-2 rounded-full bg-amber px-4 py-2.5 text-sm font-semibold text-[#1a120c] shadow-[0_8px_32px_hsl(var(--primary)/0.45)] transition hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          Pin another
        </button>
      )}
    </div>
  );
}
