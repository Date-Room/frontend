import { useEffect } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import { cn } from "@/lib/utils";

/**
 * A new message while Chat is closed: sender, a one-line preview, tap to
 * open. Sits top-centre like the activity invite (below it if both show)
 * and slides away after a few seconds; the dock badge keeps the count.
 */
export function ChatToast({
  partnerName,
  partnerPhotoUrl,
  text,
  count,
  offset = false,
  onOpen,
  onDismiss,
  ttlMs = 6000,
}: {
  partnerName: string;
  partnerPhotoUrl?: string | null;
  text: string;
  count: number;
  /** Push down when the activity invite occupies the top slot. */
  offset?: boolean;
  onOpen: () => void;
  onDismiss: () => void;
  ttlMs?: number;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, ttlMs);
    return () => window.clearTimeout(t);
  }, [onDismiss, ttlMs, text]);

  const initial = partnerName.trim().charAt(0).toUpperCase() || "?";

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-testid="chat-toast"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[59] flex justify-center px-3 transition-[top] duration-300",
        offset ? "top-[5.5rem] sm:top-24" : "top-3 sm:top-4",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl border border-white/[0.12] bg-[#141019]/85 p-2.5 pr-3 text-left shadow-[0_18px_56px_rgba(0,0,0,0.55)] backdrop-blur-xl transition hover:border-white/[0.2]",
          "animate-in fade-in slide-in-from-top-3 duration-300",
        )}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/15">
          <UserAvatarImg
            src={partnerPhotoUrl}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                {initial}
              </span>
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-cream/60">
            <MessageCircle className="h-3 w-3 text-primary" aria-hidden />
            <span className="truncate">{partnerName}</span>
            {count > 1 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-bold normal-case tracking-normal text-primary-foreground">{count}</span>}
          </p>
          <p className="truncate text-sm text-cream">{text}</p>
        </div>
      </button>
    </div>,
    document.body,
  );
}
