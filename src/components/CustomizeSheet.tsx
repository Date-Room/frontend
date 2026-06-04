/**
 * Bottom sheet for picking a theme color + background for any room.
 * Mirrors mobile's `customize_sheet.dart`.
 *
 * Defaults / 'Original' semantics:
 *   - First theme swatch = "Original" — saves theme_color: null and
 *     the room falls back to the default DateRoom amber palette.
 *   - First background tile = "Original" — saves background_id: null
 *     and the room renders the default ambient gradient (NOT transparent).
 *     The tile preview shows that gradient so the user knows what they're
 *     getting.
 *   - Live preview card sits above the swatch row and re-renders the
 *     moment a swatch / background tile is tapped.
 *
 * Saves on each tap so the partner sees the change on their next
 * room state refresh.
 */
import { useState } from "react";
import { Sparkles, Check, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { updateRoom } from "@/lib/rooms";
import {
  roomThemes,
  roomBackgrounds,
  defaultTheme,
  themeForId,
  backgroundForId,
  backgroundGradient,
} from "@/lib/roomTheme";

type Props = {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialThemeId: string | null;
  initialBackgroundId: string | null;
  /** Notify the parent once the server-side patch lands so it can
   *  re-fetch / re-render with the chosen colour. */
  onSaved?: (patch: { theme_color: string | null; background_id: string | null }) => void;
};

export function CustomizeSheet({
  roomId,
  open,
  onOpenChange,
  initialThemeId,
  initialBackgroundId,
  onSaved,
}: Props) {
  const [themeId, setThemeId] = useState<string | null>(initialThemeId);
  const [backgroundId, setBackgroundId] = useState<string | null>(initialBackgroundId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-save serial so a stale tap doesn't squash a newer tap's state
  // once the request returns. Mirrors mobile's `_saveSeq`.
  const [, setSeq] = useState(0);

  async function saveTheme(next: string | null) {
    const mySeq = Date.now();
    setSeq(mySeq);
    setThemeId(next);
    setSaving(true);
    setError(null);
    try {
      await updateRoom(roomId, { theme_color: next });
      onSaved?.({ theme_color: next, background_id: backgroundId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the theme.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBackground(next: string | null) {
    const mySeq = Date.now();
    setSeq(mySeq);
    setBackgroundId(next);
    setSaving(true);
    setError(null);
    try {
      await updateRoom(roomId, { background_id: next });
      onSaved?.({ theme_color: themeId, background_id: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the background.");
    } finally {
      setSaving(false);
    }
  }

  const theme = themeForId(themeId);
  const bg = backgroundForId(backgroundId);
  const previewGradient = backgroundGradient(backgroundId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-white/[0.06] bg-[#1A1410] text-cream max-h-[88vh] overflow-y-auto rounded-t-3xl"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="text-cream">Customize the room</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            The look applies to both sides. Saves as you tap.
          </SheetDescription>
        </SheetHeader>

        {/* Live preview — re-renders on every tap so users pick against
            the actual outcome rather than guessing from swatches. */}
        <div className="mt-4">
          <div
            className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10"
            style={{ background: previewGradient }}
          >
            {/* Centred preview avatars (one in-call, one idle) so users
                can read the accent halo against the chosen background. */}
            <div className="absolute inset-0 flex items-center justify-center gap-3">
              <PreviewAvatar accent={theme.accent} inCall={false} />
              <PreviewAvatar accent={theme.accent} inCall={true} />
            </div>
            {/* Themed CTA pill at the bottom — same shape Main uses. */}
            <div
              className="absolute bottom-3 left-3 right-3 flex h-8 items-center justify-center rounded-[10px] border text-[12px] font-semibold tracking-wide"
              style={{
                color: theme.accent,
                backgroundColor: `${theme.accent}2E`,
                borderColor: `${theme.accent}80`,
              }}
            >
              Start the call
            </div>
            {/* Theme + background label */}
            <div className="absolute left-2.5 top-2.5 rounded-md bg-black/40 px-2 py-1 text-[10px] tracking-wider text-cream">
              {bg ? `${theme.label} · ${bg.label}` : theme.label}
            </div>
          </div>
        </div>

        {/* Theme color */}
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Theme color
        </p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {/* 'Original' — clears the override, default DateRoom theme. */}
          <OriginalThemeSwatch
            selected={themeId === null}
            onClick={() => void saveTheme(null)}
            accent={defaultTheme.accent}
          />
          {roomThemes.map((t) => (
            <Swatch
              key={t.id}
              color={t.accent}
              selected={themeId === t.id}
              onClick={() => void saveTheme(t.id)}
              aria-label={t.label}
            />
          ))}
        </div>

        {/* Background */}
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Background
        </p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <BackgroundTile
            isOriginal
            selected={backgroundId === null}
            onClick={() => void saveBackground(null)}
            label="Original"
            gradient={backgroundGradient(null)}
          />
          {roomBackgrounds.map((b) => (
            <BackgroundTile
              key={b.id}
              selected={backgroundId === b.id}
              onClick={() => void saveBackground(b.id)}
              label={b.label}
              gradient={`linear-gradient(135deg, ${b.stops[0]}, ${b.stops[1]})`}
            />
          ))}
        </div>

        {error && (
          <p className="mt-3 text-sm text-rose">{error}</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-amber" aria-hidden />}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-amber transition hover:bg-amber/10"
          >
            Done
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────────── Components ───────────────────────── */

function Swatch({
  color,
  selected,
  onClick,
  ...rest
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 w-11 shrink-0 rounded-full transition-all duration-200",
        selected ? "ring-[3px] ring-white" : "ring-0",
      )}
      style={{
        backgroundColor: color,
        boxShadow: selected ? `0 0 18px ${color}80` : undefined,
      }}
      {...rest}
    />
  );
}

function OriginalThemeSwatch({
  selected,
  onClick,
  accent,
}: {
  selected: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Original (default theme)"
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
        selected ? "ring-[3px] ring-white" : "",
      )}
      style={{
        backgroundColor: "#2A1F18",
        borderColor: selected ? "#FFFFFF" : `${accent}8C`,
        boxShadow: selected ? `0 0 18px ${accent}73` : undefined,
      }}
    >
      <Sparkles className="h-4 w-4" style={{ color: accent }} strokeWidth={1.75} />
    </button>
  );
}

function BackgroundTile({
  selected,
  onClick,
  label,
  gradient,
  isOriginal,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  gradient: string;
  isOriginal?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-24 shrink-0 flex-col items-stretch gap-1"
    >
      <div
        className={cn(
          "relative h-[60px] w-full overflow-hidden rounded-[10px] border transition-all duration-200",
          selected ? "border-white border-[2.5px]" : "border-border",
        )}
        style={{ background: gradient }}
      >
        {isOriginal && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-cream/60" strokeWidth={1.5} />
          </div>
        )}
        {selected && (
          <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#1A1410]">
            <Check className="h-3 w-3" strokeWidth={3} />
          </div>
        )}
      </div>
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
    </button>
  );
}

function PreviewAvatar({ accent, inCall }: { accent: string; inCall: boolean }) {
  return (
    <div
      className="h-10 w-10 rounded-full border-2"
      style={{
        borderColor: inCall ? accent : "rgba(255,255,255,0.18)",
        backgroundColor: `${accent}26`,
        boxShadow: inCall ? `0 0 14px ${accent}59` : undefined,
      }}
    />
  );
}
