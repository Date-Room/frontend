import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  useRoomContext,
  isTrackReference,
} from "@livekit/components-react";
import {
  Track,
  DisconnectReason,
  RoomEvent,
  VideoPresets,
  setLogLevel,
  type LocalVideoTrack,
  type Participant,
  type RoomOptions,
} from "livekit-client";
import { toast } from "sonner";
import "@livekit/components-styles";
import { Mic, MicOff, Video, VideoOff, Camera, PhoneOff, Minus, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmbientController } from "@/components/AmbientController";
import { ChaperonAgentBridge } from "@/components/ChaperonAgentBridge";
import { CallPeersBridge } from "@/context/CallPeersContext";
import {
  CallSettingsMenu,
  CameraDropup,
  DeviceChangeToaster,
  MicDropup,
} from "@/components/DeviceMenu";
import { loadDevicePreference } from "@/lib/devices";
import { getInvitedGuestName } from "@/lib/invitedGuest";
import { livekitToken } from "@/lib/rooms";
import { useLowPowerMode } from "@/hooks/useLowPowerMode";
import { partnerFromPresence } from "@/lib/stagecraft/usePartnerName";
import { useRoomSession } from "@/context/RoomSessionContext";
import { authClient } from "@/lib/authClient";
import { useVideoOrientation } from "@/lib/videoOrientation";
import { useWideViewport } from "@/lib/viewport";
import type { PresenceState } from "@/lib/realtime/roomChannel";

// Adaptive stream + dynacast let LiveKit stop sending layers nobody is
// watching; simulcast gives ambient mode a defined "lowest" layer to fall
// back to. Stable reference so the Room isn't reconfigured on re-render.
// Info-level livekit logs ("already connected to room …") flooded the
// console once a second — connect re-attempts from re-renders, each a
// guarded no-op. Handlers below are memoized to stop the churn at the
// source; warnings and errors still surface.
setLogLevel("warn");

const LIVEKIT_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  // Ask for 540p rather than letting the browser negotiate its default
  // (often 720p or higher). Acquisition is the slow half of turning a camera
  // back on, and it scales with the resolution being negotiated; this also
  // matches what mobile pins for thermal reasons, so both clients capture the
  // same thing.
  videoCaptureDefaults: {
    resolution: VideoPresets.h540.resolution,
  },
  publishDefaults: {
    simulcast: true,
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
  },
};


const REACTIONS = ["❤️", "🔥", "😂", "🤔", "🥹"];

