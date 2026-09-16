import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, type LucideIcon } from "lucide-react";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import { cn } from "@/lib/utils";

/**
 * "JJ started Guacamole Panic. Want to join them?"
 *
 * Floats top-centre of the viewport, above the call (full, split or PiP), so
 * it is seen wherever the person is looking. One at a time; the parent owns
 * the state and swaps the content when the partner moves on.
 */
export function ActivityInvite({
  partnerName,
  partnerPhotoUrl,
  activityId,
  activityTitle,
  headline,
  tileSrc,
  Icon = LayoutGrid,
  onJoin,
  onDecline,
}: {
  partnerName: string;
  partnerPhotoUrl?: string | null;
  activityId: string;
  activityTitle: string;
  headline: string;
  tileSrc?: string;
  Icon?: LucideIcon;
  onJoin: () => void;
  onDecline: () => void;
}) {
  // Escape = Not now. Enter is deliberately not Join: a stray keypress in a
  // game should not yank someone out of it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDecline();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDecline]);

  const initial = partnerName.trim().charAt(0).toUpperCase() || "?";

  return createPortal(
    <div
      role="dialog"
      aria-live="polite"
      aria-label={headline}
      data-testid="activity-invite"
      data-activity={activityId}
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3 sm:top-4"
    >
      <div
        key={activityId}
        className={cn(
          "pointer-events-auto flex w-full max-w-[480px] items-center gap-3 rounded-2xl border border-primary/35 bg-[#141019]/85 p-2.5 pr-3 shadow-[0_18px_56px_rgba(0,0,0,0.55),0_0_0_1px_hsl(var(--primary)/0.12)] backdrop-blur-xl",
          "animate-in fade-in slide-in-from-top-3 duration-300",
        )}
      >
        {/* Who + what: the partner's face over the activity's tile. */}
        <div className="relative h-14 w-14 shrink-0">
          <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/[0.06]">
            {tileSrc ? (
              <img src={tileSrc} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon className="h-6 w-6 text-primary" aria-hidden />
              </div>
            )}
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 overflow-hidden rounded-full border-2 border-[#141019] bg-primary/20">
            <UserAvatarImg
              src={partnerPhotoUrl}
              alt=""
              className="h-full w-full object-cover"
              fallback={
                <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-primary">
                  {initial}
                </span>
              }
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-cream">{headline}</p>
          <p className="text-xs text-cream/65">Want to join them?</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onDecline}
            className="focus-ring rounded-full px-3 py-1.5 text-xs font-medium text-cream/70 transition hover:bg-white/[0.06] hover:text-cream"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onJoin}
            autoFocus
            className="focus-ring rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.4)] transition hover:brightness-110"
          >
            Join {activityTitle.length <= 12 ? activityTitle : ""}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Two soft notes. By default only when the tab is in the background (the
 *  card itself is the signal); `always` plays regardless. Guarded: no audio
 *  context, no sound, no error. */
export function inviteChime(always = false): void {
  try {
    if (typeof document === "undefined") return;
    if (!always && !document.hidden) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [[660, 0], [880, 0.14]].forEach(([freq, dt]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + dt);
      gain.gain.exponentialRampToValueAtTime(0.08, now + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + dt);
      osc.stop(now + dt + 0.3);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* silent */
  }
}
