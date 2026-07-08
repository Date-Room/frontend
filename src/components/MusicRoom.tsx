import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GripVertical,
  ListMusic,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { cn } from "@/lib/utils";
import type { YoutubeIframeApiPlayer, YoutubePlayerStateChangeEvent } from "@/types/youtubeIframeApi";
import { extractId, fetchOEmbed, loadYT, type DjTrack, type OEmbed } from "@/components/DJ";

/**
 * MusicRoom — the persistent-room take on Music. No turns: it's a simple shared
 * player. Anyone can add songs, reorder the queue, and play/pause/skip; state
 * syncs to both sides. The playback engine lives in a provider that stays
 * mounted for the whole room so music keeps going regardless of the stage.
 * The stage renders {@link MusicLibrary} (add + reorderable queue) and
 * {@link MusicPlayerBar} docks at the bottom of the screen.
 */

type Reaction = { id: string; emoji: string };
type RepeatMode = "none" | "all" | "one";

type MusicCtxValue = {
  nowPlaying: DjTrack | null;
  tracks: DjTrack[];
  currentId: string | null;
  upcomingCount: number;
  playing: boolean;
  silence: boolean;
  videoId: string | null;
  trackTitle: string | null;
  trackChannel: string | null;
  thumb: string | null;
  repeat: RepeatMode;
  cycleRepeat: () => void;
  position: number;
  duration: number;
  seekFraction: (f: number) => void;
  volume: number;
  setVolume: (v: number) => void;
  needsAudioGesture: boolean;
  enableAudio: () => void;
  reactions: Reaction[];
  playId: (id: string) => void;
  playTrack: (id: string) => void;
  togglePlayPause: () => void;
  restartCurrent: () => void;
  previous: () => void;
  stop: () => void;
  next: () => void;
  removeTrack: (id: string) => void;
  reorderTracks: (from: number, to: number) => void;
  clearQueue: () => void;
  hasContent: boolean;
};

const MusicCtx = createContext<MusicCtxValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook + provider co-located
export function useMusicRoom(): MusicCtxValue {
  const v = useContext(MusicCtx);
  if (!v) throw new Error("useMusicRoom must be used within MusicRoomProvider");
  return v;
}

