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
import { Mic, MicOff, Video, VideoOff, Camera, VideoOff as VideoOffIcon } from "lucide-react";
import { livekitToken } from "@/lib/rooms";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useChromeVisible } from "@/context/ChromeVisibilityContext";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import { cn } from "@/lib/utils";

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

/** Partner avatar at scale with a slow breathing halo. Rendered when
 *  the partner's camera is off OR before their video track lands, so
 *  the room feels open instead of showing a hard "Connecting…" card.
 *  Halo brightens on speech when a Participant is provided.
 *
 *  This variant must be used *inside* a LiveKitRoom (it taps the
 *  `useIsSpeaking` hook). For the pre-connect screen, see
 *  `PreConnectHalo` which renders the same shape statically. */
function PartnerHaloAvatar({
  participant,
  name,
  photoUrl,
  state,
}: {
  participant: Participant;
  name: string;
  photoUrl: string | null;
  /** 'waiting' shows the warm halo + 'we're listening' caption; 'off'
   *  shows the camera-off caption. Both paint the breathing glow. */
  state: "waiting" | "off";
}) {
  const isSpeaking = useIsSpeaking(participant);
  return (
    <HaloAvatarPresentational
      name={name}
      photoUrl={photoUrl}
      state={state}
      isSpeaking={isSpeaking}
    />
  );
}

/** Pure presentational halo avatar — no hooks, safe to render outside
 *  a LiveKitRoom (pre-connect, error states, etc). */
function HaloAvatarPresentational({
  name,
  photoUrl,
  state,
  isSpeaking,
}: {
  name: string;
  photoUrl: string | null;
  state: "waiting" | "off";
  isSpeaking: boolean;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const caption = state === "waiting" ? "we're listening" : isSpeaking ? "speaking" : "camera off";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
      <div className="relative">
        {/* Outer breathing bloom — slow, low-amplitude. Brightens on speech. */}
        <span
          aria-hidden
          className="absolute inset-0 -m-16 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--room-accent-soft) 0%, transparent 70%)",
            animation: "breathe-halo 5.5s ease-in-out infinite",
            opacity: isSpeaking ? 0.95 : undefined,
          }}
        />
        {/* Inner accent ring — punchy ping when speaking. */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 -m-4 rounded-full border transition-all duration-300",
            isSpeaking ? "scale-110 opacity-100" : "scale-100 opacity-40",
          )}
          style={{ borderColor: "color-mix(in srgb, var(--room-accent) 55%, transparent)" }}
        />
        {/* Avatar disc */}
        <div
          className="relative flex h-32 w-32 sm:h-40 sm:w-40 items-center justify-center overflow-hidden rounded-full border-2 transition-shadow duration-300"
          style={{
            borderColor: "color-mix(in srgb, var(--room-accent) 70%, transparent)",
            boxShadow: isSpeaking
              ? "0 0 80px var(--room-accent-soft), inset 0 0 0 1px rgba(255,255,255,0.06)"
              : "0 22px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.06)",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--room-accent) 30%, transparent), color-mix(in srgb, var(--room-accent) 12%, transparent), transparent)",
          }}
        >
          <UserAvatarImg
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <span className="font-serif text-6xl sm:text-7xl text-cream">{initial}</span>
            }
          />
        </div>
      </div>
      <div className="text-center">
        <p className="font-serif italic text-cream text-lg">{name || "Partner"}</p>
        <p
          className={cn(
            "mt-1.5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] transition-colors",
            isSpeaking || state === "waiting" ? "" : "text-muted-foreground/60",
          )}
          style={
            isSpeaking || state === "waiting"
              ? { color: "var(--room-accent)" }
              : undefined
          }
        >
          {state === "off" && <VideoOffIcon className="h-3 w-3" aria-hidden />}
          {caption}
        </p>
      </div>
    </div>
  );
}