function partnerNameFromPresence(
  presence: PresenceState[],
  senderId: string,
  roomId: string,
): { name: string; photoUrl: string | null } {
  const p = partnerFromPresence(presence, senderId);
  const invited = getInvitedGuestName(roomId);
  return { name: p.full || invited || "Partner", photoUrl: p.photoUrl };
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

/** "joshua mwaniki" → "Joshua" — keepsake footers get tidy first names. */
function keepsakeName(raw: string): string {
  const first = raw.trim().split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

/** Composite the on-screen video(s) into a framed keepsake (mobile parity).
 *  The photo never leaves the device — it renders to a canvas and saves
 *  straight to the user's downloads; nothing is uploaded.
 *  `partnerName: null` means you're alone: one centered tile, your name only
 *  (live-tested: the two-tile layout drew an empty frame and a literal
 *  "Partner" when someone captured solo). */
function capturePhoto(
  partnerEl: HTMLVideoElement | null,
  selfEl: HTMLVideoElement | null,
  partnerName: string | null,
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

  const solo = partnerName == null;
  const pad = 28;
  const gap = 16;
  // Solo keepsakes get one generous centered tile instead of a half-empty pair.
  const w = solo ? Math.round(S * 0.62) : (S - pad * 2 - gap) / 2;
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

  if (solo) {
    drawTile(selfEl ?? partnerEl, Math.round((S - w) / 2), true);
  } else {
    drawTile(partnerEl, pad, false);
    drawTile(selfEl, pad + w + gap, true);
  }

  // Footer: first name(s) + date.
  const footer = solo
    ? `${keepsakeName(selfName)}  ♥`
    : `${keepsakeName(partnerName)} & ${keepsakeName(selfName)}  ♥`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,236,210,0.92)";
  ctx.font = "italic 40px Georgia, serif";
  ctx.fillText(footer, S / 2, S - 56);
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

// Full look on capable devices. The blur() and the soft-light overlay are the
// expensive per-frame recomposites, so low-power/thermally-pressured devices
// get the cheap color-only path (see LITE_CSS) to avoid overheating.
const BEAUTY_CSS = [
  "brightness(1.06)",
  "contrast(0.95)",
  "saturate(1.08)",
  "blur(0.3px)",       // subtle skin smoothing
].join(" ");
const LITE_CSS = ["brightness(1.05)", "saturate(1.06)"].join(" ");

/** One AudioContext for the page. Browsers cap how many you may open, and a
 *  call has two of these avatars. */
let rippleCtx: AudioContext | null = null;
function sharedAudioContext(): AudioContext | null {
  try {
    rippleCtx ??= new AudioContext();
    if (rippleCtx.state === "suspended") void rippleCtx.resume();
    return rippleCtx;
  } catch {
    return null;
  }
}

/**
 * Drives the camera-off halo from the participant's live microphone.
 *
 * Deliberately writes to the DOM from a rAF loop instead of going through
 * React state. Two earlier attempts felt wrong for reasons worth recording:
 * LiveKit's `isSpeaking` is a debounced boolean, so it arrived late and could
 * only say yes/no; and driving a per-frame value through state plus a CSS
 * `transition` double-smooths it — every new sample restarts a fresh
 * interpolation, which reads as lag and mush, on top of re-rendering the
 * subtree 60 times a second.
 *
 * So: sample the analyser each frame, smooth the VALUE (fast attack, slow
 * release — how a level meter behaves), and write transform/opacity straight
 * to the nodes. No transitions, no re-renders.
 */
function useVoiceRipple(
  participant: Participant,
  ringRef: React.RefObject<HTMLSpanElement | null>,
  discRef: React.RefObject<HTMLSpanElement | null>,
) {
  useEffect(() => {
    const ctx = sharedAudioContext();
    if (!ctx) return;

    let raf = 0;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let sink: GainNode | null = null;
    let data: Uint8Array | null = null;
    let attachedId: string | null = null;
    let smoothed = 0;

    const detach = () => {
      source?.disconnect();
      analyser?.disconnect();
      sink?.disconnect();
      source = null;
      analyser = null;
      sink = null;
      data = null;
      attachedId = null;
    };

    const attach = (mst: MediaStreamTrack) => {
      detach();
      try {
        source = ctx.createMediaStreamSource(new MediaStream([mst]));
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        // Our own smoothing below is what shapes the feel; keep the
        // analyser's own averaging light so it stays responsive.
        analyser.smoothingTimeConstant = 0.2;
        // A muted sink: some browsers only run a graph that reaches a
        // destination, and this keeps a remote track pulling without
        // making any sound of its own.
        sink = ctx.createGain();
        sink.gain.value = 0;
        source.connect(analyser);
        analyser.connect(sink);
        sink.connect(ctx.destination);
        data = new Uint8Array(analyser.fftSize);
        attachedId = mst.id;
      } catch {
        detach();
      }
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);

      // Re-read every frame so a mic that is muted, swapped or subscribed
      // late is picked up without re-running the effect.
      const mst = participant.getTrackPublication(Track.Source.Microphone)?.track
        ?.mediaStreamTrack;
      if (mst && mst.id !== attachedId) attach(mst);
      else if (!mst && attachedId) detach();

      let energy = 0;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // A mic never reads a true zero; drop the floor, then open up what
        // is left so ordinary speech uses the whole ring.
        energy = Math.max(0, Math.min(1, (rms - 0.012) * 9));
      }

      // Fast attack so a consonant lands immediately, slower release so it
      // falls away rather than flickering between syllables.
      const k = energy > smoothed ? 0.45 : 0.12;
      smoothed += (energy - smoothed) * k;
      if (smoothed < 0.001) smoothed = 0;

      const ring = ringRef.current;
      if (ring) {
        ring.style.transform = `scale(${(1 + smoothed * 0.3).toFixed(4)})`;
        ring.style.opacity = (smoothed * 0.9).toFixed(3);
      }
      const disc = discRef.current;
      if (disc) {
        disc.style.boxShadow = `0 0 0 ${(smoothed * 9).toFixed(2)}px color-mix(in srgb, var(--room-accent) 30%, transparent)`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      detach();
    };
  }, [participant, ringRef, discRef]);
}

/** Camera-off placeholder — the person's photo, or their initial, in a disc
 *  with a ring that pulses while they're speaking so the call still feels
 *  alive.
 *
 *  Surface treatment matches the activity tray's tiles: a faded wash of the
 *  accent with an outline, rather than a solid fill. Tinting from
 *  `--room-accent` (not a fixed amber) is what keeps it on-theme when the
 *  room is retinted. */
function SpeakingAvatar({
  trackRef,
  label,
  photoUrl,
}: {
  trackRef: ReturnType<typeof useTracks>[number];
  label: string;
  photoUrl?: string | null;
}) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const discRef = useRef<HTMLSpanElement>(null);
  useVoiceRipple(trackRef.participant, ringRef, discRef);
  const initial = (label || "?").trim().charAt(0).toUpperCase() || "?";
  // A photo that fails to load shouldn't leave an empty disc — fall back to
  // the initial, which is what we had before photos.
  const [photoBroken, setPhotoBroken] = useState(false);
  const showPhoto = Boolean(photoUrl) && !photoBroken;
  return (
    // A size container so the disc can be measured against the SMALLER side of
    // the tile (`cqmin`). Sizing it with a plain percentage made it an ellipse
    // — `height: 26%` resolves against the tile's height while `width: 26%`
    // resolves against its width, so any non-square tile stretched it, and the
    // two people ended up different sizes because their tiles differ.
    <div className="absolute inset-0 flex items-center justify-center [container-type:size]">
      <div className="relative flex items-center justify-center">
        {/* The ripple — a halo that breathes with the voice. Transform and
            opacity only (both GPU-composited), interpolated by a short
            transition so the per-frame level reads as motion rather than
            stepping. The old `animate-ping` was a fixed 1s keyframe loop with
            no relationship to what was being said. */}
        <span
          ref={ringRef}
          className="pointer-events-none absolute inset-[-9%] rounded-full"
          style={{
            background: "color-mix(in srgb, var(--room-accent) 22%, transparent)",
            transform: "scale(1)",
            opacity: 0,
            willChange: "transform, opacity",
          }}
          aria-hidden
        />
        <span
          ref={discRef}
          className="relative flex aspect-square w-[clamp(3rem,45cqmin,10.5rem)] items-center justify-center overflow-hidden rounded-full border text-[clamp(1.3rem,19.5cqmin,3.75rem)] leading-none"
          style={{
            backgroundColor: "color-mix(in srgb, var(--room-accent) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--room-accent) 20%, transparent)",
            color: "var(--room-accent)",
            boxShadow: "0 0 0 0 color-mix(in srgb, var(--room-accent) 30%, transparent)",
          }}
        >
          {showPhoto ? (
            <img
              src={photoUrl ?? undefined}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setPhotoBroken(true)}
            />
          ) : (
            initial
          )}
        </span>
      </div>
    </div>
  );
}

