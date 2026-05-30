import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipForward, Volume2 } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { getLimits } from "@/lib/catalogRuntime";
import type { YoutubeIframeApiPlayer, YoutubePlayerStateChangeEvent } from "@/types/youtubeIframeApi";

/**
 * DJ — ported to the shared `dj` activity (mobile parity for the fields the web
 * uses): durable state `{ turn: { current_dj, turn_started_at }, now_playing,
 * playing, timestamp_seconds, last_controller, silence }`, broadcast events
 * `play | pause | seek | tick | enqueue | silence_on | silence_off`, and the
 * shared `reaction` broadcast. Turn ownership is a userId (from presence), not a
 * slot. The web surfaces a single now_playing track; mobile's full queue UI is a
 * follow-up — playback + now_playing + turn still sync cross-platform.
 */

type DjTrack = {
  id: string;
  title: string;
  added_by: string;
  channel_title: string | null;
  video_id: string | null;
};

function extractId(url: string): string | null {
  try {
    const u = new URL(url);
    const shortId = u.hostname.includes("youtu.be") ? u.pathname.split("/").filter(Boolean)[0] : null;
    const watchId = u.searchParams.get("v");
    const pathId = u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
    const id = shortId || watchId || pathId;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
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

type OEmbed = { title: string; author_name: string; thumbnail_url: string };
const oembedCache = new Map<string, OEmbed>();
async function fetchOEmbed(videoId: string): Promise<OEmbed | null> {
  if (oembedCache.has(videoId)) return oembedCache.get(videoId)!;
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!r.ok) return null;
    const j = (await r.json()) as OEmbed;
    oembedCache.set(videoId, j);
    return j;
  } catch {
    return null;
  }
}

type Reaction = { id: string; emoji: string };

