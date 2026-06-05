/**
 * Persistent media mini-player overlaid on the LiveRoom.
 *
 * Watches the room's DJ + Watch activity sessions. Renders a compact
 * bar at the bottom whenever one of them has a current track / video
 * AND that activity isn't already open in front of the user.
 *
 * Tapping the bar (anywhere outside the transport buttons) asks the
 * parent to open the activity in the tray (mobile) or the docked
 * panel (desktop) — exactly mirrors mobile media_mini_player.dart.
 */
import { useMemo } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { useActivitySession } from "@/hooks/useActivitySession";
import { cn } from "@/lib/utils";

type Props = {
  /** Activity currently open in the tray / docked panel, or null. */
  currentActivityId: string | null;
  /** Open the given activity (id matches the ActivityTray surface ids). */
  onOpenActivity: (id: "dj" | "watch") => void;
  /** Optional bottom offset (e.g. to clear the mobile Activities pill). */
  bottomOffsetPx?: number;
};

type DjTrack = {
  id: string;
  title: string;
  channel_title: string | null;
  video_id: string | null;
};

export function MediaMiniPlayer({ currentActivityId, onOpenActivity, bottomOffsetPx = 0 }: Props) {
  const dj = useActivitySession("dj");
  const watch = useActivitySession("watch");

  // ── DJ state ──
  const djTrack = (dj.state?.now_playing ?? null) as DjTrack | null;
  const djPlaying = dj.state?.playing === true;
  const djSilence = dj.state?.silence === true;
  const djVideoId = djTrack?.video_id ?? null;

  // ── Watch state ──
  const watchVideoId = typeof watch.state?.video_id === "string" ? (watch.state.video_id as string) : null;
  const watchPlaying = watch.state?.playing === true;

  // Active = there's something to render. DJ wins when both are active
  // (matches the audio-leadership model — DJ controls the background
  // audio mount).
  const active = useMemo<"dj" | "watch" | null>(() => {
    if (djVideoId && !djSilence) return "dj";
    if (watchVideoId) return "watch";
    return null;
  }, [djVideoId, djSilence, watchVideoId]);

  // Hide when the activity is already in front of the user.
  if (!active || currentActivityId === active) return null;

  const videoId = active === "dj" ? djVideoId : watchVideoId;
  const playing = active === "dj" ? djPlaying : watchPlaying;
  const title = active === "dj"
    ? djTrack?.title || "Track"
    : `YouTube · ${watchVideoId}`;
  const subtitle = active === "dj"
    ? (djTrack?.channel_title || "DJ")
    : "Watch";
  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null;

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();
    if (active === "dj") {
      const ts = typeof dj.state?.timestamp_seconds === "number" ? (dj.state.timestamp_seconds as number) : 0;
      void dj.session?.sendEvent(playing ? "pause" : "play", { timestamp_seconds: ts });
    } else {
      const ts = typeof watch.state?.timestamp_seconds === "number" ? (watch.state.timestamp_seconds as number) : 0;
      void watch.session?.sendEvent(playing ? "pause" : "play", { timestamp_seconds: ts });
    }
  }

  // Skip-next is DJ-only — Watch has a single video at a time, no
  // queue. (Web DJ doesn't expose multi-track queue either today, so
  // the skip button passes the aux to the partner.)
  const canSkip = active === "dj" && Boolean(djTrack);
  function skipNext(e: React.MouseEvent) {
    e.stopPropagation();
    if (active !== "dj") return;
    void dj.session?.sendEvent("end_turn", {});
  }

  return (
    <button
      type="button"
      onClick={() => onOpenActivity(active)}
      className={cn(
        // Mobile / sm / md — wide pill close to the viewport edges so
        // the title doesn't truncate. Desktop (lg+) — compact max-w-sm
        // capsule docked bottom-centre with a soft drop shadow; the
        // surrounding LiveRoom canvas has the docked activity panel
        // taking up the right column, so a narrow pill keeps the
        // visual weight light.
        "fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.08] bg-black/65 px-2 py-2 pr-3 backdrop-blur-xl transition hover:bg-black/75",
        "w-[min(96vw,520px)] shadow-[0_14px_40px_rgba(0,0,0,0.45)]",
        "lg:w-[384px] lg:shadow-[0_22px_60px_rgba(0,0,0,0.55)]",
      )}
      style={{ bottom: 12 + bottomOffsetPx }}
      aria-label={`Open ${active === "dj" ? "DJ" : "Watch"}`}
    >
      {/* Thumbnail (44pt) */}
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-secondary">
        {thumb ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={thumb} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">▶</div>
        )}
      </div>

      {/* Title + subtitle */}
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13px] font-semibold text-cream">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>

      {/* Play / pause */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground transition hover:opacity-90"
        style={{ backgroundColor: "var(--room-accent)" }}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      {/* Skip-next — DJ only */}
      {canSkip && (
        <button
          type="button"
          onClick={skipNext}
          aria-label="Pass the aux"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cream transition hover:bg-white/10"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      )}
    </button>
  );
}
