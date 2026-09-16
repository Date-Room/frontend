import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLAIN_MOOD, type LobbyMood } from "@/lib/ambiance";
import { LOBBY_PREVIEW_SCENES } from "@/lib/lobbyPreviewScenes";
import { MOOD_PICKER_OPTIONS, moodAccentColor, moodSwatchGradient } from "@/lib/moodVisuals";
import { cn } from "@/lib/utils";

export function RoomAmbianceSheet({
  open,
  onOpenChange,
  current,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: LobbyMood;
  onPick: (id: LobbyMood) => void;
}) {
  const [previewId, setPreviewId] = useState<LobbyMood>(current);

  const preview = useMemo(
    () => MOOD_PICKER_OPTIONS.find((m) => m.id === previewId) ?? MOOD_PICKER_OPTIONS[0],
    [previewId],
  );

  const previewScene =
    previewId !== PLAIN_MOOD ? LOBBY_PREVIEW_SCENES[previewId as keyof typeof LOBBY_PREVIEW_SCENES] : null;

  function select(id: LobbyMood) {
    onPick(id);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setPreviewId(current);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[min(92dvh,820px)] overflow-hidden border-white/10 bg-[#100e14]/95 p-0 text-cream sm:max-w-[min(720px,94vw)]">
        <div className="border-b border-white/[0.06] px-5 pb-4 pt-5 sm:px-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-serif text-2xl italic">Set the mood</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Backdrop and accent colors update instantly for everyone in the room.
            </DialogDescription>
          </DialogHeader>

          {/* Hero preview */}
          <div
            className="dr-mood-hero relative mt-4 overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ ["--mood-accent" as string]: moodAccentColor(previewId) }}
          >
            <div className="relative aspect-[2.4/1] min-h-[9rem] sm:min-h-[10.5rem]">
              {previewScene ? (
                <img
                  src={previewScene.src}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                  style={{ objectPosition: previewScene.objectPosition }}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ background: moodSwatchGradient(PLAIN_MOOD) }}
                />
              )}
              {previewScene && (
                <>
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-t",
                      previewScene.washT,
                      previewScene.washVia,
                      previewScene.washB,
                    )}
                  />
                  {previewScene.accentL ? <div className={cn("absolute inset-0", previewScene.accentL)} /> : null}
                  {previewScene.accentR ? <div className={cn("absolute inset-0", previewScene.accentR)} /> : null}
                </>
              )}
              <div className="dr-mood-hero__shimmer pointer-events-none absolute inset-0" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-4 pt-10 sm:px-5">
                <p className="flex items-center gap-2 font-serif text-xl italic text-cream sm:text-2xl">
                  <span aria-hidden>{preview.emoji}</span>
                  {preview.label}
                </p>
                <p className="mt-0.5 text-xs text-cream/75 sm:text-sm">{preview.hint}</p>
              </div>
              {previewId === current && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary backdrop-blur-md">
                  <Check className="h-3 w-3" aria-hidden />
                  Active
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-[min(42dvh,360px)] overflow-y-auto px-4 pb-5 pt-3 sm:px-5">
          <div className="dr-mood-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {MOOD_PICKER_OPTIONS.map((m) => {
              const isCurrent = current === m.id;
              const isPreview = previewId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => select(m.id)}
                  onMouseEnter={() => setPreviewId(m.id)}
                  onFocus={() => setPreviewId(m.id)}
                  className={cn(
                    "dr-mood-card group relative flex flex-col overflow-hidden rounded-xl border text-left transition duration-200",
                    isCurrent
                      ? "border-primary/55 shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_12px_32px_rgba(0,0,0,0.35)]"
                      : isPreview
                        ? "border-white/25 bg-white/[0.04]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-primary/30 hover:bg-white/[0.04]",
                  )}
                >
                  <span className="relative block aspect-[4/3] w-full overflow-hidden">
                    {m.previewSrc ? (
                      <img
                        src={m.previewSrc}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        style={{
                          objectPosition:
                            LOBBY_PREVIEW_SCENES[m.id as keyof typeof LOBBY_PREVIEW_SCENES]?.objectPosition ??
                            "50% 50%",
                        }}
                      />
                    ) : (
                      <span
                        className="absolute inset-0"
                        style={{ background: moodSwatchGradient(m.id) }}
                      />
                    )}
                    <span
                      className="absolute inset-0 opacity-80"
                      style={{ background: moodSwatchGradient(m.id) }}
                    />
                    <span className="absolute left-2 top-2 text-lg drop-shadow-md" aria-hidden>
                      {m.emoji}
                    </span>
                    {isCurrent && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <span className="block text-xs font-semibold text-cream sm:text-sm">{m.label}</span>
                    <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                      {m.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
