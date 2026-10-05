/**
 * Position-and-zoom cropper for a picked profile photo.
 *
 * Mirrors the mobile crop screen: a square window over the photo, drag to
 * move, pinch/scroll/slider to zoom, and the cut is whatever the window is
 * showing. The geometry lives in `lib/avatarCrop.ts`, which is unit-tested.
 *
 * The preview is a canvas drawn from the decoded bitmap rather than a CSS
 * transform on an <img>: the same `avatarCropRect` that produces the final
 * cut also produces the preview, so what the user frames can't disagree
 * with what gets saved.
 */

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AVATAR_MAX_ZOOM,
  applyAvatarGesture,
  avatarBaseScale,
  avatarCropRect,
  type Point,
} from "@/lib/avatarCrop";
import {
  AvatarImageError,
  assertValidAvatarFile,
  type DecodedImage,
  decodeAvatarImage,
  renderAvatarCrop,
} from "@/lib/avatarImage";

/** Window side in CSS px. Comfortably inside the dialog at phone width. */
const VIEWPORT = 272;

type Props = {
  /** The picked file, or null when the dialog is closed. */
  file: File | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

export default function AvatarCropDialog({ file, onCancel, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const decodedRef = useRef<DecodedImage | null>(null);
  // Live gesture state is kept in refs, not state: a pointermove must read
  // the latest offset, and a React state update isn't visible until the next
  // render — reading stale state here is what makes a drag feel like it
  // springs back.
  const zoomRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const gestureStart = useRef<{ zoom: number; distance: number } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(() => {
    const decoded = decodedRef.current;
    const canvas = canvasRef.current;
    if (!decoded || !canvas) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const px = Math.round(VIEWPORT * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = avatarBaseScale(decoded.width, decoded.height, VIEWPORT) * zoomRef.current;
    const rect = avatarCropRect({
      imageWidth: decoded.width,
      imageHeight: decoded.height,
      viewport: VIEWPORT,
      scale,
      offset: offsetRef.current,
    });
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(decoded.source, rect.left, rect.top, rect.width, rect.height, 0, 0, px, px);
  }, []);

  // Decode on open. Cancelled flag because a user can pick a second photo
  // while the first is still decoding.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setReady(false);
    setError(null);
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(1);
    (async () => {
      try {
        assertValidAvatarFile(file);
        const decoded = await decodeAvatarImage(file);
        if (cancelled) {
          decoded.close();
          return;
        }
        decodedRef.current = decoded;
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof AvatarImageError ? e.message : "Couldn't open that photo. Try another.",
        );
      }
    })();
    return () => {
      cancelled = true;
      decodedRef.current?.close();
      decodedRef.current = null;
    };
  }, [file]);

  // Draw once the bitmap is in and the canvas is mounted.
  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  const nudge = useCallback(
    (panDelta: Point, scaleFactor: number, zoomAtStart: number) => {
      const decoded = decodedRef.current;
      if (!decoded) return;
      const next = applyAvatarGesture({
        imageWidth: decoded.width,
        imageHeight: decoded.height,
        viewport: VIEWPORT,
        zoomAtStart,
        scaleFactor,
        offset: offsetRef.current,
        panDelta,
      });
      zoomRef.current = next.zoom;
      offsetRef.current = next.offset;
      setZoom(next.zoom);
      draw();
    },
    [draw],
  );

  function centreOf(points: Point[]): Point {
    const sum = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  function spread(points: Point[]): number {
    const [a, b] = points;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...pointers.current.values()];
    gestureStart.current =
      points.length >= 2
        ? { zoom: zoomRef.current, distance: spread(points) }
        : { zoom: zoomRef.current, distance: 0 };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const previous = pointers.current.get(e.pointerId);
    if (!previous || !gestureStart.current) return;
    const current = { x: e.clientX, y: e.clientY };
    const before = [...pointers.current.values()];
    pointers.current.set(e.pointerId, current);
    const after = [...pointers.current.values()];

    if (after.length >= 2) {
      // Pan by how far the midpoint moved, zoom by how much the fingers
      // spread relative to where the pinch began.
      const from = centreOf(before);
      const to = centreOf(after);
      const start = gestureStart.current;
      const factor = start.distance > 0 ? spread(after) / start.distance : 1;
      nudge({ x: to.x - from.x, y: to.y - from.y }, factor, start.zoom);
      return;
    }
    // Single pointer: the delta since the last move, at the current zoom.
    nudge({ x: current.x - previous.x, y: current.y - previous.y }, 1, zoomRef.current);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    const points = [...pointers.current.values()];
    // Re-baseline so lifting one finger of a pinch doesn't jump the zoom.
    gestureStart.current =
      points.length >= 2
        ? { zoom: zoomRef.current, distance: spread(points) }
        : { zoom: zoomRef.current, distance: 0 };
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    if (!ready) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    nudge({ x: 0, y: 0 }, factor, zoomRef.current);
  }

  function setZoomTo(next: number) {
    const current = zoomRef.current;
    if (current <= 0) return;
    nudge({ x: 0, y: 0 }, next / current, current);
  }

  function confirm() {
    const decoded = decodedRef.current;
    if (!decoded) return;
    try {
      const scale = avatarBaseScale(decoded.width, decoded.height, VIEWPORT) * zoomRef.current;
      const rect = avatarCropRect({
        imageWidth: decoded.width,
        imageHeight: decoded.height,
        viewport: VIEWPORT,
        scale,
        offset: offsetRef.current,
      });
      onConfirm(renderAvatarCrop(decoded, rect));
    } catch (e) {
      setError(e instanceof AvatarImageError ? e.message : "Couldn't save that crop.");
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm border-border bg-card p-0 text-cream">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="font-serif text-lg italic text-cream">Frame your photo</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5">
          <div
            className="relative mx-auto overflow-hidden rounded-full border border-border bg-secondary/60"
            style={{ width: VIEWPORT, height: VIEWPORT }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
              // touch-none so a drag moves the photo instead of scrolling
              // the dialog out from under the finger.
              className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
              style={{ width: VIEWPORT, height: VIEWPORT }}
              aria-label="Drag to position, pinch or scroll to zoom"
            />
            {!ready && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <label className="mt-4 flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={AVATAR_MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!ready}
              onChange={(e) => setZoomTo(Number(e.target.value))}
              className="h-1 flex-1 accent-primary"
            />
          </label>

          {error && <p className="mt-3 text-sm text-rose">{error}</p>}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-[1.15rem] border border-border py-3 text-sm font-medium text-muted-foreground transition hover:text-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!ready}
              className="btn-primary flex-1 rounded-[1.15rem] py-3 text-sm font-semibold disabled:opacity-50"
            >
              Use photo
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
