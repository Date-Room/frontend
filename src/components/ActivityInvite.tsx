import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, PhoneCall, type LucideIcon } from "lucide-react";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import { FaceMark } from "@/components/FaceMark";
import { cn } from "@/lib/utils";

/** How long a notice stays before it sees itself out. A call is given
 *  longer because it is the one worth looking up for — and about as long
 *  as a phone rings before it gives up. */
const STAY_MS = { activity: 12_000, call: 30_000 } as const;

/** Far enough to mean it, in px. */
const SWIPE_OUT = 90;

/**
 * "JJ started Guacamole Panic. Want to join them?"
 *
 * Floats top-centre of the viewport, above the call (full, split or PiP), so
 * it is seen wherever the person is looking. One at a time; the parent owns
 * the state and swaps the content when the partner moves on.
 *
 * It behaves like a notice and not like a wall.
 *
 * George: "The notice on web that someone has joined the call, it should
 * be swipe-to-dismiss like any other toast. Instead it stays there and
 * asks me to join. It doesn't even auto-dismiss... It needs to."
 *
 * So: it goes away on its own, and it goes away when you push it away —
 * dragged with the pointer, following the finger, gone past a threshold
 * and springing back if you change your mind. Nothing is lost by
 * dismissing it: the stage keeps its own button for joining whatever is
 * going on, which is a control and belongs there permanently. This is
 * the tap on the shoulder, and a tap on the shoulder that will not stop
 * is not a tap on the shoulder.
 *
 * A call gets the call treatment: "Can we make it like a call
 * notification with like a vibrating call icon, in green." Green,
 * because that is what answering is everywhere; ringing, because the
 * icon moving is what makes an eye go to it; and the two soft notes
 * play whether or not the tab is in front, since a call is the one
 * notice worth interrupting for.
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
  kind = "activity",
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
  /** A call rings in green and is given longer to be noticed. */
  kind?: "activity" | "call";
}) {
  const call = kind === "call";
  // Escape = Not now. Enter is deliberately not Join: a stray keypress in a
  // game should not yank someone out of it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDecline();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDecline]);

  // It sees itself out. Restarted whenever the notice changes to a
  // different activity, so a second invite gets its own full stay.
  useEffect(() => {
    const t = window.setTimeout(onDecline, call ? STAY_MS.call : STAY_MS.activity);
    return () => window.clearTimeout(t);
  }, [activityId, call, onDecline]);

  // Push it away. The card follows the pointer and fades as it goes;
  // past the threshold it is dismissed, short of it it springs back, so
  // a half-hearted swipe reads as "no" rather than as nothing.
  const [dx, setDx] = useState(0);
  const [letGo, setLetGo] = useState(true);
  const from = useRef(0);
  const dragging = useRef(false);
  const onDown = (e: React.PointerEvent) => {
    // Not from the buttons: a drag that starts on Join is a tap on Join.
    if ((e.target as HTMLElement).closest("button")) return;
    dragging.current = true;
    from.current = e.clientX;
    setLetGo(false);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) setDx(e.clientX - from.current);
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setLetGo(true);
    if (Math.abs(dx) >= SWIPE_OUT) onDecline();
    else setDx(0);
  };
  const faded = Math.min(1, Math.abs(dx) / (SWIPE_OUT * 1.6));


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
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          transform: `translateX(${dx}px)`,
          opacity: 1 - faded,
          transition: letGo ? "transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 220ms" : "none",
        }}
        className={cn(
          // Sized to sit inside the room's top-bar band on desktop (the stage
          // header below it is already busy: theme chip, partner status).
          "pointer-events-auto flex w-full max-w-[480px] touch-pan-y select-none items-center gap-3 rounded-2xl p-2 pr-3 backdrop-blur-xl",
          call
            ? "border border-emerald-400/45 bg-[#0d1512]/88 shadow-[0_18px_56px_rgba(0,0,0,0.55),0_0_0_1px_rgba(52,211,153,0.14)]"
            : "border border-primary/35 bg-[#141019]/85 shadow-[0_18px_56px_rgba(0,0,0,0.55),0_0_0_1px_hsl(var(--primary)/0.12)]",
          "animate-in fade-in slide-in-from-top-3 duration-300",
        )}
      >
        {/* Who + what: the partner's face over the activity's tile — or,
            for a call, a ringing handset. */}
        <div className="relative h-11 w-11 shrink-0">
          <div
            className={cn(
              "h-11 w-11 overflow-hidden rounded-xl",
              call ? "dr-ring-pulse bg-emerald-500/15" : "bg-white/[0.06]",
            )}
          >
            {call ? (
              <div className="flex h-full w-full items-center justify-center">
                <PhoneCall className="dr-handset h-6 w-6 text-emerald-300" aria-hidden />
              </div>
            ) : tileSrc ? (
              <img src={tileSrc} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon className="h-6 w-6 text-primary" aria-hidden />
              </div>
            )}
          </div>
          <div
            className={cn(
              "absolute -bottom-1.5 -right-1.5 h-6 w-6 overflow-hidden rounded-full border-2",
              call ? "border-[#0d1512] bg-emerald-500/20" : "border-[#141019] bg-primary/20",
            )}
          >
            <UserAvatarImg
              src={partnerPhotoUrl}
              alt=""
              className="h-full w-full object-cover"
              fallback={
                <span
                  className={cn(
                    "flex h-full w-full items-center justify-center text-label font-bold",
                    call ? "text-emerald-200" : "text-primary",
                  )}
                >
                  <FaceMark name={partnerName} />
                </span>
              }
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-body font-semibold leading-snug text-cream">{headline}</p>
          <p className="text-label text-cream/65">
            {call ? "Swipe to dismiss" : "Want to join them?"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onDecline}
            className="focus-ring rounded-full px-3 py-1.5 text-label font-medium text-cream/70 transition hover:bg-white/[0.06] hover:text-cream"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onJoin}
            autoFocus
            className={cn(
              "focus-ring rounded-full px-3.5 py-1.5 text-label font-semibold transition hover:brightness-110",
              call
                ? "bg-emerald-500 text-[#06100c] shadow-[0_0_18px_rgba(52,211,153,0.45)]"
                : "bg-fill text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.4)]",
            )}
          >
            {call ? "Join" : `Join ${activityTitle.length <= 12 ? activityTitle : ""}`}
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
