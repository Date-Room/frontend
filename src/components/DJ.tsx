import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Music,
} from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useActivitySession } from "@/hooks/useActivitySession";
import { getLimits } from "@/lib/catalogRuntime";
import type { YoutubeIframeApiPlayer, YoutubePlayerStateChangeEvent } from "@/types/youtubeIframeApi";
import { cn } from "@/lib/utils";

/**
 * DJ — audio-player redesign mirroring mobile's `_DjTray*` widgets.
 *
 * Layout (top-to-bottom):
 *  1. Now-playing card — big 16:9 YouTube thumbnail (accent gradient
 *     fallback) + track title + channel.
 *  2. Centred transport row — Prev / big accent-filled Play-Pause /
 *     Next.
 *  3. Local volume slider (per-device).
 *  4. UP NEXT · N — compact 44pt queue tiles. (Web has a single
 *     now_playing today; section is hidden when nothing's queued.)
 *  5. Paste-URL field — only visible to the active DJ.
 *  6. DJ footer card — status copy + Take / End turn button.
 *
 * Empty stage (no track): accent-tinted gradient + queue_music icon
 * + 'Paste a YouTube link below to start the queue'.
 *
 * Wire-format + playback semantics unchanged from prior version so
 * the cross-platform sync keeps working.
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
  } catch { /* fall through */ }
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
  const queue = useMemo<DjTrack[]>(() => {
    const raw = durable?.queue;
    if (!Array.isArray(raw)) return [];
    return raw.filter((t): t is DjTrack => !!t && typeof (t as DjTrack).id === "string");
  }, [durable?.queue]);
  const playing = durable?.playing === true;
  const silence = durable?.silence === true;
  const videoId = nowPlaying?.video_id ?? null;
  const dTsRef = useRef(0);
  dTsRef.current = typeof durable?.timestamp_seconds === "number" ? (durable.timestamp_seconds as number) : 0;
  const isDJ = currentDj != null && currentDj === userId;

  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
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
        queue,
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

  // Hidden YouTube player.
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
            } catch { /* ignore */ }
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
      } catch { /* ignore */ }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMountDJPlayer, videoId]);

  // Partner playback events.
  useEffect(() => {
    if (!session) return;
    return session.onEvent((e) => {
      if (e.userId === userId) return;
      const p = playerRef.current;
      const ts = typeof e.payload.timestamp_seconds === "number" ? e.payload.timestamp_seconds : undefined;
      if (e.type === "enqueue") {
        const track = e.payload.track as Record<string, unknown> | undefined;
        if (track && room.canPersist) {
          // First track auto-plays. Subsequent enqueues go to the
          // tail of the queue so the current track plays through
          // instead of getting clobbered (mirrors mobile's
          // DjModule.reduce on DjEvent.enqueue).
          if (nowPlaying == null) {
            const turnPatch = currentDj
              ? turn
              : {
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
          } else {
            persistDj({ queue: [...queue, track as unknown as DjTrack] });
          }
        }
        return;
      }
      if (e.type === "skip_to_next" || e.type === "end_turn") {
        // Advance the queue locally so partners stay in sync. Only the
        // current DJ's skip mutates state (mirrors mobile guard).
        if (!room.canPersist) return;
        if (e.type === "skip_to_next" && e.userId !== currentDj) return;
        if (queue.length === 0) {
          // Nothing queued — clear now_playing and (for end_turn) the
          // turn itself; skip just stops the music.
          if (e.type === "end_turn") {
            persistDj({
              turn: { current_dj: null, turn_started_at: null },
              now_playing: null,
              queue: [],
              playing: false,
              timestamp_seconds: 0,
              silence: false,
            });
          } else {
            persistDj({ now_playing: null, playing: false, timestamp_seconds: 0 });
          }
          return;
        }
        // Shift queue → now_playing. end_turn from a non-DJ doesn't
        // touch state (only the DJ can end their turn) but skip_to_next
        // from the DJ does.
        if (e.type === "end_turn" && e.userId !== currentDj) return;
        const [next, ...rest] = queue;
        persistDj({
          now_playing: next,
          queue: rest,
          playing: true,
          timestamp_seconds: 0,
        });
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
        } catch { /* ignore */ }
      } else if ((e.type === "seek" || e.type === "tick") && p?.getCurrentTime && ts != null) {
        const local = p.getCurrentTime() ?? 0;
        if (Math.abs(ts - local) > 0.8) {
          suppress(1500);
          try {
            p.seekTo(ts, true);
          } catch { /* ignore */ }
        }
      }
    });
  }, [session, userId, room.canPersist]);

  // DJ drift heartbeat.
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

  // Floating reactions.
  useEffect(() => {
    if (!session) return;
    return session.onReaction((r) => {
      const id = crypto.randomUUID();
      setReactions((list) => [...list, { id, emoji: r.kind }]);
      setTimeout(() => setReactions((list) => list.filter((x) => x.id !== id)), 2400);
    });
  }, [session]);

  // Mute the player when Watch tab is foregrounded.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (watchActive) p.mute?.();
      else {
        p.unMute?.();
        p.setVolume?.(volume);
      }
    } catch { /* ignore */ }
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
      // Broadcast the enqueue so the partner can mirror; their reducer
      // appends to queue if something's already playing.
      void session?.sendEvent("enqueue", { track });
      if (nowPlaying != null) {
        // A track is already playing — append to OUR queue (the partner's
        // enqueue-listener does the same on their side).
        persistDj(
          { queue: [...queue, track] },
          { event_type: "queued_track", payload: { text: `youtu.be/${id}` } },
        );
        void fetchOEmbed(id).then((m) => {
          if (m) {
            // Patch the queued track with metadata once it lands. We
            // re-read the latest queue snapshot at apply time so we
            // don't clobber concurrent enqueues; the lookup is by id.
            persistDj({
              queue: [...queue, track].map((t) =>
                t.id === track.id
                  ? { ...t, title: m.title, channel_title: m.author_name }
                  : t,
              ),
            });
          }
        });
        return;
      }
      // Empty stage — start playback immediately.
      const nextTurn = currentDj
        ? { ...turn, turn_started_at: turn.turn_started_at ?? new Date().toISOString() }
        : { current_dj: userId, turn_started_at: new Date().toISOString() };
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
        } catch { /* ignore */ }
      }
      void fetchOEmbed(id).then((m) => {
        if (m) persistDj({ now_playing: { ...track, title: m.title, channel_title: m.author_name } });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, userId, currentDj, turn, nowPlaying, queue],
  );

  const playUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractId(url.trim());
    if (!id) {
      setUrlError("Drop a YouTube link.");
      return;
    }
    setUrlError(null);
    playId(id);
    setUrl("");
  };

  const passAux = () => {
    // If there's anything queued, "next" means advance the queue,
    // not end the turn — matches mobile's distinct
    // skipToNext vs endTurn events.
    if (queue.length > 0) {
      const [nextTrack, ...rest] = queue;
      void session?.sendEvent("skip_to_next", {});
      persistDj({
        now_playing: nextTrack,
        queue: rest,
        playing: true,
        timestamp_seconds: 0,
      });
      return;
    }
    // Empty queue — pass the aux to the partner (or clear if no partner).
    const next = partnerId ?? null;
    void session?.sendEvent("end_turn", {});
    persistDj({
      turn: { current_dj: next, turn_started_at: next ? new Date().toISOString() : null },
      now_playing: null,
      queue: [],
      playing: false,
      timestamp_seconds: 0,
      silence: false,
    });
  };

  const takeTurn = () => {
    const turnPatch = {
      current_dj: userId,
      turn_started_at: new Date().toISOString(),
    };
    persistDj({ turn: turnPatch });
  };

  const togglePlayPause = () => {
    if (!videoId) return;
    const time = playerRef.current?.getCurrentTime?.() ?? dTsRef.current;
    if (playing) {
      void session?.sendEvent("pause", { timestamp_seconds: time });
      persistDj({ playing: false, timestamp_seconds: time });
      suppress(2000);
      try {
        playerRef.current?.pauseVideo?.();
      } catch { /* ignore */ }
    } else {
      void session?.sendEvent("play", { timestamp_seconds: time });
      persistDj({ playing: true, timestamp_seconds: time, silence: false });
      suppress(5000);
      try {
        playerRef.current?.unMute?.();
        playerRef.current?.playVideo?.();
      } catch { /* ignore */ }
    }
  };

  const enableAudio = () => {
    try {
      playerRef.current?.unMute?.();
      playerRef.current?.setVolume?.(volume);
      playerRef.current?.playVideo?.();
    } catch { /* ignore */ }
    setNeedsAudioGesture(false);
  };

  // Track title / channel — prefer oEmbed metadata when it's landed.
  const trackTitle = meta?.title ?? nowPlaying?.title ?? null;
  const trackChannel = meta?.author_name ?? nowPlaying?.channel_title ?? null;
  const trackId = videoId;
  const thumb = trackId ? `https://i.ytimg.com/vi/${trackId}/mqdefault.jpg` : null;

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    // Desktop docked-panel mode (lg+) gives the activity ~46vw and a
    // tall canvas — widen the inner padding + spacing so the player
    // breathes. Mobile / sm / md keep the existing tight rhythm.
    <div className="relative flex h-full flex-col gap-5 overflow-y-auto p-4 sm:p-6 lg:gap-6 lg:p-7 xl:gap-7 xl:p-8">
      {/* Floating emoji reactions */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
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

      {/* Hidden audio-only YT mount. */}
      {shouldMountDJPlayer && (
        <div className="pointer-events-none fixed bottom-2 right-2" style={{ width: 320, height: 180, opacity: 0.001, zIndex: -1 }} aria-hidden>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>
      )}

      {/* ───────── 1. Player card ───────── */}
      <section className="flex flex-col gap-3">
        {/* Big 16:9 album art — accent-tinted gradient fallback so the
            slot never reads as a hole. */}
        <div
          className="relative aspect-video w-full overflow-hidden rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--room-accent) 30%, transparent), color-mix(in srgb, var(--room-accent) 4%, transparent))",
          }}
        >
          {silence ? (
            <div className="flex h-full w-full items-center justify-center text-5xl">🤫</div>
          ) : thumb ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img
                src={thumb}
                className="h-full w-full object-cover"
                onError={(e) => ((e.currentTarget.style.display = "none"))}
              />
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)" }}
                aria-hidden
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music
                className="h-12 w-12"
                style={{ color: "color-mix(in srgb, var(--room-accent) 55%, transparent)" }}
                strokeWidth={1.5}
              />
            </div>
          )}
        </div>

        {/* Title + channel — bigger typographic mass on desktop where
            we have the room for it. */}
        <div>
          <p className="truncate text-base font-semibold text-cream lg:text-lg">
            {silence
              ? `Silence, chosen by ${djName}`
              : trackTitle ?? "Nothing playing yet"}
          </p>
          {!silence && trackChannel ? (
            <p className="truncate text-xs text-muted-foreground lg:text-sm">{trackChannel}</p>
          ) : !silence && !trackTitle ? (
            <p className="text-xs text-muted-foreground lg:text-sm">Paste a YouTube link below to start the queue.</p>
          ) : null}
        </div>

        {/* ───────── 2. Transport row ─────────
            "Next" is enabled when there's something to advance to:
            either a queued track (skip-to-next), or a partner who can
            take the aux when the queue's empty. Either way, it only
            functions for the active DJ. */}
        <TransportRow
          playing={playing}
          enabled={Boolean(videoId)}
          canSkip={isDJ && (queue.length > 0 || Boolean(partnerId))}
          onTogglePlay={togglePlayPause}
          onNext={passAux}
        />

        {needsAudioGesture && playing && (
          <button
            onClick={enableAudio}
            className="w-full rounded-full py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            Tap to enable audio
          </button>
        )}

        {/* ───────── 3. Volume slider ───────── */}
        {videoId && (
          <div className="flex items-center gap-3 px-1">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="flex-1"
              style={{ accentColor: "var(--room-accent)" }}
            />
            <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{volume}</span>
          </div>
        )}
      </section>

      {/* ───────── 4. UP NEXT ─────────
          Compact list of queued tracks. Mirrors mobile's _DjUpNextList:
          44pt tiles with a thumbnail and the track title. DJ-only
          "Clear" affordance lives in the section header. */}
      {queue.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Up next · {queue.length}
            </p>
            {isDJ && (
              <button
                type="button"
                onClick={() => persistDj({ queue: [] })}
                className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-cream"
              >
                Clear
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-1">
            {queue.map((t, idx) => {
              const tThumb = t.video_id
                ? `https://i.ytimg.com/vi/${t.video_id}/mqdefault.jpg`
                : null;
              return (
                <li
                  key={`${t.id}-${idx}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-card/40 px-2 py-1.5"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-secondary">
                    {tThumb ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <img src={tThumb} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        ▶
                      </div>
                    )}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-[13px] text-cream">
                    {t.title || "Track"}
                  </p>
                  {isDJ && (
                    <button
                      type="button"
                      onClick={() =>
                        persistDj({
                          queue: queue.filter((_, i) => i !== idx),
                        })
                      }
                      aria-label="Remove from queue"
                      className="text-[11px] text-muted-foreground transition hover:text-cream"
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ───────── 5. Paste-URL field — DJ-only ───────── */}
      {isDJ && (
        <form onSubmit={playUrl} className="space-y-1">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Add a track
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
      )}

      {/* ───────── 6. DJ footer card ───────── */}
      <DjFooter
        hasDj={Boolean(currentDj)}
        isDj={isDJ}
        djName={djName}
        remainingLabel={currentDj ? `${mm}:${ss}` : null}
        onTake={takeTurn}
        onEnd={passAux}
      />
    </div>
  );
}

/* ─────────────────────── Transport row ─────────────────────── */

function TransportRow({
  playing,
  enabled,
  canSkip,
  onTogglePlay,
  onNext,
}: {
  playing: boolean;
  enabled: boolean;
  canSkip: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-5 py-2">
      {/* Prev — placeholder. Web state-machine only walks forward, so
          the button stays disabled. Kept visible so the transport reads
          complete. */}
      <button
        type="button"
        disabled
        aria-label="Previous (unavailable)"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground/40"
      >
        <SkipBack className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* Big play/pause disc — 64pt accent-filled with shadow. */}
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={!enabled}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full text-primary-foreground transition-transform",
          enabled ? "hover:scale-105 active:scale-95" : "opacity-40",
        )}
        style={{
          backgroundColor: "var(--room-accent)",
          boxShadow: "0 10px 30px var(--room-accent-soft)",
        }}
      >
        {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!canSkip}
        aria-label="Pass the aux"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
          canSkip ? "text-cream hover:bg-white/10" : "text-muted-foreground/40",
        )}
      >
        <SkipForward className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}

/* ─────────────────────── Footer card ─────────────────────── */

function DjFooter({
  hasDj,
  isDj,
  djName,
  remainingLabel,
  onTake,
  onEnd,
}: {
  hasDj: boolean;
  isDj: boolean;
  djName: string;
  remainingLabel: string | null;
  onTake: () => void;
  onEnd: () => void;
}) {
  const statusLine = !hasDj
    ? "Nobody's DJ yet — take the aux to start the queue."
    : isDj
      ? `You're the DJ${remainingLabel ? ` · ${remainingLabel} left` : ""}`
      : `${djName} is the DJ${remainingLabel ? ` · ${remainingLabel} left` : ""}`;

  return (
    <div className="mt-auto rounded-2xl border border-white/[0.06] bg-card/50 p-4">
      <div className="flex items-center gap-3">
        <Music className="h-4 w-4" style={{ color: "var(--room-accent)" }} />
        <p className="flex-1 text-sm text-cream">{statusLine}</p>
        {!hasDj && (
          <button
            type="button"
            onClick={onTake}
            className="rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            Take turn
          </button>
        )}
        {isDj && (
          <button
            type="button"
            onClick={onEnd}
            className="rounded-full border px-4 py-1.5 text-xs font-semibold hover:bg-[var(--room-accent)]/10"
            style={{
              borderColor: "color-mix(in srgb, var(--room-accent) 40%, transparent)",
              color: "var(--room-accent)",
            }}
          >
            End turn
          </button>
        )}
      </div>
    </div>
  );
}