function Tile({
  participant,
  isLocal,
  label,
  photoUrl,
  contain,
  square,
  forceOff,
  bare,
}: {
  participant?: ReturnType<typeof useTracks>[number];
  isLocal?: boolean;
  label: string;
  /** Shown instead of the initial while their camera is off. */
  photoUrl?: string | null;
  /** Show the whole camera frame (no crop) so both sides see the same thing. */
  contain?: boolean;
  /** Square corners. A pane that sits flush against the stage makes a
   *  rounded video read as a card inside a card. */
  square?: boolean;
  /** Show the placeholder now, without waiting for the track to report muted.
   *  Your own tile uses this so turning the camera off looks immediate even
   *  though releasing the device doesn't finish for another moment. */
  forceOff?: boolean;
  /** No caption, no card chrome — for round bubbles that bring their own ring. */
  bare?: boolean;
}) {
  // A placeholder ref (no publication yet) can't feed <VideoTrack> — treat it
  // like a muted camera and show the avatar instead.
  const videoTrackRef =
    participant && !forceOff && isTrackReference(participant) && !participant.publication.isMuted
      ? participant
      : undefined;
  const lowPower = useLowPowerMode();
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-black",
        // `bare` drops the chrome entirely (round bubbles bring their own
        // ring); otherwise the only question is whether the corners are
        // rounded, which depends on whether the tile sits flush in a pane.
        !bare && "border border-white/[0.08]",
        !bare && (square ? "rounded-none" : "rounded-2xl"),
      )}
      style={bare ? undefined : { boxShadow: "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      {!videoTrackRef ? (
        participant ? (
          <SpeakingAvatar trackRef={participant} label={label} photoUrl={photoUrl} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-serif italic text-title">
            waiting for them…
          </div>
        )
      ) : (
        <>
          <VideoTrack
            trackRef={videoTrackRef}
            className={`w-full h-full ${isLocal ? "scale-x-[-1]" : ""}`}
            // object-fit is set inline, not as a class. LiveKit's own
            // stylesheet ships `.lk-participant-media-video { object-fit:
            // cover }` at the same specificity as Tailwind's utility and is
            // imported after it, so `object-contain` lost every time and the
            // `contain` prop silently did nothing — every feed was cropped.
            style={{
              objectFit: contain ? "contain" : "cover",
              filter: lowPower ? LITE_CSS : BEAUTY_CSS,
            }}
          />
          {/* Soft-glow overlay — Snapchat-style beauty sheen. Skipped on
              low-power/thermal devices (soft-light blend is costly per frame). */}
          {!lowPower && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 50% 35%, rgba(255,235,215,0.06) 0%, transparent 65%)",
                mixBlendMode: "soft-light",
              }}
              aria-hidden
            />
          )}
        </>
      )}
      {!bare && (
        <span className="absolute bottom-2.5 left-3 text-label uppercase tracking-[0.2em] text-cream/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
          {label}
        </span>
      )}
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
  /** Rendered inside the side pane rather than as a floating window. */
  framed?: boolean;
  /** Alias for pip sizing — used by the session watch-together mini-view. */
  compact?: boolean;
  /** Bubble mode — just the video, no controls (call stays live). */
  collapsed?: boolean;
  /** Bubble as a PAIR: their face large, yours small on its shoulder. */
  pair?: boolean;
  /** Full variant in a narrow pane: stack the two tiles instead of side by side. */
  stacked?: boolean;
  /** pip → collapse to a small bubble */
  onCollapse?: () => void;
  /** pip → rotate portrait/landscape (rendered in the hover controls) */
  onRotate?: () => void;
};