/** Partner full-bleed, self as a draggable picture-in-picture. */
function Stage() {
  const room = useRoomSession();
  const chromeVisible = useChromeVisible();
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

  // Draggable PIP. Default bottom-right (PIP_W + 24px from each edge);
  // computed inside an effect so SSR / first paint doesn't crash on
  // `window`. Re-clamps to the viewport on resize so a window-shrink
  // doesn't strand the PIP off-screen.
  const PIP_W = 132;
  const PIP_H = 188;
  const PIP_PAD = 20;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  useEffect(() => {
    const place = () => {
      const x = Math.max(PIP_PAD, window.innerWidth - PIP_W - PIP_PAD);
      const y = Math.max(PIP_PAD, window.innerHeight - PIP_H - PIP_PAD - 96);
      setPos((cur) => {
        if (!cur) return { x, y };
        // Re-clamp; don't reset a user-chosen position unless it's now
        // off-screen.
        return {
          x: Math.min(Math.max(PIP_PAD, cur.x), window.innerWidth - PIP_W - PIP_PAD),
          y: Math.min(Math.max(PIP_PAD, cur.y), window.innerHeight - PIP_H - PIP_PAD),
        };
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (!pos) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const x = Math.max(PIP_PAD, Math.min(window.innerWidth - PIP_W - PIP_PAD, e.clientX - dragRef.current.dx));
    const y = Math.max(PIP_PAD, Math.min(window.innerHeight - PIP_H - PIP_PAD, e.clientY - dragRef.current.dy));
    if (Math.hypot(e.movementX, e.movementY) > 1) dragRef.current.moved = true;
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

  // What to render in the main stage:
  //   - partner video on, track subscribed → VideoTrack
  //   - partner present but cam off → halo avatar (state="off")
  //   - no partner yet → halo avatar (state="waiting", no participant)
  const remoteMuted = remote?.publication?.isMuted === true;
  const showVideo = remote && !remoteMuted;

  return (
    <div className="absolute inset-0" onDoubleClick={() => sendReaction("❤️")}>
      {/* Partner — full-bleed inside the stage frame. The frame itself
          is painted by LiveRoom (rounded card on desktop, edge-to-edge
          on mobile). */}
      <div ref={partnerWrapRef} className="absolute inset-0">
        {showVideo ? (
          <VideoTrack trackRef={remote} className="w-full h-full object-cover" />
        ) : remote ? (
          <PartnerHaloAvatar
            participant={remote.participant}
            name={partnerDisplay.name}
            photoUrl={partnerDisplay.photoUrl}
            state="off"
          />
        ) : (
          // No partner participant yet — fall through to the static halo
          // (the `useIsSpeaking` hook needs a participant, and there
          // isn't one to feed it).
          <HaloAvatarPresentational
            name={partnerDisplay.name}
            photoUrl={partnerDisplay.photoUrl}
            state="waiting"
            isSpeaking={false}
          />
        )}
      </div>

      <ReactionsLayer />

      {/* Capture countdown */}
      {countdown != null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30">
          <span
            className="font-serif text-[140px] leading-none drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]"
            style={{ color: "var(--room-accent)" }}
          >
            {countdown}
          </span>
        </div>
      )}

      {/* Self PIP — draggable on desktop, fixed corner on mobile.
          Rounded with a soft accent-tinted shadow that brightens on
          drag. Hidden until pos is computed (avoids a top-left flash). */}
      {local && pos && (
        <div
          ref={selfWrapRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            left: pos.x,
            top: pos.y,
            width: PIP_W,
            height: PIP_H,
            boxShadow:
              "0 18px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10), 0 0 32px var(--room-accent-soft)",
          }}
          className="absolute z-20 rounded-[22px] overflow-hidden cursor-grab active:cursor-grabbing touch-none transition-shadow duration-200"
        >
          {isCameraEnabled ? (
            <VideoTrack trackRef={local} className="w-full h-full object-cover scale-x-[-1]" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-cream/60"
              style={{ background: "linear-gradient(160deg, hsl(22 16% 18%), hsl(22 14% 12%))" }}
            >
              <VideoOff className="w-5 h-5" />
            </div>
          )}
        </div>
      )}

      {/* Bottom control island — glass pill, fades with chrome. Holds
          mic / cam / capture + reactions. Sits above the MediaMiniPlayer
          and Activities pill via the spacer-padding on LiveRoom's main. */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 z-30 transition-all duration-300",
          chromeVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3",
        )}
        style={{ bottom: 24 }}
      >
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-1.5 rounded-full px-2 py-2",
            "backdrop-blur-2xl border border-white/[0.10]",
          )}
          style={{
            background:
              "linear-gradient(180deg, rgba(20,16,12,0.55), rgba(20,16,12,0.72))",
            boxShadow:
              "0 22px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <CallButton
            label={isMicrophoneEnabled ? "Mute" : "Unmute"}
            onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            tone={isMicrophoneEnabled ? "default" : "alert"}
          >
            {isMicrophoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </CallButton>
          <CallButton
            label={isCameraEnabled ? "Camera off" : "Camera on"}
            onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
            tone={isCameraEnabled ? "default" : "alert"}
          >
            {isCameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </CallButton>
          <CallButton
            label="Take a photo together"
            onClick={startCapture}
            disabled={countdown != null}
          >
            <Camera className="w-4 h-4" />
          </CallButton>
          <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => sendReaction(e)}
              aria-label={`React ${e}`}
              className="focus-ring h-9 w-9 rounded-full text-lg transition hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Single control button in the floating island. `tone="alert"` flips
 *  the icon colour to the destructive rose (muted mic / cam off) so
 *  the user can see the state at a glance without the icon being the
 *  cue. Hover surfaces the label as a tooltip caption above. */
function CallButton({
  children,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "alert";
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "focus-ring flex h-10 w-10 items-center justify-center rounded-full transition",
          "bg-white/[0.06] text-cream hover:bg-white/[0.12]",
          tone === "alert" && "text-rose bg-rose/10 hover:bg-rose/15",
          disabled && "opacity-50",
        )}
      >
        {children}
      </button>
      <span
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cream/85 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        aria-hidden
      >
        {label}
      </span>
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
    // Pre-connect we don't yet have the partner's presence Participant
    // either, so a halo avatar with the resolved partner name is
    // friendlier than a literal spinner card. We can pull the name
    // from the room channel's presence (mounted before the LiveKit
    // token resolves).
    return <PreConnectHalo />;
  }

  return (
    <LiveKitRoom token={conn.token} serverUrl={conn.url} connect audio video data-lk-theme="default" className="h-full w-full">
      <Stage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

/** Outside-LiveKitRoom equivalent of the in-Stage halo, used while we
 *  fetch the LiveKit token. Same visual language so the transition
 *  into the call doesn't read as a jump-cut. */
function PreConnectHalo() {
  const room = useRoomSession();
  const partner = useMemo(() => {
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
    <HaloAvatarPresentational
      name={partner.name}
      photoUrl={partner.photoUrl}
      state="waiting"
      isSpeaking={false}
    />
  );
}
