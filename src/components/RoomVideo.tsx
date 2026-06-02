import { useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
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

/** When the partner's camera is off, show their avatar centered with
 * a pulse-on-speech halo so you can tell they're talking even when
 * audio is muted on your side. Reads `isSpeaking` from the remote
 * Participant via the LiveKit context. */
function CameraOffAvatar({
  participant,
  name,
  photoUrl,
}: {
  participant: Participant;
  name: string;
  photoUrl: string | null;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-background/40 via-background/30 to-background/60">
      <div className="relative">
        {/* Halo — pulses when the partner's mic picks them up. Two
            concentric rings so the wave reads even at a glance. */}
        <span
          aria-hidden
          className={[
            "absolute inset-0 -m-6 rounded-full bg-rosegold/25 blur-xl transition-all duration-300",
            isSpeaking ? "scale-125 opacity-100" : "scale-100 opacity-0",
          ].join(" ")}
        />
        <span
          aria-hidden
          className={[
            "absolute inset-0 -m-3 rounded-full border-2 border-rosegold/50 transition-all duration-200",
            isSpeaking
              ? "scale-110 opacity-100 animate-pulse"
              : "scale-100 opacity-0",
          ].join(" ")}
        />
        <div
          className={[
            "relative h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden flex items-center justify-center",
            "border-2 transition-all duration-300",
            isSpeaking
              ? "border-rosegold/80 shadow-[0_0_60px_rgba(212,130,106,0.45)]"
              : "border-white/15 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)]",
            "bg-gradient-to-br from-rosegold/25 via-rosegold/10 to-transparent",
          ].join(" ")}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif text-5xl sm:text-6xl text-cream">{initial}</span>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="font-serif italic text-cream text-base">{name || "Partner"}</p>
        <p
          className={[
            "mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] transition-colors",
            isSpeaking ? "text-rosegold" : "text-muted-foreground/60",
          ].join(" ")}
        >
          <VideoOff className="h-3 w-3" aria-hidden />
          {isSpeaking ? "speaking" : "camera off"}
        </p>
      </div>
    </div>
  );
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
        // Look the partner up by EITHER schema. The web legacy
        // wire shape carries sender_id + name; the canonical
        // mobile-sourced shape carries user_id + display_name.
        // Read both so cross-platform rooms produce the same
        // footer 'Partner & Self ♥' on both sides.
        const partnerName = room.presence
          .map((p) => ({
            id:
              (typeof p.sender_id === "string" && p.sender_id) ||
              (typeof p.user_id === "string" && p.user_id) ||
              "",
            name:
              (typeof p.name === "string" && p.name) ||
              (typeof p.display_name === "string" && p.display_name) ||
              "",
          }))
          .find((p) => p.id && p.id !== room.senderId && p.name)?.name;
        capturePhoto(
          partnerWrapRef.current?.querySelector("video") ?? null,
          selfWrapRef.current?.querySelector("video") ?? null,
          partnerName || "Partner",
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

  // Pull the partner's display name + photo from presence so the
  // camera-off avatar matches what shows in chat/recap. Reads
  // either schema (web's sender_id+name OR the canonical
  // user_id+display_name that mobile clients publish) so
  // cross-platform rooms show the real partner name, not "Them".
  const partnerDisplay = useMemo(() => {
    const me = room.senderId;
    const entry = room.presence.find((p) => {
      const sid =
        (typeof p.sender_id === "string" && p.sender_id) ||
        (typeof p.user_id === "string" && p.user_id) ||
        "";
      return Boolean(sid) && sid !== me;
    });
    const name =
      (typeof entry?.name === "string" && entry.name) ||
      (typeof entry?.display_name === "string" && entry.display_name) ||
      "Partner";
    const photoUrl =
      (typeof entry?.photo_url === "string" && entry.photo_url) || null;
    return { name, photoUrl };
  }, [room.presence, room.senderId]);

  return (
    <div className="absolute inset-0" onDoubleClick={() => sendReaction("❤️")}>
      {/* Partner */}
      <div ref={partnerWrapRef} className="absolute inset-0">
        {remote ? (
          remote.publication?.isMuted ? (
            <CameraOffAvatar
              participant={remote.participant}
              name={partnerDisplay.name}
              photoUrl={partnerDisplay.photoUrl}
            />
          ) : (
            <VideoTrack trackRef={remote} className="w-full h-full object-cover" />
          )
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