function Stage({
  onLeave,
  variant = "full",
  framed,
  compact = false,
  collapsed = false,
  pair = false,
  stacked = false,
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

  const {
    localParticipant,
    isMicrophoneEnabled: micActual,
    isCameraEnabled: camActual,
  } = useLocalParticipant();
  // The button answers the tap, not the hardware. Turning a camera on takes
  // a moment to negotiate, and a control that sits on its old state until
  // the track is live reads as a missed tap. Show the intent immediately and
  // fall back to the truth if the device refuses.
  const [micWanted, setMicWanted] = useState<boolean | null>(null);
  const [camWanted, setCamWanted] = useState<boolean | null>(null);
  const isMicrophoneEnabled = micWanted ?? micActual;
  const isCameraEnabled = camWanted ?? camActual;
  useEffect(() => {
    if (micWanted !== null && micActual === micWanted) setMicWanted(null);
  }, [micActual, micWanted]);
  useEffect(() => {
    if (camWanted !== null && camActual === camWanted) setCamWanted(null);
  }, [camActual, camWanted]);
  const toggleMic = useCallback(async () => {
    const next = !(micWanted ?? micActual);
    setMicWanted(next);
    try {
      await localParticipant.setMicrophoneEnabled(next);
    } catch {
      setMicWanted(null);
      toast.error(next ? "Couldn't turn the mic on" : "Couldn't mute");
    }
  }, [localParticipant, micWanted, micActual]);
  // The device is released the moment you turn the camera off — no holding it
  // open to make the next switch-on quick, because that keeps the camera light
  // lit while the UI says "off", and that is not a trade worth making here.
  // What is instant is the *appearance*: the button and your own tile flip
  // immediately, and the hardware takes the time it takes underneath.
  // Orientation is enforced at CAPTURE, not on the way out of a <video>.
  // Cropping locally would only change what you see; publishing a stream that
  // is genuinely this shape is what makes the other person see the same
  // framing you do.
  // Not pinned to the layout any more: upstream's side pane is resizable, so
  // "the pane can only be portrait" stopped being true. Orientation is now a
  // free preference again.
  const [orientation] = useVideoOrientation();
  const appliedOrientation = useRef<string | null>(null);
  useEffect(() => {
    if (!camActual) {
      // Nothing capturing — the next start picks the shape up from options.
      appliedOrientation.current = null;
      return;
    }
    if (appliedOrientation.current === orientation) return;
    const track = localParticipant.getTrackPublication(Track.Source.Camera)?.track as
      | LocalVideoTrack
      | undefined;
    if (!track) return;
    appliedOrientation.current = orientation;
    const { width, height } = VideoPresets.h540.resolution;
    const resolution =
      orientation === "portrait"
        ? { width: height, height: width }
        : { width, height };
    void track.restartTrack({ resolution }).catch(() => {
      // A camera that won't give us that shape keeps the one it has; better a
      // sideways picture than no picture.
      appliedOrientation.current = null;
    });
  }, [orientation, camActual, localParticipant]);

  const toggleCam = useCallback(async () => {
    const next = !(camWanted ?? camActual);
    setCamWanted(next);
    try {
      await localParticipant.setCameraEnabled(next);
    } catch {
      setCamWanted(null);
      toast.error(next ? "Couldn't turn the camera on" : "Couldn't turn the camera off");
    }
  }, [localParticipant, camWanted, camActual]);

  const partnerWrapRef = useRef<HTMLDivElement>(null);
  const selfWrapRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // PiP dual-view: which participant is the big one, and where the small inset
  // sits inside the frame (dragged within the frame's bounds).
  const [pipSwapped, setPipSwapped] = useState(false);
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const pipFrameRef = useRef<HTMLDivElement>(null);
  const pipMovedRef = useRef(false);
  function startInsetDrag(e: React.PointerEvent) {
    e.stopPropagation(); // don't move the whole PiP window
    pipMovedRef.current = false;
    const frame = pipFrameRef.current;
    const el = e.currentTarget as HTMLElement;
    if (!frame) return;
    const fr = frame.getBoundingClientRect();
    const sr = el.getBoundingClientRect();
    const offX = e.clientX - sr.left;
    const offY = e.clientY - sr.top;
    const move = (ev: PointerEvent) => {
      pipMovedRef.current = true;
      const x = Math.max(0, Math.min(fr.width - sr.width, ev.clientX - fr.left - offX));
      const y = Math.max(0, Math.min(fr.height - sr.height, ev.clientY - fr.top - offY));
      setPipPos({ x, y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const partnerDisplay = useMemo(
    () => partnerNameFromPresence(room.presence, room.senderId, room.roomId),
    [room.presence, room.senderId, room.roomId],
  );
  // Your own photo for the camera-off disc. Presence carries the partner's;
  // your own row is the one you can't read a name off reliably, so take it
  // from the session.
  const myPhotoUrl = authClient.getSession()?.user.photo_url ?? null;
  // Whether the side-by-side layout is even on the table — the settings menu
  // offers the choice, so it needs the same answer the room uses.
  const wideViewport = useWideViewport();
  // A control and its device list read as one object: a pill holding a bare
  // caret on the left and the toggle in its circle on the right. The caret is
  // deliberately un-circled so it doesn't compete with the button it belongs
  // to — same icon size, different weight.
  // Every control in the row is this tall — circles, pills and all. Heights
  // are set on the OUTER element (border-box) so a pill with inner padding
  // still measures the same as a plain circle beside it.
  const ctrlH = isPip ? "h-8" : "h-11";
  const ctrlBox = cn(ctrlH, isPip ? "w-8" : "w-11");
  const ctrlSurface =
    "flex items-center justify-center rounded-full border border-border bg-secondary/80 transition hover:bg-muted";
  const fullPill = cn(
    "flex items-center rounded-full border border-border bg-secondary/40",
    ctrlH,
    isPip ? "gap-0.5 py-0.5 pl-1.5 pr-0.5" : "gap-1 py-1 pl-2 pr-1",
  );
  const fullCaretBtn = cn(
    "flex items-center justify-center text-cream/70 transition hover:text-cream",
    isPip ? "h-5 w-4" : "h-6 w-5",
  );
  const fullToggleBtn = cn(
    "flex items-center justify-center rounded-full bg-secondary/90 transition hover:bg-muted",
    isPip ? "h-7 w-7" : "h-9 w-9",
  );

  // The capture listener below subscribes once per channel, so anything the
  // shot needs at fire time is read through refs — the old closure captured
  // first-render presence/tracks and could stamp a stale (or missing)
  // partner name onto the keepsake.
  const presenceRef = useRef(room.presence);
  presenceRef.current = room.presence;
  const hasPartnerRef = useRef(remotes.length > 0);
  hasPartnerRef.current = remotes.length > 0;

  function scheduleCapture(at: number) {
    const tick = () => {
      const left = Math.ceil((at - Date.now()) / 1000);
      if (left > 0) {
        setCountdown(left);
        window.setTimeout(tick, 250);
      } else {
        setCountdown(null);
        const partnerVid = partnerWrapRef.current?.querySelector("video") ?? null;
        const selfVid = selfWrapRef.current?.querySelector("video") ?? null;
        if (hasPartnerRef.current) {
          const pName = partnerNameFromPresence(presenceRef.current, room.senderId, room.roomId).name;
          capturePhoto(partnerVid, selfVid, pName, room.displayName || "You");
        } else {
          // Alone in the room — a solo keepsake, no empty partner frame.
          // (In the PiP layout the only video lives in the partner slot.)
          capturePhoto(null, selfVid ?? partnerVid, null, room.displayName || "You");
        }
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

  // The lobby's Photo Booth tile fires this — same synced 3-2-1 as the
  // camera button on the call controls.
  const startCaptureRef = useRef(startCapture);
  startCaptureRef.current = startCapture;
  useEffect(() => {
    const onBooth = () => startCaptureRef.current();
    window.addEventListener("dr:booth:capture", onBooth);
    return () => window.removeEventListener("dr:booth:capture", onBooth);
  }, []);

  // Total tile count: self + remotes (or self + 1 placeholder when alone)
  const tileCount = 1 + Math.max(1, remotes.length);

  // Collapsed bubble — just the primary video, no controls. Call stays live.
  if (collapsed) {
    const primary = remotes[0] ?? local;
    // Pair bubble (desktop): their face is the big circle, yours a small one
    // overlapping its lower-right shoulder — a self-check without a second
    // thing to drag. Falls back to the single bubble while alone.
    if (pair && remotes[0] && local) {
      return (
        <div className="relative h-full w-full">
          <div className="absolute inset-y-0 left-0 aspect-square overflow-hidden rounded-full border border-white/[0.16] shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
            <Tile participant={remotes[0]} label={remotes[0].participant.name || partnerDisplay.name} bare />
          </div>
          <div className="absolute bottom-0 right-0 h-[42%] w-[42%] overflow-hidden rounded-full border-2 border-[#141019] shadow-[0_10px_24px_rgba(0,0,0,0.5)]">
            <Tile participant={local} isLocal label="you" bare />
          </div>
        </div>
      );
    }
    return (
      <div className="h-full w-full">
        {primary ? (
          <Tile
            participant={primary}
            isLocal={primary === local}
            label={remotes[0]?.participant.name || partnerDisplay.name || "you"}
            photoUrl={primary === local ? myPhotoUrl : partnerDisplay.photoUrl}
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
    // The caret rides inside its control's pill rather than being a control
    // itself, so it reads as "more of this button", not another button.
    const caretBtn =
      "flex h-5 w-4 items-center justify-center text-cream/70 transition hover:text-cream";
    const pipPill =
      "flex h-8 items-center gap-0.5 rounded-full bg-black/35 py-0.5 pl-1.5 pr-0.5 backdrop-blur-md";
    const pipToggleBtn =
      "flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-cream transition hover:bg-black/75";
    const partner = remotes[0];
    const partnerLabel = partner?.participant.name || partnerDisplay.name;
    // Big vs inset: default big = partner, inset = you; tapping the inset swaps.
    const bigIsLocal = partner ? pipSwapped : true;
    return (
      <div
        ref={pipFrameRef}
        className={cn(
          "group relative h-full w-full overflow-hidden bg-black",
          // In a pane it runs to the edges; as a floating window it keeps the
          // radius that matches the frame around it.
          framed ? "rounded-none" : "rounded-xl",
        )}
      >
        <ReactionsLayer />
        <div ref={partnerWrapRef} className="absolute inset-0">
          {bigIsLocal ? (
            <Tile
              participant={local}
              isLocal
              label="you"
              photoUrl={myPhotoUrl}
              forceOff={!isCameraEnabled}
              square={framed}
              contain
            />
          ) : (
            <Tile
              participant={partner}
              label={partnerLabel}
              photoUrl={partnerDisplay.photoUrl}
              square={framed}
              contain
            />
          )}
        </div>
        {/* Inset PiP-in-PiP — the other person; drag within the frame, tap to swap.
            selfWrapRef rides the inset so a photo capture grabs BOTH faces. */}
        {partner && (
          <div
            ref={selfWrapRef}
            onPointerDown={startInsetDrag}
            onClick={() => {
              if (!pipMovedRef.current) setPipSwapped((v) => !v);
            }}
            style={pipPos ? { left: pipPos.x, top: pipPos.y } : { right: 8, bottom: 8 }}
            className={cn(
              "absolute z-20 cursor-pointer overflow-hidden rounded-lg border border-white/25 shadow-lg active:cursor-grabbing",
              orientation === "portrait"
                ? "h-[34%] w-auto aspect-[9/16]"
                : "w-[36%] h-auto aspect-[16/9]",
            )}
          >
            {bigIsLocal ? (
              <Tile participant={partner} label={partnerLabel} photoUrl={partnerDisplay.photoUrl} contain />
            ) : (
              <Tile participant={local} isLocal label="you" photoUrl={myPhotoUrl} forceOff={!isCameraEnabled} contain />
            )}
          </div>
        )}
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
          className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-1.5 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2 pb-2 pt-8 transition-all duration-200 pointer-events-auto translate-y-0 opacity-100 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100"
        >
          <div className={pipPill}>
            <MicDropup triggerClassName={caretBtn} iconClassName="h-4 w-4" />
            <button
              onClick={() => void toggleMic()}
              aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
              className={pipToggleBtn}
            >
              {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-rose" />}
            </button>
          </div>
          <div className={pipPill}>
            <CameraDropup triggerClassName={caretBtn} iconClassName="h-4 w-4" />
            <button
              onClick={() => void toggleCam()}
              aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
              className={pipToggleBtn}
            >
              {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-rose" />}
            </button>
          </div>
          <CallSettingsMenu triggerClassName={ctrlBtn} iconClassName="h-4 w-4" canSplit={wideViewport} />
          {/* FaceTime-style capture — grabs both faces to a photo. */}
          <button
            onClick={startCapture}
            disabled={countdown != null}
            aria-label="Take a photo"
            className={cn(ctrlBtn, "disabled:opacity-40")}
          >
            <Camera className="h-4 w-4" style={{ color: "var(--room-accent)" }} />
          </button>
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
    <div className="flex flex-col h-full relative">
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
            <Tile
              participant={remotes[0]}
              label={remotes[0].participant.name || partnerDisplay.name}
              photoUrl={partnerDisplay.photoUrl}
            />
          ) : (
            <Tile participant={local} isLocal label="you" photoUrl={myPhotoUrl} forceOff={!isCameraEnabled} />
          )}
        </div>
      ) : (
        <div className={`flex-1 min-h-0 grid ${stacked ? "grid-cols-1" : gridClass(tileCount)} auto-rows-fr`}>
          <div ref={selfWrapRef} className="min-h-0">
            <Tile participant={local} isLocal label="you" photoUrl={myPhotoUrl} forceOff={!isCameraEnabled} square />
          </div>
          {remotes.length === 0 ? (
            <div ref={partnerWrapRef} className="min-h-0">
              <Tile label="waiting for them…" square />
            </div>
          ) : (
            remotes.map((p, i) => (
              <div key={p.participant.identity} ref={i === 0 ? partnerWrapRef : undefined} className="min-h-0">
                <Tile
                  participant={p}
                  label={p.participant.name || partnerDisplay.name}
                  photoUrl={partnerDisplay.photoUrl}
                  square
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* Controls row. Three tracks rather than one flex run, so the capture
          button sits on the true centre of the row: the side groups can differ
          in width (the mic and camera pills are wider than a plain circle,
          and minimize only sometimes exists) and the middle still lands
          dead centre. */}
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_1fr] items-center shrink-0",
          // Equal space above and below: the parent's gap used to stack on
          // top of this padding, so the row sat low in the pane.
          isPip ? "py-1.5" : "py-3",
        )}
      >
        <div className={cn("flex items-center justify-end", isPip ? "gap-1.5" : "gap-3")}>
        <div className={fullPill}>
          <MicDropup triggerClassName={fullCaretBtn} iconClassName="w-4 h-4" />
          <button
            onClick={() => void toggleMic()}
            aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
            className={fullToggleBtn}
          >
            {isMicrophoneEnabled ? <Mic className="w-4 h-4 text-cream" /> : <MicOff className="w-4 h-4 text-rose" />}
          </button>
        </div>
        <div className={fullPill}>
          <CameraDropup triggerClassName={fullCaretBtn} iconClassName="w-4 h-4" />
          <button
            onClick={() => void toggleCam()}
            aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
            className={fullToggleBtn}
          >
            {isCameraEnabled ? <Video className="w-4 h-4 text-cream" /> : <VideoOff className="w-4 h-4 text-rose" />}
          </button>
        </div>
        </div>

        {/* Centre — the shutter. */}
        <div className={cn("flex items-center justify-center", isPip ? "px-1.5" : "px-3")}>
          {!isPip && (
            <button
              onClick={startCapture}
              disabled={countdown != null}
              aria-label="Take a photo"
              title="Take a photo"
              className={cn(ctrlSurface, ctrlBox, "disabled:opacity-50")}
            >
              <Camera className="w-4 h-4 text-amber" />
            </button>
          )}
        </div>

        <div className={cn("flex items-center justify-start", isPip ? "gap-1.5" : "gap-3")}>
        <CallSettingsMenu
          triggerClassName={cn(ctrlSurface, ctrlBox)}
          iconClassName="w-4 h-4 text-cream"
          canSplit={wideViewport}
        />
        {isPip && onCollapse && (
          <button
            onClick={onCollapse}
            aria-label="Collapse call"
            className={cn(ctrlSurface, ctrlBox)}
          >
            <Minus className="w-4 h-4 text-cream" />
          </button>
        )}
        <button
          onClick={onLeave}
          aria-label="Leave call"
          title="Leave call"
          className={cn(
            "flex items-center justify-center rounded-full border border-transparent bg-destructive/80 text-cream transition hover:bg-destructive",
            ctrlBox,
          )}
        >
          <PhoneOff className="w-4 h-4" />
        </button>
        </div>
      </div>
    </div>
  );
}

export function RoomVideo({
  onLeave,
  variant,
  framed,
  compact,
  collapsed,
  pair,
  stacked,
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

  // Apply saved device preferences at join. Computed once per mount (not per
  // render) so the Room isn't reconfigured mid-call; deviceId is an *ideal*
  // constraint, so an unplugged saved device gracefully falls back to default.
  const roomOptions = useMemo<RoomOptions>(() => {
    const audioId = loadDevicePreference("audioinput");
    const videoId = loadDevicePreference("videoinput");
    if (!audioId && !videoId) return LIVEKIT_ROOM_OPTIONS;
    return {
      ...LIVEKIT_ROOM_OPTIONS,
      audioCaptureDefaults: {
        ...(LIVEKIT_ROOM_OPTIONS.audioCaptureDefaults ?? {}),
        ...(audioId ? { deviceId: audioId } : {}),
      },
      videoCaptureDefaults: {
        ...(LIVEKIT_ROOM_OPTIONS.videoCaptureDefaults ?? {}),
        ...(videoId ? { deviceId: videoId } : {}),
      },
    };
  }, []);

  // Stable handler identities: inline arrows re-trigger LiveKitRoom's
  // internal connect effect on every parent re-render (the once-a-second
  // "already connected" churn).
  const onLkError = useCallback((e: Error) => {
    // LiveKit's error strings are diagnostics, not copy — "publishing
    // rejected as engine not connected within timeout" means nothing to
    // someone on a date, and most of these heal on the next reconnect
    // without any action. Keep the detail where we can read it; the room's
    // own connection banner is what tells the user when the link is
    // genuinely down.
    console.warn("[livekit] room error", e);
  }, []);

  const onLkDeviceFailure = useCallback((failure?: unknown) => {
    // Device failures DO need the user — only they can unblock a camera —
    // so these still surface, but as something a person can act on rather
    // than the SDK's enum name.
    console.warn("[livekit] device failure", failure);
    const kind = String(failure ?? "");
    toast.error(
      kind === "PermissionDenied"
        ? "Camera and mic are blocked. Allow them in your browser's address bar, then try again."
        : kind === "NotFound"
          ? "No camera or microphone found on this device."
          : kind === "DeviceInUse"
            ? "Your camera or mic is in use by another app. Close it and try again."
            : "Couldn't reach your camera or microphone.",
    );
  }, []);
  const onLkDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        toast.message("Call moved to your other device.");
        onLeave?.();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onLeave],
  );

  if (error) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-body text-muted-foreground">{error}</div>;
  }
  if (!conn) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <p className="italic text-cream text-title">Lighting the candles…</p>
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
      options={roomOptions}
      data-lk-theme="default"
      className="relative h-full w-full"
      onError={onLkError}
      onMediaDeviceFailure={onLkDeviceFailure}
      onDisconnected={onLkDisconnected}
    >
      <MicKeepAlive />
      <AmbientController />
      <ChaperonAgentBridge />
      <CallPeersBridge />
      <DeviceChangeToaster />
      <Stage
        onLeave={onLeave ?? (() => {})}
        variant={variant}
        framed={framed}
        compact={compact}
        collapsed={collapsed}
        pair={pair}
        stacked={stacked}
        onCollapse={onCollapse}
        onRotate={onRotate}
      />
      <RoomAudioRenderer />
      {/* Recovers when the browser blocks autoplay of the partner's audio —
          renders an unobtrusive tap-to-hear affordance only when needed. */}
      <StartAudio label="Tap to enable sound" className="lk-start-audio-button" />
    </LiveKitRoom>
  );
}

/**
 * Guarantees the microphone actually gets published. `LiveKitRoom audio` only
 * publishes ONCE on SignalConnected and swallows failures — so a single failed
 * attempt (permission race, device briefly busy) means the partner can never
 * hear you until a full relog. This re-attempts publish on connect and whenever
 * a participant joins, but ONLY when no mic track exists yet — so it never
 * overrides an intentional mute (which keeps a published-but-muted track).
 */
function MicKeepAlive() {
  const room = useRoomContext();
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    const ensureMic = async (attempt = 0) => {
      if (cancelled) return;
      const lp = room.localParticipant;
      // A publication (even muted) means the mic is on the SFU — leave it alone.
      if (lp.getTrackPublication(Track.Source.Microphone)) return;
      try {
        await lp.setMicrophoneEnabled(true);
      } catch {
        if (attempt < 3 && !cancelled) {
          window.setTimeout(() => void ensureMic(attempt + 1), 800 * (attempt + 1));
        }
      }
    };
    const onConnected = () => void ensureMic();
    const onParticipant = () => void ensureMic();
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.ParticipantConnected, onParticipant);
    // Cover the case where we're already connected when this mounts.
    void ensureMic();
    return () => {
      cancelled = true;
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ParticipantConnected, onParticipant);
    };
  }, [room]);
  return null;
}

