import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ChatWithBoundary } from "@/components/Chat";
import { cn } from "@/lib/utils";

/** Anything that wants the chat open fires this — the bar button, the
 *  arrival toast, a deep link. One channel, so there is one way in. */
export const CHAT_OPEN_EVENT = "dr:chat:open";

export function openChat(): void {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT));
}

/**
 * Chat as a drawer rather than an activity.
 *
 * It was on the stage next to the games, which framed it as something you
 * do *instead of* the date — but chat is how you reach someone while
 * everything else carries on, especially when the mic or speakers have gone.
 * So it sits over the room and slides away again, and whatever was on the
 * stage is still there behind it.
 *
 * Portalled to <body> so no stacking context in the room can trap it, and
 * mounted whenever it has been opened at least once — the conversation keeps
 * its scroll position between openings.
 */
export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // This portals to <body>, outside the room shell that carries the accent —
  // so `var(--room-accent)` resolved to nothing and the sent bubbles rendered
  // with no background under dark-on-amber text, i.e. invisible.
  //
  // The shell builds its accent from several layers (the room theme, then the
  // chosen ambiance, which also rewrites --primary), and one of them comes
  // from state the drawer can't see. So rather than recomputing it — and
  // drifting the next time a layer is added — copy the values the shell
  // actually resolved.
  const [accent, setAccent] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!open) return;
    const shell = document.querySelector<HTMLElement>("[data-room-scope]");
    if (!shell) return;
    const read = () => {
      const cs = getComputedStyle(shell);
      const next: Record<string, string> = {};
      for (const v of [
        "--room-accent",
        "--room-accent-soft",
        "--primary",
        "--primary-foreground",
        "--ring",
      ]) {
        const value = cs.getPropertyValue(v).trim();
        if (value) next[v] = value;
      }
      setAccent(next as React.CSSProperties);
    };
    read();
    // Re-read if the room is re-themed while the drawer is open.
    const mo = new MutationObserver(read);
    mo.observe(shell, { attributes: true, attributeFilter: ["style"] });
    return () => mo.disconnect();
  }, [open]);

  // Mounted from the first opening onward, so the conversation keeps its
  // scroll position and unread state between visits.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Scrim: dismisses, and makes clear the room is still there behind. */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-label="Chat"
        aria-modal="false"
        style={accent}
        className={cn(
          "fixed inset-y-0 right-0 z-[91] flex w-[min(28rem,94vw)] flex-col border-l border-white/10 bg-card/95 shadow-[0_0_60px_rgba(0,0,0,0.55)] backdrop-blur-xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="dr-eyebrow text-muted-foreground">Chat</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatWithBoundary />
        </div>
      </aside>
    </>,
    document.body,
  );
}
