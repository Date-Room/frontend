import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { Mic, MicOff, Video, VideoOff, Camera } from "lucide-react";
import { livekitToken } from "@/lib/rooms";
import { useRoomSession } from "@/context/RoomSessionContext";

const REACTIONS = ["❤️", "🔥", "😂", "🤔", "🥹"];

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

/** Composite the two on-screen videos into a framed square and download it. */
function capturePhoto(partnerEl: HTMLVideoElement | null, selfEl: HTMLVideoElement | null) {
  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Warm backdrop.
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#1A1410");
  g.addColorStop(1, "#24160C");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  const drawTile = (el: HTMLVideoElement | null, x: number, mirror: boolean) => {
    const w = (S - 60) / 2;
    const h = S - 120;
    const y = 30;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 28);
    ctx.clip();
    if (el && el.videoWidth) {
      const scale = Math.max(w / el.videoWidth, h / el.videoHeight);
      const dw = el.videoWidth * scale;
      const dh = el.videoHeight * scale;
      if (mirror) {
        ctx.translate(x + w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(el, w - (dw - w) / 2 - dw + w, y - (dh - h) / 2, dw, dh);
      } else {
        ctx.drawImage(el, x - (dw - w) / 2, y - (dh - h) / 2, dw, dh);
      }
    } else {
      ctx.fillStyle = "#2a2018";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  };
  drawTile(partnerEl, 20, false);
  drawTile(selfEl, S / 2 + 10, true);

  ctx.fillStyle = "rgba(255,236,210,0.85)";
  ctx.font = "italic 34px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(new Date().toLocaleDateString(), S / 2, S - 50);

  const url = canvas.toDataURL("image/jpeg", 0.92);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dateroom-${Date.now()}.jpg`;
  a.click();
}

/** Partner full-bleed, self as a draggable picture-in-picture. */
function Stage() {
  const room = useRoomSession();
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const local = cameraTracks.find((t) => t.participant.isLocal);
  const remote = cameraTracks.find((t) => !t.participant.isLocal);

  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const partnerWrapRef = useRef<HTMLDivElement>(null);
  const selfWrapRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Synced capture: broadcast a target time; both run the 3-2-1, then composite.
  function scheduleCapture(at: number) {
    const tick = () => {
      const left = Math.ceil((at - Date.now()) / 1000);
      if (left > 0) {
        setCountdown(left);
        window.setTimeout(tick, 250);
      } else {
        setCountdown(null);
        capturePhoto(
          partnerWrapRef.current?.querySelector("video") ?? null,
          selfWrapRef.current?.querySelector("video") ?? null,
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
  }, [room.channel]);

  function startCapture() {
    const at = Date.now() + 3200;
    void room.channel.broadcast("capture", { capture_at: at, from: room.senderId });
    scheduleCapture(at);
  }

  // Draggable PIP position.
  const [pos, setPos] = useState({ x: 16, y: 90 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const x = Math.max(8, Math.min(window.innerWidth - 120, e.clientX - dragRef.current.dx));
    const y = Math.max(72, Math.min(window.innerHeight - 200, e.clientY - dragRef.current.dy));
    setPos({ x, y });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="absolute inset-0" onDoubleClick={() => sendReaction("❤️")}>
      {/* Partner */}
      <div ref={partnerWrapRef} className="absolute inset-0">
        {remote ? (
          <VideoTrack trackRef={remote} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="font-serif italic text-cream/70 text-lg">Waiting for them…</p>
          </div>
        )}
      </div>

      <ReactionsLayer />

      {/* Capture countdown */}
      {countdown != null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30">
          <span className="font-serif text-[140px] leading-none text-amber drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
            {countdown}
          </span>
        </div>
      )}

      {/* Self PIP */}
      {local && (
        <div
          ref={selfWrapRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ left: pos.x, top: pos.y }}
          className="absolute z-20 w-[104px] h-[150px] rounded-2xl overflow-hidden border border-white/15 shadow-lg cursor-grab active:cursor-grabbing touch-none"
        >
          {isCameraEnabled ? (
            <VideoTrack trackRef={local} className="w-full h-full object-cover scale-x-[-1]" />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center text-cream/50">
              <VideoOff className="w-5 h-5" />
            </div>
          )}
        </div>
      )}

      {/* Reaction bar + mic/cam controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-black/45 backdrop-blur px-3 py-2">
        <button
          type="button"
          aria-label="Toggle mic"
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition"
        >
          {isMicrophoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-rose" />}
        </button>
        <button
          type="button"
          aria-label="Toggle camera"
          onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition"
        >
          {isCameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-rose" />}
        </button>
        <button
          type="button"
          aria-label="Take a photo together"
          onClick={startCapture}
          disabled={countdown != null}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-white/15" />
        {REACTIONS.map((e) => (
          <button key={e} type="button" onClick={() => sendReaction(e)} className="w-9 h-9 rounded-full hover:bg-white/10 text-lg transition">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RoomVideo() {
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
      <div className="flex h-full items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-rosegold animate-pulse-glow" aria-hidden />
      </div>
    );
  }

  return (
    <LiveKitRoom token={conn.token} serverUrl={conn.url} connect audio video data-lk-theme="default" className="h-full w-full">
      <Stage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
