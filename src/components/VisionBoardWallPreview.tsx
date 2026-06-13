import { useMemo } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { useActivitySession } from "@/hooks/useActivitySession";
import {
  parseVisionBoard,
  pickVisionGradient,
  visionMediaType,
  type VisionBoardItem,
} from "@/lib/roomWalls";
import { cn } from "@/lib/utils";

function itemHeight(item: VisionBoardItem): number {
  if (item.height) return item.height;
  if (item.shape === "circle") return item.width;
  return Math.round(item.width * 0.75);
}

function PreviewCard({ item }: { item: VisionBoardItem }) {
  const h = itemHeight(item);
  const gradient = item.gradient ?? pickVisionGradient(item.caption || item.id);
  const media = visionMediaType(item);
  const showImage = media === "image" && item.image_url.trim();

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: `${item.width}%`,
        zIndex: item.z,
      }}
    >
      <div
        className={cn(
          "relative overflow-hidden border border-white/20 shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
          item.shape === "circle" ? "rounded-full aspect-square" : "rounded-xl",
        )}
        style={item.shape === "circle" ? undefined : { aspectRatio: `${item.width} / ${h}` }}
      >
        <span
          className="absolute -top-1 left-1/2 z-10 h-2 w-2 -translate-x-1/2 rounded-full bg-amber shadow-[0_0_8px_rgba(232,157,77,0.7)]"
          aria-hidden
        />
        {showImage ? (
          <img
            src={item.image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={cn("h-full w-full bg-gradient-to-br", gradient)} />
        )}
      </div>
      {item.caption && (
        <p className="mt-1.5 px-0.5 text-center font-serif text-[11px] italic leading-snug text-cream/85">
          {item.caption}
        </p>
      )}
    </div>
  );
}

type Props = {
  onOpen: () => void;
};

/** Vision board preview on the permanent-room home — tap to open full editor. */
export function VisionBoardWallPreview({ onOpen }: Props) {
  const { state: durable, ready } = useActivitySession("vision_board");
  const board = useMemo(() => parseVisionBoard(durable), [durable]);
  const items = board.items;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="perm-wall-frame group w-full text-left transition hover:border-amber/25 hover:shadow-[0_28px_70px_rgba(0,0,0,0.45)]"
    >
      <div className="perm-wall-header">
        <div>
          <p className="perm-wall-kicker">Our wall</p>
          <p className="perm-wall-title">The life we&apos;re building</p>
        </div>
        <span className="perm-wall-open">
          Open &amp; edit
          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="perm-wall-canvas">
        {!ready ? (
          <div className="flex h-full min-h-[240px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-amber/70" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
            <p className="font-serif text-base italic text-cream/55">Pin your first dream together</p>
            <p className="mt-2 text-xs text-cream/40">Tap to add photos, words, and goals</p>
          </div>
        ) : (
          items
            .slice()
            .sort((a, b) => a.z - b.z)
            .map((item) => <PreviewCard key={item.id} item={item} />)
        )}
      </div>
    </button>
  );
}
