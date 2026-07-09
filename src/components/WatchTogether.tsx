import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { Clock, FastForward, Pause, Play, Rewind, Volume2, VolumeX, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import {
  addWatchHistory,
  fetchYoutubeTitle,
  loadWatchHistory,
  setWatchHistoryTitle,
  type WatchHistoryEntry,
  youtubeThumbnail,
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

function extractId(raw: string): string | null {
  const input = raw.trim();
  const clean = (s: string | null | undefined): string | null => {
    const id = (s ?? "").trim();
    return /^[\w-]{11}$/.test(id) ? id : null;
  };
  // Bare 11-char id pasted directly.
  const bare = clean(input);
  if (bare) return bare;
  // Add a protocol so URL() parses "youtube.com/..." and "youtu.be/..." too.
  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const u = new URL(withProto);
    if (u.hostname.includes("youtu.be")) return clean(u.pathname.slice(1));
    const v = clean(u.searchParams.get("v"));
    if (v) return v;
    // /embed/ID, /shorts/ID, /live/ID, /v/ID
    const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    if (m) return clean(m[1]);
  } catch {
    void 0;
  }
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
  // Backfill names for any past entries saved before we tracked titles.
  useEffect(() => {
    let cancelled = false;
    const missing = history.filter((e) => !e.title).map((e) => e.videoId);
    if (missing.length === 0) return;
    void (async () => {
      for (const id of missing) {
        const title = await fetchYoutubeTitle(id);
        if (cancelled) return;
        if (title) setHistory(setWatchHistoryTitle(id, title));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount; setHistory updates are self-limiting (only refetch new gaps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
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
  const videoIdRef = useRef(videoId);
  videoIdRef.current = videoId;
  const [playing, setPlaying] = useState<boolean>(dPlaying);
  // Actual player state (drives the bar icon) — can differ from the synced
  // `playing` intent when autoplay is blocked or we're mid-catch-up.
  const [livePlaying, setLivePlaying] = useState<boolean>(false);

  // Volume is per-viewer (not shared), persisted locally. Player starts muted
  // for autoplay-sync; touching volume (a user gesture) unmutes it.
  const [volume, setVolume] = useState(() => {
    try {
      const v = Number(localStorage.getItem("dr:watch:volume"));
      return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 100;
    } catch {
      return 100;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("dr:watch:volume", String(volume));
    } catch {
      void 0;
    }
    const p = playerRef.current;
    if (!p) return;
    try {
      p.setVolume?.(volume);
      if (volume === 0) p.mute?.();
      else p.unMute?.();
    } catch {
      void 0;
    }
  }, [volume]);

  // The bottom bar is portalled to <body>, which is outside the room's
  // accent-scoped element — so the room-scoped CSS vars don't cascade to it.
  // Read them off this in-tree node and re-apply them on the portalled bar.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [barVars, setBarVars] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!rootRef.current) return;
    const cs = getComputedStyle(rootRef.current);
    const vars = [
      "--primary",
      "--primary-foreground",
      "--ring",
      "--amber",
      "--room-accent",
      "--room-accent-soft",
      "--card",
    ];
    const next: Record<string, string> = {};
    for (const v of vars) {
      const value = cs.getPropertyValue(v).trim();
      if (value) next[v] = value;
    }
    setBarVars((prev) => {
      // Only update if something actually changed — avoids re-render churn.
      const keys = Object.keys(next);
      const prevRec = prev as Record<string, string>;
      if (keys.length === Object.keys(prevRec).length && keys.every((k) => prevRec[k] === next[k])) {
        return prev;
      }
      return next as React.CSSProperties;
    });
  }, [videoId]);
  // Latest value for onReady's stale closure — so a reload honours the
  // persisted paused/playing state (synced via durable for both people).
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const [videoTitle, setVideoTitle] = useState<string | null>(null);

  // Pull the title from the player (no native title bar since controls are off).
  // getVideoData can be empty right after ready, so retry a few times.
  const captureTitle = useCallback(() => {
    let tries = 0;
    const grab = () => {
      const data = (
        playerRef.current as { getVideoData?: () => { title?: string } } | null
      )?.getVideoData?.();
      const title = data?.title?.trim();
      const vid = videoIdRef.current;
      if (title) {
        setVideoTitle(title);
        if (vid) setHistory(setWatchHistoryTitle(vid, title));
      } else if (tries++ < 5) {
        window.setTimeout(grab, 400);
      }
    };
    grab();
  }, []);

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
      // Mount YT into a throwaway child so React never tries to removeChild the
      // node YT replaces with its iframe ("not a child" crash on unmount).
      const mount = document.createElement("div");
      containerRef.current.appendChild(mount);
      playerRef.current = new yt.Player(mount, {
        width: w,
        height: h,
        videoId: videoIdRef.current ?? undefined,
        // No native chrome — DateRoom drives playback so the two sides stay
        // in sync. A transparent overlay blocks YouTube's hover/click too.
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          mute: 1,
        },
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
              if (playingRef.current) p.playVideo?.();
              else p.pauseVideo?.();
              captureTitle();
            } catch {
              void 0;
            }
          },
          onStateChange: (e: YoutubePlayerStateChangeEvent) => {
            const PS = yt.PlayerState;
            if (e.data === PS.PLAYING) setLivePlaying(true);
            else if (e.data === PS.PAUSED || e.data === PS.ENDED) setLivePlaying(false);
            // Programmatic changes we make are suppressed, so anything reaching
            // here is a real user interaction (bottom bar OR a direct click on
            // the video). Whoever acts takes control and the change syncs.
            if (isSuppressed()) return;
            const p = playerRef.current;
            const time = p?.getCurrentTime?.() ?? 0;
            if (e.data === PS.PLAYING) {
              isControllerRef.current = true;
              // A direct click on a muted video is still a gesture — give it sound.
              if (volume > 0) {
                try {
                  p?.unMute?.();
                  p?.setVolume?.(volume);
                } catch {
                  void 0;
                }
              }
              setPlaying(true);
              void session?.sendEvent("play", { timestamp_seconds: time });
              persistWatch({ video_id: videoId, playing: true, timestamp_seconds: time });
            } else if (e.data === PS.PAUSED) {
              isControllerRef.current = true;
              setPlaying(false);
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
    // Create the player ONCE when a video first appears; new videos load into it
    // (below) rather than destroying/recreating — which raced with the durable
    // mirror and left a freshly-pasted video not playing until a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMount]);

  // Load a newly-chosen video into the existing player without remounting.
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !videoId) return;
    try {
      const current = p.getVideoData?.()?.video_id;
      if (current === videoId) return;
      suppress(3000);
      setVideoTitle(null);
      if (playingRef.current) p.loadVideoById?.(videoId);
      else p.cueVideoById?.(videoId);
      if (dTsRef.current) p.seekTo?.(dTsRef.current, true);
      captureTitle();
    } catch {
      void 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    const shell = playerShellRef.current;
    if (!shell || !shouldMount) return;
    const ro = new ResizeObserver(() => syncPlayerSize());
    ro.observe(shell);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMount, videoId]);

  // Apply local play/pause to the mounted player without remounting. When we
  // begin playing because the partner started (we're not the controller), also
  // seek to their durable timestamp so we jump straight into sync — this is what
  // the old "tap to sync & catch up" button did, now fully automatic.
  useEffect(() => {
    const p = playerRef.current;
    if (!p || isSuppressed()) return;
    try {
      if (playing) {
        if (!playerIsPlaying(p)) {
          suppress(1500);
          if (lastController !== userId) {
            const target = dTsRef.current;
            if (target > 0) p.seekTo?.(target, true);
          }
          p.playVideo?.();
        }
      } else if (playerIsPlaying(p)) {
        suppress(500);
        p.pauseVideo?.();
      }
    } catch {
      void 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const trimmed = url.trim();
    if (!trimmed) return;
    const id = extractId(trimmed);
    if (!id) {
      toast.error("That doesn't look like a YouTube link.");
      return;
    }
    queueVideo(id, trimmed);
    setUrl("");
  };

  const playFromHistory = (entry: WatchHistoryEntry) => {
    queueVideo(entry.videoId, entry.url);
  };

  // DateRoom-driven play/pause (the iframe's own controls are off). Broadcasts
  // + persists so the partner stays in sync.
  const togglePlayback = () => {
    const p = playerRef.current;
    if (!p || !videoId) return;
    const next = !livePlaying;
    isControllerRef.current = true;
    suppress(600);
    try {
      const time = p.getCurrentTime?.() ?? 0;
      if (next) {
        if (volume > 0) {
          p.unMute?.();
          p.setVolume?.(volume);
        }
        p.playVideo?.();
      } else {
        p.pauseVideo?.();
      }
      void session?.sendEvent(next ? "play" : "pause", { timestamp_seconds: time });
      persistWatch({ video_id: videoId, playing: next, timestamp_seconds: time });
    } catch {
      void 0;
    }
    setPlaying(next);
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

  const seekTo = (t: number) => {
    const p = playerRef.current;
    const target = Math.max(0, t);
    suppress(1500);
    try {
      p?.seekTo?.(target, true);
    } catch {
      void 0;
    }
    void session?.sendEvent("seek", { timestamp_seconds: target });
    persistWatch({ video_id: videoId, playing, timestamp_seconds: target });
    setPosition(target);
  };
  const seekBy = (delta: number) => {
    const p = playerRef.current;
    seekTo((p?.getCurrentTime?.() ?? position) + delta);
  };
  const seekFraction = (f: number) => {
    const p = playerRef.current as (YoutubeIframeApiPlayer & { getDuration?: () => number }) | null;
    const d = duration || p?.getDuration?.() || 0;
    if (d) seekTo(f * d);
  };

  // Position / duration for the control-bar progress.
  useEffect(() => {
    if (!videoId) {
      setPosition(0);
      setDuration(0);
      return;
    }
    const id = setInterval(() => {
      const p = playerRef.current as (YoutubeIframeApiPlayer & { getDuration?: () => number }) | null;
      if (!p?.getCurrentTime) return;
      try {
        setPosition(p.getCurrentTime() ?? 0);
        const d = p.getDuration?.() ?? 0;
        if (d) setDuration(d);
      } catch {
        void 0;
      }
    }, 500);
    return () => clearInterval(id);
  }, [videoId]);

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div ref={rootRef} className="flex flex-col h-full p-4 sm:p-5 gap-3">
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
                  <span className="relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/40 text-muted-foreground">
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <img
                      src={youtubeThumbnail(entry.videoId)}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                    <Play className="pointer-events-none absolute h-3.5 w-3.5 text-white/90 drop-shadow" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {entry.title ?? "YouTube video"}
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

      <div className="flex-1 min-h-0 flex flex-col gap-3">
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
            {/* No shield — the user can click the video directly to play/pause.
                YouTube's onStateChange reports that interaction and we sync it to
                the partner just like the bottom-bar controls. */}
            {!videoId && (
              <div className="absolute inset-0">
                <EmptyState variant="watch" title="Watch" subtitle="Paste a YouTube link above to begin." />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-width control bar at the bottom of the SCREEN — mirrors the music
          player; only present while Watch is on the stage. Portalled to <body>
          so the stage's transform/overflow doesn't trap the fixed positioning. */}
      {videoId &&
        createPortal(
          <div
            style={barVars}
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-card/60 backdrop-blur-sm"
          >
          <button
            type="button"
            aria-label="Seek"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seekFraction((e.clientX - rect.left) / rect.width);
            }}
            className="group relative block h-1.5 w-full cursor-pointer bg-white/10"
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-500 ease-linear group-hover:brightness-110"
              style={{ width: `${pct}%` }}
            />
          </button>
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-1.5 pr-12">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-black">
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img
                src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                className="h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-cream">{videoTitle ?? "Watching"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => seekBy(-10)}
                aria-label="Back 10 seconds"
                className="flex h-9 w-9 items-center justify-center rounded-full text-cream transition hover:bg-white/10"
              >
                <Rewind className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={togglePlayback}
                aria-label={livePlaying ? "Pause" : "Play"}
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground transition hover:opacity-90"
                style={{ backgroundColor: "var(--room-accent)" }}
              >
                {livePlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => seekBy(10)}
                aria-label="Forward 10 seconds"
                className="flex h-9 w-9 items-center justify-center rounded-full text-cream transition hover:bg-white/10"
              >
                <FastForward className="h-[18px] w-[18px]" />
              </button>
              <div className="ml-1 hidden items-center gap-1.5 sm:flex">
                <button
                  type="button"
                  onClick={() => setVolume((v) => (v === 0 ? 100 : 0))}
                  aria-label={volume === 0 ? "Unmute" : "Mute"}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-cream"
                >
                  {volume === 0 ? (
                    <VolumeX className="h-[18px] w-[18px]" />
                  ) : (
                    <Volume2 className="h-[18px] w-[18px]" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/15"
                  style={{ accentColor: "var(--room-accent)" }}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={stopVideo}
            aria-label="Close player"
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:text-cream"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>,
          document.body,
        )}
    </div>
  );
}
