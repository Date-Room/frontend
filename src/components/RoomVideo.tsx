import { useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { Mic, MicOff, Video, VideoOff, Camera, PhoneOff } from "lucide-react";
import { getInvitedGuestName } from "@/lib/invitedGuest";
import { livekitToken } from "@/lib/rooms";
import { cn } from "@/lib/utils";
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
    rim.addColorStop(0, "rgba(212,130,106,0.7)");
    rim.addColorStop(1, "rgba(212,130,106,0.25)");
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

function Tile({
  participant,
  isLocal,
  label,
  compact = false,
}: {
  participant?: ReturnType<typeof useTracks>[number];
  isLocal?: boolean;
  label: string;
  compact?: boolean;
}) {
  const cameraOff = !participant || participant.publication?.isMuted;
  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-secondary/80 border border-white/[0.08]"
      style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      {cameraOff || !participant ? (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center text-muted-foreground font-serif italic",
          compact ? "text-xs px-2 text-center" : "text-xl sm:text-2xl",
        )}>
          {participant ? "camera off" : "waiting for them…"}
        </div>
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
      <span className={cn(
        "absolute bottom-2 left-2 uppercase tracking-[0.2em] text-cream/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]",
        compact ? "text-[8px]" : "bottom-2.5 left-3 text-[10px] sm:text-xs",
      )}>
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
function Stage({ onLeave, compact = false }: { onLeave: () => void; compact?: boolean }) {
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

      {/* Adaptive grid — fills available space, aspect ratio set by row height */}
      <div className={cn(
        "flex-1 min-h-0 grid auto-rows-fr",
        compact ? "grid-cols-2 gap-1" : `gap-2 sm:gap-3 ${gridClass(tileCount)}`,
      )}>
        <div ref={selfWrapRef} className="min-h-0">
          <Tile participant={local} isLocal label="you" compact={compact} />
        </div>
        {remotes.length === 0 ? (
          <div ref={partnerWrapRef} className="min-h-0">
            <Tile label="waiting for them…" compact={compact} />
          </div>
        ) : (
          remotes.map((p, i) => (
            <div key={p.participant.identity} ref={i === 0 ? partnerWrapRef : undefined} className="min-h-0">
              <Tile participant={p} label={p.participant.name || partnerDisplay.name} compact={compact} />
            </div>
          ))
        )}
      </div>

      {/* Controls row */}
      <div className={cn(
        "flex items-center justify-center shrink-0",
        compact ? "gap-1.5 py-1" : "gap-3 py-2",
      )}>
        <button
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
          className={cn(
            "rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center justify-center transition",
            compact ? "h-8 w-8" : "h-11 w-11",
          )}
        >
          {isMicrophoneEnabled ? <Mic className={cn("text-cream", compact ? "w-3.5 h-3.5" : "w-4 h-4")} /> : <MicOff className={cn("text-rose", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />}
        </button>
        <button
          onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
          aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
          className={cn(
            "rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center justify-center transition",
            compact ? "h-8 w-8" : "h-11 w-11",
          )}
        >
          {isCameraEnabled ? <Video className={cn("text-cream", compact ? "w-3.5 h-3.5" : "w-4 h-4")} /> : <VideoOff className={cn("text-rose", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />}
        </button>
        {!compact && (
          <>
            <button
              onClick={startCapture}
              disabled={countdown != null}
              className="h-11 px-5 rounded-full bg-secondary/80 hover:bg-muted border border-border flex items-center gap-2 transition disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-amber" />
              <span className="text-sm text-cream">Capture moment</span>
            </button>
            <button
              onClick={onLeave}
              className="h-11 px-5 rounded-full bg-destructive/80 hover:bg-destructive flex items-center gap-2 transition"
            >
              <PhoneOff className="w-4 h-4" />
              <span className="text-sm text-cream">Leave</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function RoomVideo({ onLeave, compact = false }: { onLeave?: () => void; compact?: boolean } = {}) {
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
    <LiveKitRoom token={conn.token} serverUrl={conn.url} connect audio video data-lk-theme="default" className="h-full w-full">
      <Stage onLeave={onLeave ?? (() => {})} compact={compact} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

