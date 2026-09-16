import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useChaperonController } from "@/context/ChaperonContext";
import {
  ChaperonSetupSheet,
  loadChaperonPrefs,
  prefsToStartConfig,
  takeChaperonAutostart,
} from "@/components/ChaperonSetupSheet";
import { useRoomSession } from "@/context/RoomSessionContext";
import { usePartnerName } from "@/lib/stagecraft/usePartnerName";
import { getCoachBetaStatus } from "@/lib/chaperon";
import { ChaperonRail } from "@/components/ChaperonRail";
import { ChaperonTryCard } from "@/components/ChaperonTryCard";
import { ChaperonChip, type RailFilter } from "@/components/ChaperonChip";
import {
  ChaperonReactions,
  FamilyIcon,
  checkLabel,
  type ReactionDetail,
} from "@/components/ChaperonReactions";
import {
  CHAPERON_STATUS_DEFAULT_OPEN,
  ChaperonStatusPanel,
} from "@/components/ChaperonStatusPanel";
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
  const session = useRoomSession();
  const partnerName = usePartnerName();
  const [setupOpen, setSetupOpen] = useState(false);

  // Pre-room "Use my free protected date" → start on entry, once per room.
  // Coach rides along only if the person still has a call (checked live, so
  // a stale preference can never 402 the start).
  const autostartTried = useRef(false);
  const enabled = ctrl?.enabled === true;
  const start = ctrl?.start;
  const roomId = session.roomId;
  useEffect(() => {
    if (!enabled || !start || autostartTried.current) return;
    if (!takeChaperonAutostart(roomId)) return;
    autostartTried.current = true;
    const prefs = loadChaperonPrefs();
    if (!prefs.protect) return;
    void (async () => {
      let coachAvailable = false;
      if (prefs.coach) {
        try {
          coachAvailable = (await getCoachBetaStatus()).calls_remaining > 0;
        } catch {
          coachAvailable = false;
        }
      }
      await start(prefsToStartConfig(prefs, coachAvailable));
    })();
  }, [enabled, start, roomId]);
  // The lobby shelf's Chaperon tile opens the same setup sheet via a window
  // event, so discoverability doesn't hang on the small in-call shield.
  useEffect(() => {
    const on = () => setSetupOpen(true);
    window.addEventListener("dr:chaperon:open-setup", on);
    return () => window.removeEventListener("dr:chaperon:open-setup", on);
  }, []);
  // Ratings keyed by event_id so the toast and the rail stay in sync (rate a
  // whisper once, from either surface).
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({});
  const [railOpen, setRailOpen] = useState(loadRailOpen);
  const [railFilter, setRailFilter] = useState<RailFilter>("all");
  // The per-stage status card. Open by default in beta, but it AUTO-COLLAPSES
  // to a slim indicator chip the moment a whisper lands: the coach's words are
  // the product, diagnostics must never sit on top of them (live complaint —
  // the expanded card covered the whisper rail and couldn't be dismissed).
  const [statusOpen, setStatusOpen] = useState(CHAPERON_STATUS_DEFAULT_OPEN);
  const whisperCount = ctrl?.whisperLog.length ?? 0;
  const prevWhisperCount = useRef(whisperCount);
  useEffect(() => {
    if (whisperCount > prevWhisperCount.current) setStatusOpen(false);
    prevWhisperCount.current = whisperCount;
  }, [whisperCount]);

  // Persistent host node so the surface survives native fullscreen (watch
  // party): on `fullscreenchange` we re-parent it into the fullscreen element
  // (marked data-dr-watch-fs by WatchTogether), exactly like the call PiP. A
  // `display:contents` host keeps our own fixed positioning intact.
  const hostRef = useRef<HTMLDivElement | null>(null);
  if (!hostRef.current && typeof document !== "undefined") {
    hostRef.current = document.createElement("div");
    hostRef.current.style.display = "contents";
  }
  const anchorRef = useRef<HTMLDivElement | null>(null);
  // Attach the portal host wherever the anchor currently lives (the page, or the
  // fullscreen element during a watch party). Driven by a CALLBACK REF on the
  // anchor so it runs whenever the anchor mounts — robust to `enabled` only
  // flipping true AFTER the async experience fetch. (A plain []-effect ran once
  // on mount, before the anchor existed while still disabled, then never re-ran
  // when enabled turned true — leaving the whole surface detached and invisible.)
  const placeHost = useCallback(() => {
    const host = hostRef.current;
    const anchor = anchorRef.current;
    if (!host || !anchor) return;
    const fsEl = document.fullscreenElement as HTMLElement | null;
    const target = fsEl?.getAttribute("data-dr-watch-fs") === "1" ? fsEl : anchor;
    if (host.parentElement !== target) target.appendChild(host);
  }, []);
  const setAnchor = useCallback(
    (node: HTMLDivElement | null) => {
      anchorRef.current = node;
      placeHost();
    },
    [placeHost],
  );
  // Re-place on fullscreen enter/exit; detach the host on unmount.
  useEffect(() => {
    document.addEventListener("fullscreenchange", placeHost);
    const host = hostRef.current;
    return () => {
      document.removeEventListener("fullscreenchange", placeHost);
      host?.remove();
    };
  }, [placeHost]);

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
    agent,
    currentWhisper,
    active,
    whisperLog,
    unread,
    markRailSeen,
    dismiss,
    sendFeedback,
    session: chapSession,
  } = ctrl;

  function rate(eventId: string, helpful: boolean, detail?: ReactionDetail) {
    if (ratings[eventId]) return;
    sendFeedback(helpful, eventId, detail);
    setRatings((r) => ({ ...r, [eventId]: helpful ? "up" : "down" }));
  }

  const currentEventId = currentWhisper?.event_id ?? null;
  const currentRating = currentEventId ? ratings[currentEventId] : undefined;

  function openRail(filter: RailFilter) {
    setRailFilter(filter);
    setRailOpen((v) => {
      // Same icon again closes; a different filter re-targets an open rail.
      const next = !(v && filter === railFilter);
      if (next) markRailSeen();
      return next;
    });
  }

  const surface = (
    <>
      {/* One flex COLUMN owns the top-left corner: pill, then status, then the
          whisper rail. Everything is in normal flow, so an expanded status card
          can only push the rail down — it can never sit on top of a whisper
          (the old layout floated each piece at its own fixed offset, and the
          status card covered the rail with no way to move it). */}
      <div className="pointer-events-none fixed left-3 top-16 z-40 flex max-h-[calc(100vh-6rem)] w-[min(15rem,44vw)] flex-col items-start gap-2">
        {/* Discreet control cluster — status + toggles the whisper rail. Only
            while the chaperon is on: off means nothing in the call area (the
            way in is the lobby card, the dock, or the pre-room sheet). */}
        {active && (
          <ChaperonChip
            status={status}
            agent={agent}
            coached={chapSession?.mode === "coached" || chapSession?.mode === "wing"}
            unread={unread}
            alertOnScreen={currentWhisper?.severity === "alert"}
            remoteName={partnerName === "Them" ? "them" : partnerName}
            onOpenRail={openRail}
            onOpenStatus={() => setStatusOpen((v) => !v)}
          />
        )}

        {/* Honest per-stage status: the panel with the sentence, the rows and
            the diagnostics. Opened from the chip while a stage is unhealthy, or
            from the setup sheet; auto-collapses when a whisper lands so it never
            sits on top of the coach's words. */}
        {active && statusOpen && (
          <div className="pointer-events-auto">
            <ChaperonStatusPanel
              status={status}
              agent={agent}
              remoteName={partnerName === "Them" ? "them" : partnerName}
              open
              onToggle={() => setStatusOpen(false)}
            />
          </div>
        )}

        {/* First chaperoned date: the try-me probe, once per browser. */}
        <ChaperonTryCard partnerName={partnerName === "Them" ? null : partnerName} />

        {/* The running whisper log — collapsible; only when the reviewer opens it. */}
        {railOpen && (
          <ChaperonRail
            entries={whisperLog}
            ratings={ratings}
            filter={railFilter}
            onFilter={setRailFilter}
            onRate={rate}
            onCollapse={() => setRailOpen(false)}
            onOpenSetup={() => setSetupOpen(true)}
          />
        )}
      </div>

      {/* Newest whisper as a centre band; it also lands in the rail. Centre is
          where the eyes are on the web room (the game), and the band carries
          the whole anatomy so it can be reacted to while it has attention. */}
      {currentWhisper && (
        <div className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center px-4">
          <div
            className={cn(
              "pointer-events-auto w-full max-w-md rounded-2xl border px-4 py-3 text-cream shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-fade-in",
              SEVERITY_STYLES[currentWhisper.severity],
            )}
          >
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/60">
              <FamilyIcon severity={currentWhisper.severity} className="h-3.5 w-3.5" />
              <span>{currentWhisper.probe ? "Your test" : checkLabel(currentWhisper.check_id)}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={dismiss}
                className="ml-auto rounded-full p-1 text-cream/60 transition hover:bg-white/10 hover:text-cream"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 font-serif text-[15px] italic leading-snug text-cream">
              {currentWhisper.whisper}
            </p>
            {currentEventId && (
              <div className="mt-2.5">
                <ChaperonReactions
                  signal={currentWhisper}
                  rated={currentRating}
                  onRate={(helpful, detail) => rate(currentEventId, helpful, detail)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <ChaperonSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        variant="live"
        partnerName={partnerName === "Them" ? null : partnerName}
        active={active}
        onStart={ctrl.start}
        onStop={ctrl.stop}
        onOpenStatus={() => setStatusOpen(true)}
      />
    </>
  );

  // The anchor marks our home in the normal DOM; the surface lives in the
  // portal host, which follows the page or the fullscreen element.
  return (
    <>
      <div ref={setAnchor} style={{ display: "contents" }} aria-hidden />
      {createPortal(surface, hostRef.current)}
    </>
  );
}
