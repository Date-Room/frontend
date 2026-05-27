import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
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
  const room = useRoomSession();
  const { session, state: durable } = useActivitySession("watch");
  const userId = room.senderId;

  const dVideo = typeof durable?.video_id === "string" ? (durable.video_id as string) : null;
  const dPlaying = durable?.playing === true;
  const dTs = typeof durable?.timestamp_seconds === "number" ? (durable.timestamp_seconds as number) : 0;

  const [url, setUrl] = useState("");
  const playerRef = useRef<YoutubeIframeApiPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const [videoId, setVideoId] = useState<string | null>(dVideo);
  const [playing, setPlaying] = useState<boolean>(dPlaying);

  function persistWatch(next: { video_id: string | null; playing: boolean; timestamp_seconds: number }) {
    void session?.persist({ ...next, last_controller: userId });
  }

  // Mirror durable state for late-joiners / refreshes (source of truth when the
  // broadcast wasn't heard).
  useEffect(() => {
    if (dVideo !== videoId) setVideoId(dVideo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dVideo]);
  useEffect(() => {
    if (dPlaying !== playing) setPlaying(dPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dPlaying]);

  const shouldMount = Boolean(videoId);

  useEffect(() => {
    if (!shouldMount || !containerRef.current) return;
    let cancelled = false;
    void loadYT().then(() => {
      if (cancelled || !containerRef.current || playerRef.current) return;
      const yt = window.YT;
      if (!yt) return;
      playerRef.current = new yt.Player(containerRef.current, {
        width: "100%",
        height: "100%",
        videoId: videoId ?? undefined,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 1, mute: 1 },
        events: {
          onReady: () => {
            try {
              const p = playerRef.current;
              if (!p) return;
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
              isControllerRef.current = true;
              void session?.sendEvent("play", { timestamp_seconds: time });
              persistWatch({ video_id: videoId, playing: true, timestamp_seconds: time });
            } else if (e.data === PS.PAUSED) {
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

  // Apply local play/pause to the mounted player without remounting.
  useEffect(() => {
    const p = playerRef.current;
    if (!p || isSuppressed()) return;
    suppress(500);
    try {
      if (playing) p.playVideo?.();
      else p.pauseVideo?.();
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
        suppress(5000);
        setVideoId(typeof e.payload.video_id === "string" ? e.payload.video_id : null);
        setPlaying(true);
        return;
      }
      if (e.type === "play") {
        setPlaying(true);
        if (p?.playVideo) {
          suppress(5000);
          try {
            if (ts != null) p.seekTo(ts, false);
            p.playVideo();
          } catch {
            void 0;
          }
        }
      } else if (e.type === "pause") {
        setPlaying(false);
        if (p?.pauseVideo) {
          suppress(2000);
          try {
            p.pauseVideo();
            if (ts != null) p.seekTo(ts, false);
          } catch {
            void 0;
          }
        }
      } else if (e.type === "seek" || e.type === "tick") {
        if (p?.getCurrentTime && ts != null) {
          const localTime = p.getCurrentTime() ?? 0;
          if (Math.abs(ts - localTime) > 1.5) {
            suppress(2000);
            try {
              p.seekTo(ts, false);
            } catch {
              void 0;
            }
          }
        }
      }
    });
  }, [session, userId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractId(url.trim());
    if (!id) return;
    isControllerRef.current = true;
    setVideoId(id);
    setPlaying(true);
    void session?.sendEvent("load", { video_id: id, timestamp_seconds: 0 });
    persistWatch({ video_id: id, playing: true, timestamp_seconds: 0 });
    setUrl("");
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
    <div className="flex flex-col h-full p-6 gap-4">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube URL..."
          className="bg-secondary border-border"
        />
        <Button type="submit" className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90">
          Play
        </Button>
      </form>

      <p className="text-xs text-muted-foreground italic px-1">
        Hover the video to play, pause, or unmute via YouTube's controls. Each of you controls your own volume.
      </p>

      <div className="flex-1 rounded-2xl overflow-hidden bg-black border border-border card-shadow relative">
        {shouldMount && (
          <div className="w-full h-full min-h-[240px] aspect-video">
            <div ref={containerRef} className="w-full h-full" />
          </div>
        )}
        {!videoId && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-serif italic">
            paste a link to begin
          </div>
        )}
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
          className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90 self-center"
        >
          <Play className="w-4 h-4 mr-1.5" /> Tap to sync & catch up
        </Button>
      )}

      {videoId && (
        <div className="flex items-center gap-3 px-2">
          <Button
            type="button"
            onClick={stopVideo}
            variant="outline"
            size="sm"
            className="rounded-full border-border bg-secondary hover:bg-muted"
          >
            <Square className="w-3.5 h-3.5 mr-1" /> Stop
          </Button>
        </div>
      )}
    </div>
  );
}
