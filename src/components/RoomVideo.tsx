import { useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track, DisconnectReason } from "livekit-client";
import { toast } from "sonner";
import "@livekit/components-styles";
import { Mic, MicOff, Video, VideoOff, Camera, PhoneOff, Maximize2, Minimize2, Minus, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInvitedGuestName } from "@/lib/invitedGuest";
import { livekitToken } from "@/lib/rooms";
import { useRoomSession } from "@/context/RoomSessionContext";
import type { PresenceState } from "@/lib/realtime/roomChannel";

const REACTIONS = ["❤️", "🔥", "😂", "🤔", "🥹"];

function partnerNameFromPresence(
  presence: PresenceState[],
  senderId: string,
  roomId: string,
): { name: string; photoUrl: string | null } {
  const entry = presence.find((p) => {
    const sid =
      (typeof p.sender_id === "string" && p.sender_id) ||
      (typeof p.user_id === "string" && p.user_id) ||
      "";
    return Boolean(sid) && sid !== senderId;
  });
  const fromPresence =
    (typeof entry?.name === "string" && entry.name) ||
    (typeof entry?.display_name === "string" && entry.display_name) ||
    null;
  const photoUrl = (typeof entry?.photo_url === "string" && entry.photo_url) || null;
  const invited = getInvitedGuestName(roomId);
  return { name: fromPresence || invited || "Partner", photoUrl };
}

type FloatingReaction = { id: string; emoji: string; left: number };

/** Floating-emoji overlay + double-tap-to-react, synced over the room channel. */
function ReactionsLayer() {
  const room = useRoomSession();
  const [items, setItems] = useState<FloatingReaction[]>([]);

  function spawn(emoji: string) {
    const id = crypto.randomUUID();
    setItems((p) => [...p, { id, emoji, left: 20 + Math.random() * 55 }]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 2200);
  }

  useEffect(() => {
    return room.channel.onBroadcast((e) => {
      if (e.kind !== "reaction") return;
      if (e.payload.from === room.senderId) return; // own echo already shown
      spawn(typeof e.payload.kind === "string" ? e.payload.kind : "❤️");
    });
  }, [room.channel, room.senderId]);

  // Expose a send function on the element via a custom event listener.
  useEffect(() => {
    function onSend(ev: Event) {
      const emoji = (ev as CustomEvent<string>).detail;
      spawn(emoji);
      void room.channel.broadcast("reaction", {
        kind: emoji,
        from: room.senderId,
        target: null,
        sent_at: new Date().toISOString(),
      });
    }
    window.addEventListener("dr-react", onSend);
    return () => window.removeEventListener("dr-react", onSend);
  }, [room.channel, room.senderId]);

  return (
    <>
      <style>{`@keyframes dr-float-up{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1;transform:translateY(-16px) scale(1.1)}100%{transform:translateY(-220px) scale(1.25);opacity:0}}`}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
        {items.map((r) => (
          <span key={r.id} className="absolute bottom-24 text-4xl" style={{ left: `${r.left}%`, animation: "dr-float-up 2.2s ease-out forwards" }}>
            {r.emoji}
          </span>
        ))}
      </div>
    </>
  );
}

function sendReaction(emoji: string) {
  window.dispatchEvent(new CustomEvent("dr-react", { detail: emoji }));
}

