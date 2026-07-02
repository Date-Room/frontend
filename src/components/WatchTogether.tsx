import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, Play, Square } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import {
  addWatchHistory,
  loadWatchHistory,
  type WatchHistoryEntry,
  youtubeWatchUrl,
} from "@/lib/watchHistory";
import type { YoutubeIframeApiPlayer, YoutubePlayerStateChangeEvent } from "@/types/youtubeIframeApi";

/**
 * Watch — ported to the shared `watch` activity protocol (mobile parity):
 *  - durable state `{ video_id, playing, timestamp_seconds, last_controller }`
 *  - broadcast events `load | play | pause | seek | tick`, payload carries
 *    `{ video_id?, timestamp_seconds }`.
 * The controller (whoever last acted) emits a 2s `tick` so followers drift-correct.
 * Durable snapshots are written on load/play/pause/stop (not on every tick).
 */

function extractId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/embed\/([^/?]+)/);
    if (m) return m[1];
  } catch {
    void 0;
  }
  if (/^[\w-]{11}$/.test(url)) return url;
  return null;
}

let ytApiPromise: Promise<void> | null = null;
function loadYT() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((res) => {
    if (window.YT?.Player) return res();
    const t = document.createElement("script");
    t.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(t);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      res();
    };
  });
  return ytApiPromise;
}

