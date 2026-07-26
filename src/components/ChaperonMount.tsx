import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useChaperonController } from "@/context/ChaperonContext";
import { ChaperonSetupSheet } from "@/components/ChaperonSetupSheet";
import { ChaperonRail } from "@/components/ChaperonRail";
import type { ChaperonSeverity } from "@/lib/chaperon";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<ChaperonSeverity, string> = {
  info: "border-white/15 bg-black/60",
  note: "border-emerald-400/30 bg-emerald-500/10",
  warn: "border-amber/40 bg-amber/10",
  alert: "border-rose-500/50 bg-rose-500/15",
};

const RAIL_OPEN_KEY = "dr_chaperon_rail_open";
function loadRailOpen(): boolean {
  try {
    return localStorage.getItem(RAIL_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The single in-room chaperon surface: a discreet health dot + shield button
 * (opens setup), the newest whisper as a centre toast, and the running whisper
 * rail down the left. No sound, no vibration — whispers are private to the user
 * and safe if the other party sees the screen. Renders nothing when off.
 */
export function ChaperonMount() {
  const ctrl = useChaperonController();
  const [setupOpen, setSetupOpen] = useState(false);
  // Ratings keyed by event_id so the toast and the rail stay in sync (rate a
  // whisper once, from either surface).
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({});
  const [railOpen, setRailOpen] = useState(loadRailOpen);

  // Persistent host node so the surface survives native fullscreen (watch
  // party): on `fullscreenchange` we re-parent it into the fullscreen element
  // (marked data-dr-watch-fs by WatchTogether), exactly like the call PiP. A
  // `display:contents` host keeps our own fixed positioning intact.
  const hostRef = useRef<HTMLDivElement | null>(null);
  if (!hostRef.current && typeof document !== "undefined") {
    hostRef.current = document.createElement("div");
    hostRef.current.style.display = "contents";
  }
  const anchorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const anchor = anchorRef.current;
    if (!host || !anchor) return;
    const place = () => {
      const fsEl = document.fullscreenElement as HTMLElement | null;
      const target = fsEl?.getAttribute("data-dr-watch-fs") === "1" ? fsEl : anchor;
      if (host.parentElement !== target) target.appendChild(host);
    };
    place();
    document.addEventListener("fullscreenchange", place);
    return () => {
      document.removeEventListener("fullscreenchange", place);
      host.remove();
    };
  }, []);

  // Remember whether the reviewer likes the rail open or collapsed.
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_OPEN_KEY, railOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [railOpen]);

  if (!ctrl || !ctrl.enabled || !hostRef.current) return null;

  const {
    status,
    currentWhisper,
    active,
    listening,
    wordsHeard,
    whisperLog,
    unreadCount,
    markRailSeen,
    dismiss,
    sendFeedback,
  } = ctrl;

  function rate(eventId: string, helpful: boolean) {
    if (ratings[eventId]) return;
    sendFeedback(helpful, eventId);
    setRatings((r) => ({ ...r, [eventId]: helpful ? "up" : "down" }));
  }

  const currentEventId = currentWhisper?.event_id ?? null;
  const currentRating = currentEventId ? ratings[currentEventId] : undefined;

  const dotClass =
    status === "watching"
      ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse"
      : status === "degraded"
        ? "bg-amber shadow-[0_0_10px_rgba(251,191,36,0.6)]"
        : "bg-white/30";
  const dotTitle =
    status === "watching"
      ? "Chaperon is watching"
      : status === "degraded"
        ? "Chaperon can't see right now"
        : "Chaperon is off";

  // Shield is the collapsed rail: when active it toggles the whisper history;
  // when off (nothing to review) it opens setup so you can turn it on.
  function onShieldClick() {
    if (!active) {
      setSetupOpen(true);
      return;
    }
    setRailOpen((v) => {
      const next = !v;
      if (next) markRailSeen();
      return next;
    });
  }

  const surface = (
    <>
      {/* Discreet control cluster — status + toggles the whisper rail. */}
      <button
        type="button"
        onClick={onShieldClick}
        title={dotTitle}
        aria-label="Chaperon"
        className="pointer-events-auto fixed left-3 top-3 z-40 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1.5 backdrop-blur transition hover:bg-black/70"
      >
        <ShieldCheck className={cn("h-3.5 w-3.5", active ? "text-emerald-300" : "text-white/60")} />
        <span className={cn("h-2 w-2 rounded-full", dotClass)} aria-hidden />
        {active && (
          <span className="text-[10px] font-medium tabular-nums text-white/70">
            {listening ? `${wordsHeard}w` : "no mic"}
          </span>
        )}
        {unreadCount > 0 && (
          <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black">
            {unreadCount}
          </span>
        )}
        {active && whisperLog.length > 0 && (
          <ChevronDown
            className={cn(
              "h-3 w-3 text-white/50 transition-transform",
              railOpen && "rotate-180",
            )}
            aria-hidden
          />
        )}
      </button>

      {/* The running whisper log — collapsible; only when the reviewer opens it. */}
      {railOpen && (
        <ChaperonRail
          entries={whisperLog}
          ratings={ratings}
          onRate={rate}
          onCollapse={() => setRailOpen(false)}
          onOpenSetup={() => setSetupOpen(true)}
        />
      )}

      {/* Newest whisper as a centre toast; it also lands in the rail. */}
      {currentWhisper && (
        <div className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center px-4">
          <div
            className={cn(
              "pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 text-cream shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-fade-in",
              SEVERITY_STYLES[currentWhisper.severity],
            )}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cream/80" aria-hidden />
            <p className="min-w-0 flex-1 text-sm leading-snug">{currentWhisper.whisper}</p>
            {currentEventId && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Helpful"
                  disabled={currentRating !== undefined}
                  onClick={() => rate(currentEventId, true)}
                  className={cn(
                    "rounded-full p-1 transition hover:bg-white/10 disabled:opacity-40",
                    currentRating === "up" && "text-emerald-300",
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Not helpful"
                  disabled={currentRating !== undefined}
                  onClick={() => rate(currentEventId, false)}
                  className={cn(
                    "rounded-full p-1 transition hover:bg-white/10 disabled:opacity-40",
                    currentRating === "down" && "text-rose-300",
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="shrink-0 rounded-full p-1 text-cream/60 transition hover:bg-white/10 hover:text-cream"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <ChaperonSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        variant="live"
        active={active}
        transcriptSupported={ctrl.transcriptSupported}
        listening={ctrl.listening}
        wordsHeard={ctrl.wordsHeard}
        onStart={ctrl.start}
        onStop={ctrl.stop}
        onInject={ctrl.injectText}
      />
    </>
  );

  // The anchor marks our home in the normal DOM; the surface lives in the
  // portal host, which follows the page or the fullscreen element.
  return (
    <>
      <div ref={anchorRef} style={{ display: "contents" }} aria-hidden />
      {createPortal(surface, hostRef.current)}
    </>
  );
}