export function MusicRoomProvider({
  watchActive = false,
  children,
}: {
  /** Mute music while a video is on the stage so audio doesn't clash. */
  watchActive?: boolean;
  children: ReactNode;
}) {
  const room = useRoomSession();
  const userId = room.senderId;
  const { session, state: durable } = useActivitySession("dj");

  const nowPlaying = (durable?.now_playing ?? null) as DjTrack | null;
  const rawQueue = useMemo<DjTrack[]>(() => {
    const raw = durable?.queue;
    if (!Array.isArray(raw)) return [];
    return raw.filter((t): t is DjTrack => !!t && typeof (t as DjTrack).id === "string");
  }, [durable?.queue]);
  const currentId = nowPlaying?.id ?? null;
  // One ordered playlist. `queue` (durable) holds the full list; the current
  // song lives *in place*, not pinned to the top. (Legacy state stored the
  // current separately, so fold it in if it's missing.)
  const tracks = useMemo<DjTrack[]>(() => {
    if (nowPlaying && !rawQueue.some((t) => t.id === nowPlaying.id)) return [nowPlaying, ...rawQueue];
    return rawQueue;
  }, [nowPlaying, rawQueue]);
  const currentIdx = tracks.findIndex((t) => t.id === currentId);
  const upcomingCount = currentIdx >= 0 ? tracks.length - currentIdx - 1 : tracks.length;
  const playing = durable?.playing === true;
  const silence = durable?.silence === true;
  const repeat: RepeatMode =
    durable?.repeat === "all" || durable?.repeat === "one" ? durable.repeat : "none";
  const videoId = nowPlaying?.video_id ?? null;
  const lastController = typeof durable?.last_controller === "string" ? durable.last_controller : null;
  const dTsRef = useRef(0);
  dTsRef.current = typeof durable?.timestamp_seconds === "number" ? (durable.timestamp_seconds as number) : 0;

  const [meta, setMeta] = useState<OEmbed | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false);
  // Volume is per-listener, persisted locally (not shared with the partner).
  const [volume, setVolume] = useState(() => {
    try {
      const v = Number(localStorage.getItem("dr:music:volume"));
      return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 80;
    } catch {
      return 80;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("dr:music:volume", String(volume));
    } catch {
      /* ignore */
    }
  }, [volume]);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<YoutubeIframeApiPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressUntilRef = useRef(0);
  const suppress = (ms: number) => {
    const until = Date.now() + ms;
    if (until > suppressUntilRef.current) suppressUntilRef.current = until;
  };
  const isSuppressed = () => Date.now() < suppressUntilRef.current;
  // Whoever last pressed play/pause/added is the drift "leader" so only one
  // side emits ticks (avoids the two clients fighting over the timeline).
  const isController = lastController === userId;
  const isControllerRef = useRef(isController);
  isControllerRef.current = isController;

  const persistDj = useCallback(
    (patch: Record<string, unknown>, recapEvent?: { event_type: string; payload?: Record<string, unknown> }) => {
      void session?.persist(
        {
          // pass the (unused-on-web) turn field through untouched
          turn: durable?.turn ?? {},
          now_playing: nowPlaying,
          queue: rawQueue,
          playing,
          timestamp_seconds: dTsRef.current,
          last_controller: userId,
          silence,
          repeat,
          ...patch,
        },
        recapEvent,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, durable?.turn, nowPlaying, rawQueue, playing, silence, repeat, userId],
  );

  useEffect(() => {
    if (!videoId) {
      setMeta(null);
      return;
    }
    void fetchOEmbed(videoId).then(setMeta);
  }, [videoId]);

  const shouldMountPlayer = Boolean(videoId) && !silence;

  // Hidden YouTube audio player — lives in the provider so it survives stage
  // changes (music keeps playing when you browse other activities).
  useEffect(() => {
    if (!shouldMountPlayer || !containerRef.current) return;
    let cancelled = false;
    void loadYT().then(() => {
      if (cancelled || !containerRef.current || playerRef.current) return;
      const yt = window.YT;
      if (!yt) return;
      playerRef.current = new yt.Player(containerRef.current, {
        videoId: videoId ?? undefined,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 0, enablejsapi: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            try {
              playerRef.current?.setVolume?.(volume);
              if (dTsRef.current) playerRef.current?.seekTo(dTsRef.current, true);
              if (playing) {
                playerRef.current?.unMute?.();
                playerRef.current?.playVideo?.();
              }
            } catch {
              /* ignore */
            }
          },
          onStateChange: (e: YoutubePlayerStateChangeEvent) => {
            const PS = yt.PlayerState;
            // Song finished — the controller auto-advances (respects repeat).
            if (e.data === PS.ENDED) {
              if (isControllerRef.current) advanceRef.current(true);
              return;
            }
            if (isSuppressed()) return;
            if (!isControllerRef.current && e.data === PS.UNSTARTED && playing) setNeedsAudioGesture(true);
            if (e.data === PS.PLAYING) setNeedsAudioGesture(false);
            if (!isControllerRef.current) return;
            const time = playerRef.current?.getCurrentTime?.() ?? 0;
            if (e.data === PS.PLAYING) {
              void session?.sendEvent("play", { timestamp_seconds: time });
              persistDj({ playing: true, timestamp_seconds: time, silence: false });
            } else if (e.data === PS.PAUSED) {
              void session?.sendEvent("pause", { timestamp_seconds: time });
              persistDj({ playing: false, timestamp_seconds: time });
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
        /* ignore */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMountPlayer, videoId]);

  // Partner playback + queue events.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.userId === userId) return;
      const p = playerRef.current;
      const ts = typeof e.payload.timestamp_seconds === "number" ? e.payload.timestamp_seconds : undefined;
      if (e.type === "enqueue") {
        const track = e.payload.track as DjTrack | undefined;
        if (track && room.canPersist) {
          const list = [...tracks, track];
          if (nowPlaying == null) {
            persistDj(
              { now_playing: track, queue: list, playing: true, timestamp_seconds: 0, silence: false },
              track.video_id
                ? { event_type: "queued_track", payload: { text: `youtu.be/${track.video_id}` } }
                : undefined,
            );
          } else {
            persistDj({ queue: list });
          }
        }
        return;
      }
      if (e.type === "skip_to_next" || e.type === "end_turn") {
        if (!room.canPersist) return;
        const nextTrack = currentIdx >= 0 ? tracks[currentIdx + 1] : tracks[0];
        if (nextTrack) {
          persistDj({ now_playing: nextTrack, playing: true, timestamp_seconds: 0 });
        } else {
          persistDj({ now_playing: null, playing: false, timestamp_seconds: 0 });
        }
        return;
      }
      if (e.type === "reorder") {
        if (!room.canPersist) return;
        const nextQueue = e.payload.queue;
        if (Array.isArray(nextQueue)) persistDj({ queue: nextQueue });
        return;
      }
      if (e.type === "play" && p?.playVideo) {
        suppress(5000);
        try {
          if (ts != null) p.seekTo(ts, true);
          p.unMute?.();
          p.playVideo();
        } catch {
          setNeedsAudioGesture(true);
        }
      } else if (e.type === "pause" && p?.pauseVideo) {
        suppress(2000);
        try {
          p.pauseVideo();
          if (ts != null) p.seekTo(ts, false);
        } catch {
          /* ignore */
        }
      } else if ((e.type === "seek" || e.type === "tick") && p?.getCurrentTime && ts != null) {
        const local = p.getCurrentTime() ?? 0;
        if (Math.abs(ts - local) > 0.8) {
          suppress(1500);
          try {
            p.seekTo(ts, true);
          } catch {
            /* ignore */
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, userId, room.canPersist, nowPlaying, tracks, currentIdx]);

  // Drift heartbeat — only the current controller emits.
  useEffect(() => {
    if (!isController || !playing) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime || !window.YT) return;
      if (p.getPlayerState?.() !== window.YT.PlayerState.PLAYING) return;
      void session?.sendEvent("tick", { timestamp_seconds: p.getCurrentTime() ?? 0 });
    }, 1500);
    return () => clearInterval(id);
  }, [isController, playing, session]);

  // Floating reactions.
  useEffect(() => {
    if (!session) return;
    return session.onReaction((r) => {
      const id = crypto.randomUUID();
      setReactions((list) => [...list, { id, emoji: r.kind }]);
      setTimeout(() => setReactions((list) => list.filter((x) => x.id !== id)), 2400);
    });
  }, [session]);

  // Mute while a video is staged.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (watchActive) p.mute?.();
      else {
        p.unMute?.();
        p.setVolume?.(volume);
      }
    } catch {
      /* ignore */
    }
  }, [volume, watchActive]);

  // Add a song to the end of the list. Starts playing only if nothing is.
  const playId = useCallback(
    (id: string) => {
      const track: DjTrack = { id, title: "Loading…", added_by: userId, channel_title: null, video_id: id };
      const list = [...tracks, track];
      const recap = { event_type: "queued_track", payload: { text: `youtu.be/${id}` } };
      void session?.sendEvent("enqueue", { track });
      if (nowPlaying != null) {
        persistDj({ queue: list }, recap);
      } else {
        void session?.sendEvent("play", { timestamp_seconds: 0 });
        persistDj({ now_playing: track, queue: list, playing: true, timestamp_seconds: 0, silence: false }, recap);
        const p = playerRef.current;
        if (p?.loadVideoById) {
          suppress(5000);
          try {
            p.loadVideoById(id);
            p.unMute?.();
            p.playVideo?.();
          } catch {
            /* ignore */
          }
        }
      }
      void fetchOEmbed(id).then((m) => {
        if (!m) return;
        const patched = list.map((t) =>
          t.id === track.id ? { ...t, title: m.title, channel_title: m.author_name } : t,
        );
        persistDj({ queue: patched });
        if (nowPlaying == null) {
          persistDj({ now_playing: { ...track, title: m.title, channel_title: m.author_name }, queue: patched });
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, userId, nowPlaying, tracks],
  );

  // Advance to the next song in the list (no consume). `auto` honours repeat-one
  // by replaying; repeat-all wraps to the top.
  const advance = useCallback(
    (auto: boolean) => {
      const replay = () => {
        void session?.sendEvent("play", { timestamp_seconds: 0 });
        persistDj({ playing: true, timestamp_seconds: 0 });
        suppress(4000);
        try {
          playerRef.current?.seekTo?.(0, true);
          playerRef.current?.playVideo?.();
        } catch {
          /* ignore */
        }
      };
      if (auto && repeat === "one" && nowPlaying) {
        replay();
        return;
      }
      let nextTrack = currentIdx >= 0 ? tracks[currentIdx + 1] : tracks[0];
      if (!nextTrack && repeat === "all" && tracks.length > 0) nextTrack = tracks[0];
      if (nextTrack) {
        void session?.sendEvent("play", { timestamp_seconds: 0 });
        persistDj({ now_playing: nextTrack, playing: true, timestamp_seconds: 0 });
      } else {
        persistDj({ now_playing: null, playing: false, timestamp_seconds: 0 });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nowPlaying, tracks, currentIdx, repeat, session, persistDj],
  );
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const next = useCallback(() => advance(false), [advance]);

  const cycleRepeat = useCallback(() => {
    const order: RepeatMode[] = ["none", "all", "one"];
    const nextMode = order[(order.indexOf(repeat) + 1) % order.length];
    persistDj({ repeat: nextMode });
  }, [repeat, persistDj]);

  // Jump to a specific song (by id) and play it from the top.
  const playTrack = useCallback(
    (id: string) => {
      const track = tracks.find((t) => t.id === id);
      if (!track) return;
      void session?.sendEvent("play", { timestamp_seconds: 0 });
      persistDj({ now_playing: track, playing: true, timestamp_seconds: 0, silence: false });
      const p = playerRef.current;
      if (p?.loadVideoById && track.video_id) {
        suppress(5000);
        try {
          p.loadVideoById(track.video_id);
          p.unMute?.();
          p.playVideo?.();
        } catch {
          /* ignore */
        }
      }
    },
    [tracks, session, persistDj],
  );

  const togglePlayPause = useCallback(() => {
    if (!videoId) return;
    const time = playerRef.current?.getCurrentTime?.() ?? dTsRef.current;
    if (playing) {
      void session?.sendEvent("pause", { timestamp_seconds: time });
      persistDj({ playing: false, timestamp_seconds: time });
      suppress(2000);
      try {
        playerRef.current?.pauseVideo?.();
      } catch {
        /* ignore */
      }
    } else {
      void session?.sendEvent("play", { timestamp_seconds: time });
      persistDj({ playing: true, timestamp_seconds: time, silence: false });
      suppress(5000);
      try {
        playerRef.current?.unMute?.();
        playerRef.current?.playVideo?.();
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, playing, session, persistDj]);

  const restartCurrent = useCallback(() => {
    if (!videoId) return;
    suppress(4000);
    try {
      playerRef.current?.seekTo?.(0, true);
      playerRef.current?.unMute?.();
      playerRef.current?.playVideo?.();
    } catch {
      /* ignore */
    }
    void session?.sendEvent("play", { timestamp_seconds: 0 });
    persistDj({ playing: true, timestamp_seconds: 0 });
    setPosition(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, session, persistDj]);

  // Back: within the first few seconds (and a previous song exists) → play the
  // previous song; otherwise restart the current one.
  const previous = useCallback(() => {
    const pos = playerRef.current?.getCurrentTime?.() ?? 0;
    const prevTrack = currentIdx > 0 ? tracks[currentIdx - 1] : null;
    if (prevTrack && pos < 3) {
      playTrack(prevTrack.id);
    } else {
      restartCurrent();
    }
  }, [currentIdx, tracks, playTrack, restartCurrent]);

  const stop = useCallback(() => {
    try {
      playerRef.current?.pauseVideo?.();
    } catch {
      /* ignore */
    }
    // Clearing now_playing unmounts the player on both sides (via durable); the
    // list itself is kept.
    persistDj({ now_playing: null, playing: false, timestamp_seconds: 0, queue: tracks });
  }, [persistDj, tracks]);

  const enableAudio = useCallback(() => {
    try {
      playerRef.current?.unMute?.();
      playerRef.current?.setVolume?.(volume);
      playerRef.current?.playVideo?.();
    } catch {
      /* ignore */
    }
    setNeedsAudioGesture(false);
  }, [volume]);

  const removeTrack = useCallback(
    (id: string) => {
      const idx = tracks.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const list = tracks.filter((t) => t.id !== id);
      void session?.sendEvent("reorder", { queue: list });
      if (id === currentId) {
        // Removing the playing song → move to the one that took its place.
        const nextTrack = list[idx] ?? (repeat === "all" ? list[0] : undefined) ?? null;
        persistDj({
          now_playing: nextTrack,
          queue: list,
          playing: Boolean(nextTrack),
          timestamp_seconds: 0,
        });
      } else {
        persistDj({ queue: list });
      }
    },
    [persistDj, tracks, currentId, repeat, session],
  );
  const clearQueue = useCallback(() => {
    void session?.sendEvent("reorder", { queue: [] });
    persistDj({ now_playing: null, queue: [], playing: false, timestamp_seconds: 0 });
  }, [persistDj, session]);
  const reorderTracks = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= tracks.length || to >= tracks.length) return;
      const list = [...tracks];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      void session?.sendEvent("reorder", { queue: list });
      persistDj({ queue: list });
    },
    [persistDj, tracks, session],
  );

  useEffect(() => {
    const p = playerRef.current;
    if (p) {
      try {
        p.setVolume?.(volume);
      } catch {
        /* ignore */
      }
    }
  }, [volume]);

  // Position / duration for the progress bar.
  useEffect(() => {
    if (!shouldMountPlayer) {
      setPosition(0);
      setDuration(0);
      return;
    }
    const id = setInterval(() => {
      const p = playerRef.current as
        | (YoutubeIframeApiPlayer & { getDuration?: () => number })
        | null;
      if (!p?.getCurrentTime) return;
      try {
        setPosition(p.getCurrentTime() ?? 0);
        const d = p.getDuration?.() ?? 0;
        if (d) setDuration(d);
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearInterval(id);
  }, [shouldMountPlayer, videoId]);

  const seekFraction = useCallback(
    (f: number) => {
      const p = playerRef.current as
        | (YoutubeIframeApiPlayer & { getDuration?: () => number })
        | null;
      const d = duration || p?.getDuration?.() || 0;
      if (!d) return;
      const t = Math.max(0, Math.min(d, f * d));
      suppress(1500);
      try {
        p?.seekTo?.(t, true);
      } catch {
        /* ignore */
      }
      void session?.sendEvent("seek", { timestamp_seconds: t });
      persistDj({ timestamp_seconds: t });
      setPosition(t);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duration, session, persistDj],
  );

  const trackTitle = meta?.title ?? nowPlaying?.title ?? null;
  const trackChannel = meta?.author_name ?? nowPlaying?.channel_title ?? null;
  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null;

  const value: MusicCtxValue = {
    nowPlaying,
    tracks,
    currentId,
    upcomingCount,
    playing,
    silence,
    videoId,
    trackTitle,
    trackChannel,
    thumb,
    repeat,
    cycleRepeat,
    position,
    duration,
    seekFraction,
    volume,
    setVolume,
    needsAudioGesture,
    enableAudio,
    reactions,
    playId,
    playTrack,
    togglePlayPause,
    restartCurrent,
    previous,
    stop,
    next,
    removeTrack,
    reorderTracks,
    clearQueue,
    hasContent: Boolean(nowPlaying) || tracks.length > 0,
  };

  return (
    <MusicCtx.Provider value={value}>
      {children}
      {shouldMountPlayer && (
        <div
          className="pointer-events-none fixed bottom-2 right-2"
          style={{ width: 320, height: 180, opacity: 0.001, zIndex: -1 }}
          aria-hidden
        >
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>
      )}
    </MusicCtx.Provider>
  );
}

/* ───────────────────────── Stage: library / add ───────────────────────── */

export function MusicLibrary() {
  const m = useMusicRoom();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractId(url.trim());
    if (!id) {
      setUrlError("Drop a YouTube link.");
      return;
    }
    setUrlError(null);
    m.playId(id);
    setUrl("");
  };

  const drop = (to: number) => {
    if (dragIdx != null) m.reorderTracks(dragIdx, to);
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <form onSubmit={submit} className="space-y-1">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Add a song
        </p>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube link…"
            className="focus-ring bg-secondary/60 border-white/[0.10] focus-visible:border-primary/40"
          />
          <button
            type="submit"
            className="focus-ring rounded-full px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            Add
          </button>
        </div>
        {urlError && <p className="px-1 text-xs text-rose">{urlError}</p>}
      </form>

      {m.tracks.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {m.tracks.length} song{m.tracks.length === 1 ? "" : "s"} · drag to reorder
            </p>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-rose"
            >
              Clear list
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {m.tracks.map((t, idx) => {
              const isCurrent = t.id === m.currentId;
              return (
                <li
                  key={`${t.id}-${idx}`}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(idx);
                  }}
                  onDrop={() => drop(idx)}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  className={cn(
                    "rounded-xl transition",
                    overIdx === idx && dragIdx !== idx && "ring-2 ring-primary/50",
                    dragIdx === idx && "opacity-40",
                  )}
                >
                  <LibraryRow
                    track={t}
                    draggable
                    status={isCurrent ? (m.playing ? "playing" : "paused") : undefined}
                    onPlay={() => (isCurrent ? m.restartCurrent() : m.playTrack(t.id))}
                    onRemove={() => m.removeTrack(t.id)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Music className="h-10 w-10" style={{ color: "var(--room-accent)" }} strokeWidth={1.5} />
          <p className="text-sm">Paste a YouTube link to start the queue.</p>
        </div>
      )}

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-card p-5 text-center shadow-2xl">
            <p className="font-serif text-lg text-cream">Clear the list?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This removes the current song and everything queued, for both of you.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="flex-1 rounded-full border border-white/10 py-2 text-sm text-cream transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  m.clearQueue();
                  setConfirmClear(false);
                }}
                className="flex-1 rounded-full bg-rose py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EqualizerBars() {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-label="Playing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-sm bg-primary"
          style={{ height: "100%", animation: `eq-bar 0.9s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </span>
  );
}

function LibraryRow({
  track,
  status,
  draggable,
  onPlay,
  onRemove,
}: {
  track: DjTrack;
  status?: "playing" | "paused";
  draggable?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
}) {
  const thumb = track.video_id ? `https://i.ytimg.com/vi/${track.video_id}/mqdefault.jpg` : null;
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-xl border px-2 py-1.5",
        status ? "border-primary/30 bg-primary/[0.06]" : "border-white/[0.06] bg-card/40",
      )}
    >
      {draggable && (
        <span className="shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" aria-hidden>
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <button type="button" onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
          {thumb ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img src={thumb} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">▶</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-cream">{track.title || "Track"}</span>
          {track.channel_title && (
            <span className="block truncate text-[11px] text-muted-foreground">{track.channel_title}</span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {status && (
          <span className="flex h-7 w-7 items-center justify-center">
            {status === "playing" ? (
              <EqualizerBars />
            ) : (
              <Pause className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove from list"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Bottom: player bar ───────────────────────── */

export function MusicPlayerBar({ onOpenList }: { onOpenList?: () => void }) {
  const m = useMusicRoom();
  const [dismissed, setDismissed] = useState(false);
  // A new track re-opens the bar after a manual close.
  useEffect(() => {
    if (m.videoId) setDismissed(false);
  }, [m.videoId]);
  if (!m.hasContent || dismissed) return null;
  const pct = m.duration > 0 ? Math.min(100, (m.position / m.duration) * 100) : 0;

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-card/70 backdrop-blur-2xl">
      {/* Edge-to-edge progress / seek bar */}
      <button
        type="button"
        aria-label="Seek"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          m.seekFraction((e.clientX - rect.left) / rect.width);
        }}
        className="group relative block h-1.5 w-full cursor-pointer bg-white/10"
      >
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-500 ease-linear group-hover:brightness-110"
          style={{ width: `${pct}%` }}
        />
      </button>
      {m.reactions.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {m.reactions.map((r, i) => (
            <span
              key={r.id}
              className="absolute bottom-8 text-2xl"
              style={{ left: `${20 + ((i * 17) % 60)}%`, animation: "float-up 2.4s ease-out forwards" }}
            >
              {r.emoji}
            </span>
          ))}
        </div>
      )}
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-1.5 pr-12">
        <div
          className="h-9 w-9 shrink-0 overflow-hidden rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--room-accent) 30%, transparent), color-mix(in srgb, var(--room-accent) 4%, transparent))",
          }}
        >
          {m.thumb ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              src={m.thumb}
              className="h-full w-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-5 w-5" style={{ color: "var(--room-accent)" }} strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-cream">
            {m.trackTitle ?? "Nothing playing yet"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {m.trackChannel ?? (m.upcomingCount > 0 ? `${m.upcomingCount} up next` : "Add a song to start")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={m.previous}
            disabled={!m.videoId}
            aria-label="Previous / restart"
            className="flex h-9 w-9 items-center justify-center rounded-full text-cream transition hover:bg-white/10 disabled:opacity-40"
          >
            <SkipBack className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={m.togglePlayPause}
            disabled={!m.videoId}
            aria-label={m.playing ? "Pause" : "Play"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground transition hover:brightness-105 active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            {m.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={m.next}
            disabled={!m.videoId}
            aria-label="Next"
            className="flex h-9 w-9 items-center justify-center rounded-full text-cream transition hover:bg-white/10 disabled:opacity-40"
          >
            <SkipForward className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Repeat: none → all → one */}
        <button
          type="button"
          onClick={m.cycleRepeat}
          aria-label={`Repeat: ${m.repeat}`}
          title={m.repeat === "one" ? "Repeat one" : m.repeat === "all" ? "Repeat all" : "Repeat off"}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
            m.repeat === "none" ? "text-muted-foreground hover:text-cream" : "text-primary",
          )}
        >
          {m.repeat === "one" ? <Repeat1 className="h-[18px] w-[18px]" /> : <Repeat className="h-[18px] w-[18px]" />}
        </button>

        {m.videoId && (
          <div className="hidden shrink-0 items-center gap-2 pl-1 sm:flex">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={100}
              value={m.volume}
              onChange={(e) => m.setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="w-24"
              style={{ accentColor: "var(--room-accent)" }}
            />
          </div>
        )}

        {/* Open the list on the stage to manage songs. */}
        {onOpenList && (
          <button
            type="button"
            onClick={onOpenList}
            aria-label="Open song list"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:text-cream"
          >
            <ListMusic className="h-[18px] w-[18px]" />
          </button>
        )}

      </div>

      {/* Close — hugs the far right of the screen. Hides the player; music
          state stays and a new song reopens it. */}
      <button
        type="button"
        onClick={() => {
          m.stop();
          setDismissed(true);
        }}
        aria-label="Close player"
        className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:text-cream"
      >
        <X className="h-[18px] w-[18px]" />
      </button>

      {m.needsAudioGesture && m.playing && (
        <button
          onClick={m.enableAudio}
          className="mt-1.5 w-full rounded-full py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          style={{ backgroundColor: "var(--room-accent)" }}
        >
          Tap to enable audio
        </button>
      )}
    </div>
  );
}