export function DJ({ watchActive = false }: { watchActive?: boolean } = {}) {
  const room = useRoomSession();
  const userId = room.senderId;
  const { session, state: durable } = useActivitySession("dj");
  const turnSeconds = useMemo(() => getLimits().djTurnMins * 60, []);

  // ── durable reads ────────────────────────────────────────────────────────
  const turn = (durable?.turn ?? {}) as { current_dj?: string | null; turn_started_at?: string | null };
  const currentDj = typeof turn.current_dj === "string" ? turn.current_dj : null;
  const nowPlaying = (durable?.now_playing ?? null) as DjTrack | null;
  const playing = durable?.playing === true;
  const silence = durable?.silence === true;
  const videoId = nowPlaying?.video_id ?? null;
  const dTsRef = useRef(0);
  dTsRef.current = typeof durable?.timestamp_seconds === "number" ? (durable.timestamp_seconds as number) : 0;
  const isDJ = currentDj != null && currentDj === userId;

  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<OEmbed | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false);
  const [volume, setVolume] = useState(80);

  const playerRef = useRef<YoutubeIframeApiPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressUntilRef = useRef(0);
  const suppress = (ms: number) => {
    const until = Date.now() + ms;
    if (until > suppressUntilRef.current) suppressUntilRef.current = until;
  };
  const isSuppressed = () => Date.now() < suppressUntilRef.current;
  const isDJRef = useRef(isDJ);
  isDJRef.current = isDJ;

  // The other participant's id (for "pass the aux"), from presence.
  const partnerId = useMemo(() => {
    for (const p of room.presence) {
      const sid = typeof p.sender_id === "string" ? p.sender_id : null;
      if (sid && sid !== userId) return sid;
    }
    return null;
  }, [room.presence, userId]);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of room.presence) {
      if (typeof p.sender_id === "string" && typeof p.name === "string") map[p.sender_id] = p.name;
    }
    return map;
  }, [room.presence]);
  const djName = currentDj ? names[currentDj] || (currentDj === userId ? "You" : "Your partner") : "Nobody yet";

  function persistDj(
    patch: Record<string, unknown>,
    recapEvent?: { event_type: string; payload?: Record<string, unknown> },
  ) {
    void session?.persist(
      {
        turn,
        now_playing: nowPlaying,
        playing,
        timestamp_seconds: dTsRef.current,
        last_controller: userId,
        silence,
        ...patch,
      },
      recapEvent,
    );
  }

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!videoId) {
      setMeta(null);
      return;
    }
    void fetchOEmbed(videoId).then(setMeta);
  }, [videoId]);

  const startedAtMs = turn.turn_started_at ? new Date(turn.turn_started_at).getTime() : null;
  const remaining = startedAtMs ? Math.max(0, turnSeconds - Math.floor((now - startedAtMs) / 1000)) : turnSeconds;

  const shouldMountDJPlayer = Boolean(videoId) && !silence;

  // Hidden audio-only YouTube player.
  useEffect(() => {
    if (!shouldMountDJPlayer || !containerRef.current) return;
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
              void 0;
            }
          },
          onStateChange: (e: YoutubePlayerStateChangeEvent) => {
            if (isSuppressed()) return;
            const PS = yt.PlayerState;
            if (!isDJRef.current && e.data === PS.UNSTARTED && playing) setNeedsAudioGesture(true);
            if (e.data === PS.PLAYING) setNeedsAudioGesture(false);
            if (!isDJRef.current) return;
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
        void 0;
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMountDJPlayer, videoId]);

  // Receive partner playback events.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.userId === userId) return;
      const p = playerRef.current;
      const ts = typeof e.payload.timestamp_seconds === "number" ? e.payload.timestamp_seconds : undefined;
      if (e.type === "enqueue") {
        // Partner took the aux — persist their track on their
        // behalf so the durable state catches up even when the
        // partner is a guest (canPersist=false). Matches mobile's
        // _onBroadcast partner-write semantics.
        const track = e.payload.track as Record<string, unknown> | undefined;
        if (track && room.canPersist) {
          const turnPatch = {
            current_dj: e.userId,
            turn_started_at: new Date().toISOString(),
          };
          persistDj(
            {
              turn: turnPatch,
              now_playing: track,
              playing: true,
              timestamp_seconds: 0,
              silence: false,
            },
            typeof track.video_id === "string"
              ? {
                  event_type: "queued_track",
                  payload: { text: `youtu.be/${track.video_id}` },
                }
              : undefined,
          );
        }
        return;
      }
      if (e.type === "play" && p?.playVideo) {
        suppress(5000);
        try {
          if (ts != null) p.seekTo(ts, true);
          p.unMute?.();
          p.playVideo();
        } catch {
          if (!isDJRef.current) setNeedsAudioGesture(true);
        }
      } else if (e.type === "pause" && p?.pauseVideo) {
        suppress(2000);
        try {
          p.pauseVideo();
          if (ts != null) p.seekTo(ts, false);
        } catch {
          void 0;
        }
      } else if ((e.type === "seek" || e.type === "tick") && p?.getCurrentTime && ts != null) {
        const local = p.getCurrentTime() ?? 0;
        if (Math.abs(ts - local) > 0.8) {
          suppress(1500);
          try {
            p.seekTo(ts, true);
          } catch {
            void 0;
          }
        }
      }
    });
  }, [session, userId, room.canPersist]);

  // DJ heartbeat for drift correction.
  useEffect(() => {
    if (!isDJ || !playing) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime || !window.YT) return;
      if (p.getPlayerState?.() !== window.YT.PlayerState.PLAYING) return;
      void session?.sendEvent("tick", { timestamp_seconds: p.getCurrentTime() ?? 0 });
    }, 1500);
    return () => clearInterval(id);
  }, [isDJ, playing, session]);

  // Floating reactions over the shared reaction broadcast.
  useEffect(() => {
    if (!session) return;
    return session.onReaction((r) => {
      const id = crypto.randomUUID();
      setReactions((list) => [...list, { id, emoji: r.kind }]);
      setTimeout(() => setReactions((list) => list.filter((x) => x.id !== id)), 2400);
    });
  }, [session]);

  const sendReaction = (emoji: string) => {
    const id = crypto.randomUUID();
    setReactions((list) => [...list, { id, emoji }]);
    setTimeout(() => setReactions((list) => list.filter((x) => x.id !== id)), 2400);
    void session?.sendReaction(emoji);
  };

  // Volume / mute when Watch tab is foregrounded.
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
      void 0;
    }
  }, [volume, watchActive]);

  const playId = useCallback(
    (id: string) => {
      const track: DjTrack = {
        id,
        title: "Loading…",
        added_by: userId,
        channel_title: null,
        video_id: id,
      };
      const nextTurn = currentDj
        ? { ...turn, turn_started_at: turn.turn_started_at ?? new Date().toISOString() }
        : { current_dj: userId, turn_started_at: new Date().toISOString() };
      void session?.sendEvent("enqueue", { track });
      void session?.sendEvent("play", { timestamp_seconds: 0 });
      persistDj(
        { turn: nextTurn, now_playing: track, playing: true, timestamp_seconds: 0, silence: false },
        { event_type: "queued_track", payload: { text: `youtu.be/${id}` } },
      );
      const p = playerRef.current;
      if (p?.loadVideoById) {
        suppress(5000);
        try {
          p.loadVideoById(id);
          p.unMute?.();
          p.playVideo?.();
        } catch {
          void 0;
        }
      }
      void fetchOEmbed(id).then((m) => {
        if (m) persistDj({ now_playing: { ...track, title: m.title, channel_title: m.author_name } });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, userId, currentDj, turn],
  );

  const playUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractId(url.trim());
    if (!id) return;
    playId(id);
    setUrl("");
  };

  const chooseSilence = () => {
    void session?.sendEvent("silence_on", {});
    persistDj({ now_playing: null, playing: false, timestamp_seconds: 0, silence: true });
  };

  const passAux = () => {
    const next = partnerId ?? null;
    void session?.sendEvent("end_turn", {});
    persistDj({
      turn: { current_dj: next, turn_started_at: next ? new Date().toISOString() : null },
      now_playing: null,
      playing: false,
      timestamp_seconds: 0,
      silence: false,
    });
  };

  const togglePlayPause = () => {
    if (!isDJ) return;
    const time = playerRef.current?.getCurrentTime?.() ?? dTsRef.current;
    if (playing) {
      void session?.sendEvent("pause", { timestamp_seconds: time });
      persistDj({ playing: false, timestamp_seconds: time });
      suppress(2000);
      try {
        playerRef.current?.pauseVideo?.();
      } catch {
        void 0;
      }
    } else {
      void session?.sendEvent("play", { timestamp_seconds: time });
      persistDj({ playing: true, timestamp_seconds: time, silence: false });
      suppress(5000);
      try {
        playerRef.current?.unMute?.();
        playerRef.current?.playVideo?.();
      } catch {
        void 0;
      }
    }
  };

  const enableAudio = () => {
    try {
      playerRef.current?.unMute?.();
      playerRef.current?.setVolume?.(volume);
      playerRef.current?.playVideo?.();
    } catch {
      void 0;
    }
    setNeedsAudioGesture(false);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = (remaining / turnSeconds) * 100;

  return (
    <div className="relative flex flex-col h-full p-4 sm:p-6 gap-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {reactions.map((r, i) => (
          <span
            key={r.id}
            className="absolute bottom-20 text-3xl"
            style={{ left: `${20 + ((i * 17) % 60)}%`, animation: "float-up 2.4s ease-out forwards" }}
          >
            {r.emoji}
          </span>
        ))}
      </div>
      <style>{`@keyframes float-up {0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1;transform:translateY(-10px) scale(1.1)}100%{transform:translateY(-180px) scale(1.2);opacity:0}}`}</style>

      {shouldMountDJPlayer && (
        <div className="fixed bottom-2 right-2 pointer-events-none" style={{ width: 320, height: 180, opacity: 0.001, zIndex: -1 }} aria-hidden>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>
      )}

      <div className="rounded-2xl bg-secondary/60 border border-white/[0.08] p-4 flex flex-col gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-serif italic text-cream text-lg">
            🎧 {djName} is DJ{" "}
            {isDJ && <span className="text-amber text-xs uppercase tracking-[0.2em] not-italic ml-2">you</span>}
          </div>
          {currentDj && (
            <div className="text-amber font-mono text-lg tabular-nums">
              {mm}:{ss}
            </div>
          )}
        </div>
        <div className="h-1 w-full rounded-full bg-black/30 overflow-hidden">
          <div className="h-full bg-amber transition-all duration-500" style={{ width: `${currentDj ? pct : 0}%` }} />
        </div>
      </div>

      {!currentDj ? (
        <form onSubmit={playUrl} className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube link to start as DJ…"
            className="focus-ring bg-secondary/60 border-white/[0.10] focus-visible:border-primary/40"
          />
          <Button type="submit" className="focus-ring rounded-full bg-amber text-primary-foreground hover:bg-amber/90 hover:-translate-y-px transition-all">
            Play
          </Button>
        </form>
      ) : isDJ ? (
        <>
          <form onSubmit={playUrl} className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a YouTube link to play…"
              className="focus-ring bg-secondary/60 border-white/[0.10] focus-visible:border-primary/40"
            />
            <Button type="submit" className="focus-ring rounded-full bg-amber text-primary-foreground hover:bg-amber/90 hover:-translate-y-px transition-all">
              Play
            </Button>
          </form>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" onClick={chooseSilence} variant="outline" className="focus-ring rounded-full border-white/[0.10] bg-secondary/40 hover:bg-secondary/60 flex-1">
              🤫 Choose silence
            </Button>
            <Button type="button" onClick={passAux} variant="outline" className="focus-ring rounded-full border-amber/40 text-amber hover:bg-amber/10 flex-1">
              <SkipForward className="w-4 h-4" /> Pass the aux 🎵
            </Button>
          </div>
          {videoId && (
            <div className="flex items-center gap-3 px-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="flex-1 accent-amber" aria-label="volume" />
              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{volume}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <Input disabled placeholder={`Listening to ${djName}'s picks...`} className="bg-secondary border-border opacity-60" />
          {needsAudioGesture && playing && (
            <Button onClick={enableAudio} className="rounded-full bg-amber text-primary-foreground hover:bg-amber/90 w-full">
              Tap to enable audio
            </Button>
          )}
          {videoId && (
            <div className="flex items-center gap-3 px-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="flex-1 accent-amber" aria-label="volume" />
              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{volume}</span>
            </div>
          )}
          <div className="flex gap-2 justify-center flex-wrap">
            {["❤️", "🔥", "🤔", "😂"].map((e) => (
              <button
                key={e}
                onClick={() => sendReaction(e)}
                aria-label={`Send ${e} reaction`}
                className="focus-ring h-11 w-11 rounded-full bg-secondary/60 hover:bg-secondary/80 border border-white/[0.10] text-xl transition-all active:scale-90 hover:-translate-y-0.5 hover:border-amber/30"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-card/70 overflow-hidden shadow-[0_22px_60px_-22px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)]">
        {silence ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">🤫</div>
            <div className="font-serif italic text-cream text-lg">Silence, chosen by {djName}</div>
          </div>
        ) : videoId ? (
          <div className="flex items-center gap-4 p-4">
            {meta?.thumbnail_url ? (
              <img src={meta.thumbnail_url} alt="" className="w-24 h-24 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-muted shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Now playing</div>
              <div className="text-cream truncate font-serif italic">{meta?.title ?? nowPlaying?.title ?? "Loading…"}</div>
              {meta?.author_name && <div className="text-xs text-muted-foreground truncate">{meta.author_name}</div>}
            </div>
            {isDJ && (
              <button onClick={togglePlayPause} className="h-10 w-10 shrink-0 rounded-full bg-amber text-primary-foreground flex items-center justify-center hover:bg-amber/90 transition">
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground font-serif italic">
            {isDJ ? "your turn, paste a link or pick silence" : currentDj ? `waiting for ${djName}…` : "paste a link to start the music"}
          </div>
        )}
      </div>
    </div>
  );
}