export function WatchTogether() {
  const { t } = useTranslation();
  const room = useRoomSession();
  const { session, state: durable } = useActivitySession("watch");
  const userId = room.senderId;

  const dVideo = typeof durable?.video_id === "string" ? (durable.video_id as string) : null;
  const dPlaying = durable?.playing === true;
  const dTs = typeof durable?.timestamp_seconds === "number" ? (durable.timestamp_seconds as number) : 0;
  const lastController =
    typeof durable?.last_controller === "string" ? (durable.last_controller as string) : null;
  const lastControllerRef = useRef(lastController);
  lastControllerRef.current = lastController;

  const [url, setUrl] = useState("");
  const [history, setHistory] = useState<WatchHistoryEntry[]>(() => loadWatchHistory());
  const playerRef = useRef<YoutubeIframeApiPlayer | null>(null);
  const playerShellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function syncPlayerSize() {
    const shell = playerShellRef.current;
    const p = playerRef.current;
    if (!shell || !p?.setSize) return;
    const { width, height } = shell.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    try {
      p.setSize(Math.round(width), Math.round(height));
    } catch {
      void 0;
    }
  }
  const dTsRef = useRef(dTs);
  dTsRef.current = dTs;

  // Suppress window as an expiry timestamp (see original: overlapping setTimeout
  // clears would re-open the echo window early).
  const suppressUntilRef = useRef(0);
  const suppress = (ms: number) => {
    const until = Date.now() + ms;
    if (until > suppressUntilRef.current) suppressUntilRef.current = until;
  };
  const isSuppressed = () => Date.now() < suppressUntilRef.current;
  const isControllerRef = useRef(false);

  function playerIsPlaying(p: YoutubeIframeApiPlayer | null): boolean {
    const PS = window.YT?.PlayerState;
    if (!p?.getPlayerState || !PS) return false;
    return p.getPlayerState() === PS.PLAYING;
  }

  function driftCorrect(p: YoutubeIframeApiPlayer, ts: number, tolerance = 1.5) {
    const localTime = p.getCurrentTime?.() ?? 0;
    if (Math.abs(ts - localTime) <= tolerance) return;
    suppress(2000);
    try {
      p.seekTo(ts, false);
    } catch {
      void 0;
    }
  }

  const [videoId, setVideoId] = useState<string | null>(dVideo);
  const [playing, setPlaying] = useState<boolean>(dPlaying);

  function persistWatch(
    next: { video_id: string | null; playing: boolean; timestamp_seconds: number },
    recapEvent?: { event_type: string; payload?: Record<string, unknown> },
  ) {
    void session?.persist({ ...next, last_controller: userId }, recapEvent);
  }

  // Mirror durable state for late-joiners / refreshes (source of truth when the
  // broadcast wasn't heard).
  useEffect(() => {
    if (dVideo !== videoId) setVideoId(dVideo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dVideo]);
  useEffect(() => {
    if (dPlaying === playing) return;
    // Ignore stale durable pauses while we're the active controller and still playing.
    if (lastController === userId && playing && !dPlaying) return;
    setPlaying(dPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dPlaying, lastController, userId]);

  const shouldMount = Boolean(videoId);
  const weLeadPlayback = lastController === userId || lastController === null;
  const weLeadPlaybackRef = useRef(weLeadPlayback);
  weLeadPlaybackRef.current = weLeadPlayback;

  useEffect(() => {
    if (!shouldMount || !containerRef.current) return;
    let cancelled = false;
    void loadYT().then(() => {
      if (cancelled || !containerRef.current || playerRef.current) return;
      const yt = window.YT;
      if (!yt) return;
      const shell = playerShellRef.current;
      const rect = shell?.getBoundingClientRect();
      const w = rect && rect.width > 0 ? Math.round(rect.width) : 640;
      const h = rect && rect.height > 0 ? Math.round(rect.height) : 360;
      playerRef.current = new yt.Player(containerRef.current, {
        width: w,
        height: h,
        videoId: videoId ?? undefined,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 1, mute: 1 },
        events: {
          onReady: () => {
            try {
              const p = playerRef.current;
              if (!p) return;
              syncPlayerSize();
              // Late joiners catch up locally — don't echo a play/pause burst to the room.
              suppress(3000);
              p.mute?.();
              if (dTsRef.current) p.seekTo(dTsRef.current, true);
              if (playing) p.playVideo?.();
              else p.pauseVideo?.();
            } catch {
              void 0;
            }
          },
          onStateChange: (e: YoutubePlayerStateChangeEvent) => {
            if (isSuppressed()) return;
            const PS = yt.PlayerState;
            const time = playerRef.current?.getCurrentTime?.() ?? 0;
            if (e.data === PS.PLAYING) {
              const leader = lastControllerRef.current;
              if (!weLeadPlaybackRef.current && leader && leader !== userId) return;
              isControllerRef.current = true;
              void session?.sendEvent("play", { timestamp_seconds: time });
              persistWatch({ video_id: videoId, playing: true, timestamp_seconds: time });
            } else if (e.data === PS.PAUSED) {
              const leader = lastControllerRef.current;
              if (!weLeadPlaybackRef.current && leader && leader !== userId) return;
              isControllerRef.current = true;
              void session?.sendEvent("pause", { timestamp_seconds: time });
              persistWatch({ video_id: videoId, playing: false, timestamp_seconds: time });
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        void 0;
      }
      playerRef.current = null;
      isControllerRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMount, videoId]);

  useEffect(() => {
    const shell = playerShellRef.current;
    if (!shell || !shouldMount) return;
    const ro = new ResizeObserver(() => syncPlayerSize());
    ro.observe(shell);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMount, videoId]);

  // Apply local play/pause to the mounted player without remounting.
  useEffect(() => {
    const p = playerRef.current;
    if (!p || isSuppressed()) return;
    try {
      if (playing) {
        if (!playerIsPlaying(p)) {
          suppress(500);
          p.playVideo?.();
        }
      } else if (playerIsPlaying(p)) {
        suppress(500);
        p.pauseVideo?.();
      }
    } catch {
      void 0;
    }
  }, [playing]);

  // Heartbeat: controller emits a `tick` every 2s for drift correction.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getPlayerState || !window.YT) return;
      if (!isControllerRef.current) return;
      if (p.getPlayerState() === window.YT.PlayerState.PLAYING) {
        const t = p.getCurrentTime?.() ?? 0;
        void session?.sendEvent("tick", { timestamp_seconds: t });
      }
    }, 2000);
    return () => clearInterval(id);
  }, [playing, session]);

  // Receive partner events over the shared channel.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.userId === userId) return;
      isControllerRef.current = false;
      const ts = typeof e.payload.timestamp_seconds === "number" ? e.payload.timestamp_seconds : undefined;
      const p = playerRef.current;

      if (e.type === "load") {
        const v = typeof e.payload.video_id === "string" ? e.payload.video_id : null;
        const ts = typeof e.payload.timestamp_seconds === "number" ? e.payload.timestamp_seconds : 0;
        if (v && v === videoId && p) {
          suppress(3000);
          setPlaying(true);
          driftCorrect(p, ts);
          return;
        }
        suppress(5000);
        setVideoId(v);
        setPlaying(true);
        // Persist on partner's behalf — keeps the chosen video alive
        // through a reload even when only one side is signed in.
        // Play/pause/seek/tick events are control noise and don't
        // need durable writes (they fire many times a second).
        if (room.canPersist) {
          persistWatch(
            { video_id: v, playing: true, timestamp_seconds: ts },
            v ? { event_type: "queued_video", payload: { text: `youtu.be/${v}` } } : undefined,
          );
        }
        return;
      }
      if (e.type === "play") {
        const leader = lastControllerRef.current === userId;
        if (leader && videoId && playerIsPlaying(p ?? null)) {
          if (p && ts != null) driftCorrect(p, ts);
          return;
        }
        setPlaying(true);
        if (p?.playVideo) {
          suppress(5000);
          try {
            if (ts != null) driftCorrect(p, ts, 0.5);
            if (!playerIsPlaying(p)) p.playVideo();
          } catch {
            void 0;
          }
        }
      } else if (e.type === "pause") {
        const leader = lastControllerRef.current === userId;
        if (leader && videoId && playerIsPlaying(p ?? null)) {
          return;
        }
        setPlaying(false);
        if (p?.pauseVideo) {
          suppress(2000);
          try {
            p.pauseVideo();
            if (ts != null) driftCorrect(p, ts, 0.5);
          } catch {
            void 0;
          }
        }
      } else if (e.type === "seek" || e.type === "tick") {
        if (p?.getCurrentTime && ts != null) {
          driftCorrect(p, ts);
        }
      }
    });
  }, [session, userId, videoId, room.canPersist]);

  function queueVideo(id: string, sourceUrl?: string) {
    isControllerRef.current = true;
    setVideoId(id);
    setPlaying(true);
    void session?.sendEvent("load", { video_id: id, timestamp_seconds: 0 });
    persistWatch(
      { video_id: id, playing: true, timestamp_seconds: 0 },
      { event_type: "queued_video", payload: { text: `youtu.be/${id}` } },
    );
    setHistory(addWatchHistory(sourceUrl ?? youtubeWatchUrl(id), id));
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractId(url.trim());
    if (!id) return;
    queueVideo(id, url.trim());
    setUrl("");
  };

  const playFromHistory = (entry: WatchHistoryEntry) => {
    queueVideo(entry.videoId, entry.url);
  };

  const stopVideo = () => {
    const p = playerRef.current;
    suppress(400);
    try {
      p?.pauseVideo?.();
    } catch {
      void 0;
    }
    void session?.sendEvent("pause", { timestamp_seconds: 0 });
    setPlaying(false);
    setVideoId(null);
    persistWatch({ video_id: null, playing: false, timestamp_seconds: 0 });
  };

  return (
    <div className="flex flex-col h-full p-4 sm:p-5 gap-3">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("room.watchUrlPlaceholder")}
          className="focus-ring bg-secondary/60 border-white/[0.10] focus-visible:border-primary/40"
        />
        {history.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="focus-ring shrink-0 rounded-full border-white/[0.10] bg-secondary/60 hover:bg-white/[0.06] relative"
                aria-label={t("room.watchHistory")}
              >
                <Clock className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {history.length}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-h-64 overflow-y-auto">
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {t("room.watchHistory")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {history.map((entry) => (
                <DropdownMenuItem
                  key={`${entry.videoId}-${entry.addedAt}`}
                  className="cursor-pointer gap-3 py-2.5"
                  onSelect={() => playFromHistory(entry)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/40 text-muted-foreground">
                    <Play className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {entry.url.replace(/^https?:\/\//, "")}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {new Date(entry.addedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          type="submit"
          className="focus-ring shrink-0 rounded-full text-primary-foreground hover:opacity-90 transition-all hover:-translate-y-px"
          style={{ backgroundColor: "var(--room-accent)" }}
        >
          {t("room.watchPlay")}
        </Button>
      </form>

      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <p className="shrink-0 text-xs text-muted-foreground italic px-1">
          {t("room.watchVolumeHint")}
        </p>

        <div className="flex-1 min-h-0 flex items-center justify-center w-full">
          <div
            ref={playerShellRef}
            className="relative mx-auto h-[clamp(320px,min(62vh,100%),720px)] max-h-full w-auto max-w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/[0.08] shadow-[0_22px_60px_-22px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            {shouldMount && (
              <div
                ref={containerRef}
                className="absolute inset-0 overflow-hidden [&_iframe]:!absolute [&_iframe]:!inset-0 [&_iframe]:!h-full [&_iframe]:!w-full"
              />
            )}
            {!videoId && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <div className="text-3xl opacity-40">▶</div>
                <p className="font-serif italic text-sm">paste a link to begin</p>
              </div>
            )}
            {videoId && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-3 pt-10">
                <Button
                  type="button"
                  onClick={stopVideo}
                  variant="outline"
                  size="sm"
                  className="pointer-events-auto rounded-full border-white/20 bg-black/50 text-cream hover:bg-black/70"
                >
                  <Square className="w-3.5 h-3.5 mr-1" /> Stop
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {videoId && dPlaying && !playing && (
        <Button
          type="button"
          onClick={() => {
            const targetTime = dTsRef.current;
            const p = playerRef.current;
            isControllerRef.current = false;
            suppress(5000);
            try {
              p?.seekTo?.(targetTime, false);
              p?.playVideo?.();
            } catch {
              void 0;
            }
            setPlaying(true);
          }}
          className="rounded-full text-primary-foreground hover:opacity-90 self-center"
          style={{ backgroundColor: "var(--room-accent)" }}
        >
          <Play className="w-4 h-4 mr-1.5" /> Tap to sync & catch up
        </Button>
      )}

    </div>
  );
}