/** Composite the two on-screen videos into a framed keepsake (mobile parity). */
function capturePhoto(
  partnerEl: HTMLVideoElement | null,
  selfEl: HTMLVideoElement | null,
  partnerName: string,
  selfName: string,
) {
  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Warm dark backdrop.
  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, "#1A1410");
  bg.addColorStop(1, "#24160C");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Faint deterministic hearts.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#D4826A";
  ctx.font = "28px serif";
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if ((r + c) % 2 === 0) ctx.fillText("♥", 40 + c * 120, 70 + r * 120);
    }
  }
  ctx.restore();

  const pad = 28;
  const gap = 16;
  const w = (S - pad * 2 - gap) / 2;
  const h = S - pad * 2 - 110; // leave a footer band
  const y = pad;

  const drawTile = (el: HTMLVideoElement | null, x: number, mirror: boolean) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 28);
    ctx.clip();
    if (el && el.videoWidth) {
      const scale = Math.max(w / el.videoWidth, h / el.videoHeight);
      const dw = el.videoWidth * scale;
      const dh = el.videoHeight * scale;
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;
      if (mirror) {
        // Flip around the tile's centre so the self-view reads as the user sees it.
        ctx.translate(x + w / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(x + w / 2), 0);
      }
      ctx.drawImage(el, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#2a2018";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    // Amber rim.
    const rim = ctx.createLinearGradient(x, y, x, y + h);
    rim.addColorStop(0, "rgba(232,166,83,0.7)");
    rim.addColorStop(1, "rgba(232,166,83,0.25)");
    ctx.strokeStyle = rim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 28);
    ctx.stroke();
  };

  drawTile(partnerEl, pad, false);
  drawTile(selfEl, pad + w + gap, true);

  // Footer: names + date.
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,236,210,0.92)";
  ctx.font = "italic 40px Georgia, serif";
  ctx.fillText(`${partnerName} & ${selfName}  ♥`, S / 2, S - 56);
  ctx.fillStyle = "rgba(255,236,210,0.5)";
  ctx.font = "22px Georgia, serif";
  ctx.fillText(new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }), S / 2, S - 24);

  const url = canvas.toDataURL("image/jpeg", 0.94);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dateroom-${Date.now()}.jpg`;
  a.click();
}


/* ── Beauty-filtered video tile ── */

const BEAUTY_CSS = [
  "brightness(1.06)",
  "contrast(0.95)",
  "saturate(1.08)",
  "blur(0.3px)",       // subtle skin smoothing
].join(" ");

/** Camera-off placeholder — the person's initial in a disc with a ring that
 *  pulses while they're speaking, so the call still feels alive. */
function SpeakingAvatar({
  trackRef,
  label,
}: {
  trackRef: ReturnType<typeof useTracks>[number];
  label: string;
}) {
  const speaking = useIsSpeaking(trackRef.participant);
  const initial = (label || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        {/* Reverberating rings — appear only while speaking. */}
        <span
          className={cn(
            "absolute rounded-full transition-opacity duration-300",
            speaking ? "opacity-100 animate-ping" : "opacity-0",
          )}
          style={{
            width: "6rem",
            height: "6rem",
            background: "color-mix(in srgb, var(--room-accent) 22%, transparent)",
          }}
          aria-hidden
        />
        <span
          className="relative flex h-[clamp(2.75rem,26%,4.5rem)] w-[clamp(2.75rem,26%,4.5rem)] items-center justify-center rounded-full font-serif text-[clamp(1.1rem,1.4vw,1.9rem)] text-primary-foreground transition-shadow duration-200"
          style={{
            backgroundColor: "var(--room-accent)",
            boxShadow: speaking ? "0 0 0 6px color-mix(in srgb, var(--room-accent) 30%, transparent)" : "none",
          }}
        >
          {initial}
        </span>
      </div>
    </div>
  );
}

function Tile({
  participant,
  isLocal,
  label,
}: {
  participant?: ReturnType<typeof useTracks>[number];
  isLocal?: boolean;
  label: string;
}) {
  const cameraOff = !participant || participant.publication?.isMuted;
  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-secondary/80 border border-white/[0.08]"
      style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      {cameraOff || !participant ? (
        participant ? (
          <SpeakingAvatar trackRef={participant} label={label} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-serif italic text-xl sm:text-2xl">
            waiting for them…
          </div>
        )
      ) : (
        <>
          <VideoTrack
            trackRef={participant}
            className={`w-full h-full object-cover ${isLocal ? "scale-x-[-1]" : ""}`}
            style={{ filter: BEAUTY_CSS }}
          />
          {/* Soft-glow overlay — Snapchat-style beauty sheen */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 35%, rgba(255,235,215,0.06) 0%, transparent 65%)",
              mixBlendMode: "soft-light",
            }}
            aria-hidden
          />
        </>
      )}
      <span className="absolute bottom-2.5 left-3 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-cream/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
        {label}
      </span>
    </div>
  );
}

/** Compute grid cols based on participant count for adaptive layout. */
function gridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 6) return "grid-cols-3";
  return "grid-cols-4";
}

/** Adaptive video grid with controls row. Supports 1-N participants. */
type CallControls = {
  /** "full" = fullscreen call (all controls); "pip" = compact floating window. */
  variant?: "full" | "pip";
  /** Alias for pip sizing — used by the session watch-together mini-view. */
  compact?: boolean;
  /** Bubble mode — just the video, no controls (call stays live). */
  collapsed?: boolean;
  /** pip → expand to fullscreen */
  onExpand?: () => void;
  /** full → shrink back to pip */
  onMinimize?: () => void;
  /** pip → collapse to a small bubble */
  onCollapse?: () => void;
  /** pip → rotate portrait/landscape (rendered in the hover controls) */
  onRotate?: () => void;
};

function Stage({
  onLeave,
  variant = "full",
  compact = false,
  collapsed = false,
  onExpand,
  onMinimize,
  onCollapse,
  onRotate,
}: { onLeave: () => void } & CallControls) {
  // Both the together-room PiP (variant="pip") and the session watch mini-view
  // (compact) render the small, single-tile, compact-controls layout.
  const isPip = variant === "pip" || compact;
  const room = useRoomSession();
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const local = cameraTracks.find((t) => t.participant.isLocal);
  const remotes = cameraTracks.filter((t) => !t.participant.isLocal);

  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const partnerWrapRef = useRef<HTMLDivElement>(null);
  const selfWrapRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const partnerDisplay = useMemo(
    () => partnerNameFromPresence(room.presence, room.senderId, room.roomId),
    [room.presence, room.senderId, room.roomId],
  );

  function scheduleCapture(at: number) {
    const tick = () => {
      const left = Math.ceil((at - Date.now()) / 1000);
      if (left > 0) {
        setCountdown(left);
        window.setTimeout(tick, 250);
      } else {
        setCountdown(null);
        const pName = partnerNameFromPresence(room.presence, room.senderId, room.roomId).name;
        capturePhoto(
          partnerWrapRef.current?.querySelector("video") ?? null,
          selfWrapRef.current?.querySelector("video") ?? null,
          pName,
          room.displayName || "You",
        );
      }
    };
    tick();
  }

  useEffect(() => {
    return room.channel.onBroadcast((e) => {
      if (e.kind !== "capture") return;
      const at = typeof e.payload.capture_at === "number" ? e.payload.capture_at : Date.now() + 3000;
      scheduleCapture(at);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.channel]);

  function startCapture() {
    const at = Date.now() + 3200;
    void room.channel.broadcast("capture", { capture_at: at, from: room.senderId });
    scheduleCapture(at);
  }

  // Total tile count: self + remotes (or self + 1 placeholder when alone)
  const tileCount = 1 + Math.max(1, remotes.length);

  // Collapsed bubble — just the primary video, no controls. Call stays live.
  if (collapsed) {
    const primary = remotes[0] ?? local;
    return (
      <div className="h-full w-full">
        {primary ? (
          <Tile
            participant={primary}
            isLocal={primary === local}
            label={remotes[0]?.participant.name || partnerDisplay.name || "you"}
          />
        ) : (
          <Tile label="…" />
        )}
      </div>
    );
  }

  // PiP — video fills the frame; controls fade in on hover.
  if (isPip) {
    const ctrlBtn =
      "flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-cream backdrop-blur-md transition hover:bg-black/65";
    return (
      <div className="group relative h-full w-full overflow-hidden rounded-xl bg-black">
        <ReactionsLayer />
        <div ref={partnerWrapRef} className="absolute inset-0">
          {remotes.length > 0 ? (
            <Tile participant={remotes[0]} label={remotes[0].participant.name || partnerDisplay.name} />
          ) : (
            <Tile participant={local} isLocal label="you" />
          )}
        </div>
        {countdown != null && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30">
            <span
              className="font-serif text-[72px] leading-none drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]"
              style={{ color: "var(--room-accent)" }}
            >
              {countdown}
            </span>
          </div>
        )}
        {/* Hover controls — scrim + fade/slide in. stopPropagation so the
            buttons don't start a window drag on the parent. */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex translate-y-1 items-center justify-center gap-1.5 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2 pb-2 pt-8 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
        >
          <button
            onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
            className={ctrlBtn}
          >
            {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-rose" />}
          </button>
          <button
            onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
            aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
            className={ctrlBtn}
          >
            {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-rose" />}
          </button>
          {onExpand && (
            <button onClick={onExpand} aria-label="Full screen call" className={ctrlBtn}>
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          {onCollapse && (
            <button onClick={onCollapse} aria-label="Collapse call" className={ctrlBtn}>
              <Minus className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onLeave}
            aria-label="Leave call"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/85 text-cream backdrop-blur-md transition hover:bg-destructive"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full relative">
      <ReactionsLayer />

      {countdown != null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 rounded-2xl">
          <span
            className="font-serif text-[140px] leading-none drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]"
            style={{ color: "var(--room-accent)" }}
          >
            {countdown}
          </span>
        </div>
      )}

      {/* Adaptive grid — pip shows a single primary tile; full shows everyone. */}
      {isPip ? (
        <div ref={partnerWrapRef} className="flex-1 min-h-0">
          {remotes.length > 0 ? (
            <Tile participant={remotes[0]} label={remotes[0].participant.name || partnerDisplay.name} />
          ) : (
            <Tile participant={local} isLocal label="you" />
          )}
        </div>
      ) : (
        <div className={`flex-1 min-h-0 grid gap-2 sm:gap-3 ${gridClass(tileCount)} auto-rows-fr`}>
          <div ref={selfWrapRef} className="min-h-0">
            <Tile participant={local} isLocal label="you" />
          </div>
          {remotes.length === 0 ? (
            <div ref={partnerWrapRef} className="min-h-0">
              <Tile label="waiting for them…" />
            </div>
          ) : (
            remotes.map((p, i) => (
              <div key={p.participant.identity} ref={i === 0 ? partnerWrapRef : undefined} className="min-h-0">
                <Tile participant={p} label={p.participant.name || partnerDisplay.name} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Controls row — compact in pip, full otherwise */}
      <div
        className={cn(
          "flex items-center justify-center shrink-0",
          isPip ? "gap-1.5 py-1.5" : "gap-3 py-2",
        )}
      >
        {variant === "full" && onMinimize && (
          <button
            onClick={onMinimize}
            aria-label="Minimize to corner"
            className="h-11 w-11 rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center justify-center transition"
          >
            <Minimize2 className="w-4 h-4 text-cream" />
          </button>
        )}
        <button
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
          className={cn(
            "rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center justify-center transition",
            isPip ? "h-8 w-8" : "h-11 w-11",
          )}
        >
          {isMicrophoneEnabled ? <Mic className="w-4 h-4 text-cream" /> : <MicOff className="w-4 h-4 text-rose" />}
        </button>
        <button
          onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
          aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
          className={cn(
            "rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center justify-center transition",
            isPip ? "h-8 w-8" : "h-11 w-11",
          )}
        >
          {isCameraEnabled ? <Video className="w-4 h-4 text-cream" /> : <VideoOff className="w-4 h-4 text-rose" />}
        </button>
        {!isPip && (
          <button
            onClick={startCapture}
            disabled={countdown != null}
            className="h-11 px-5 rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center gap-2 transition disabled:opacity-50"
          >
            <Camera className="w-4 h-4 text-amber" />
            <span className="text-sm text-cream">Capture moment</span>
          </button>
        )}
        {isPip && onExpand && (
          <button
            onClick={onExpand}
            aria-label="Full screen call"
            className="h-8 w-8 rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center justify-center transition"
          >
            <Maximize2 className="w-4 h-4 text-cream" />
          </button>
        )}
        {isPip && onCollapse && (
          <button
            onClick={onCollapse}
            aria-label="Collapse call"
            className="h-8 w-8 rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center justify-center transition"
          >
            <Minus className="w-4 h-4 text-cream" />
          </button>
        )}
        <button
          onClick={onLeave}
          aria-label="Leave call"
          className={cn(
            "rounded-full bg-destructive/80 hover:bg-destructive flex items-center justify-center gap-2 transition text-cream",
            isPip ? "h-8 w-8" : "h-11 px-5",
          )}
        >
          <PhoneOff className="w-4 h-4" />
          {!isPip && <span className="text-sm">Leave</span>}
        </button>
      </div>
    </div>
  );
}

export function RoomVideo({
  onLeave,
  variant,
  compact,
  collapsed,
  onExpand,
  onMinimize,
  onCollapse,
  onRotate,
}: { onLeave?: () => void } & CallControls = {}) {
  const room = useRoomSession();
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConn(null);
    setError(null);
    void livekitToken(room.roomId, room.participantId)
      .then((t) => {
        if (cancelled) return;
        if (!t.url) {
          setError("Video isn't configured (no LiveKit URL from the server).");
          return;
        }
        setConn({ token: t.token, url: t.url });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not start video.");
      });
    return () => {
      cancelled = true;
    };
  }, [room.roomId, room.participantId]);

  if (error) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{error}</div>;
  }
  if (!conn) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <p className="font-serif italic text-cream text-xl">Lighting the candles…</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={conn.token}
      serverUrl={conn.url}
      connect
      audio
      video
      data-lk-theme="default"
      className="h-full w-full"
      onDisconnected={(reason) => {
        // Only one device per user per room — joining elsewhere takes over the
        // call stream, so this (older) device leaves cleanly.
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
          toast.message("Call moved to your other device.");
          onLeave?.();
        }
      }}
    >
      <Stage
        onLeave={onLeave ?? (() => {})}
        variant={variant}
        compact={compact}
        collapsed={collapsed}
        onExpand={onExpand}
        onMinimize={onMinimize}
        onCollapse={onCollapse}
        onRotate={onRotate}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

