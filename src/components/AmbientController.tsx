import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Moon } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import { getRoomExperienceApi, postAmbientState } from "@/lib/rooms";
import {
  ambientReducer,
  initAmbient,
  type AmbientEvent,
  type AmbientMachine,
  type AmbientMode,
} from "@/lib/ambient";

const TICK_MS = 5_000;
const POINTERMOVE_THROTTLE_MS = 1_000;

/**
 * Drives ambient/idle mode inside a LiveKit room (feature-flagged off by
 * default). When the room is idle past the configured threshold it pauses
 * the local camera to a poster (audio stays live) to cut bitrate, and
 * restores instantly on any speech/interaction. Renders a small indicator
 * while ambient; otherwise headless.
 */
export function AmbientController() {
  const session = useRoomSession();
  const lkRoom = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const { data: exp } = useQuery({
    queryKey: ["room-experience", session.roomId, session.participantId],
    queryFn: () => getRoomExperienceApi(session.roomId, session.participantId),
    staleTime: 60_000,
  });

  const enabled = exp?.ambient_mode_enabled === true;
  const idleMs = Math.max(1, exp?.ambient_idle_minutes ?? 10) * 60_000;

  const [mode, setMode] = useState<AmbientMode>("active");
  const machineRef = useRef<AmbientMachine>(initAmbient(Date.now()));
  // Whether the camera was on when we entered ambient — so we only restore
  // a camera the user actually had running (don't override a manual mute).
  const cameraWasOnRef = useRef(false);

  // Reassigned every render so it closes over the latest localParticipant.
  const dispatchRef = useRef<(ev: AmbientEvent) => void>(() => {});
  dispatchRef.current = (ev: AmbientEvent) => {
    const res = ambientReducer(machineRef.current, ev, { idleMs });
    machineRef.current = res.next;
    if (res.changed) {
      if (res.next.mode === "ambient") {
        cameraWasOnRef.current = localParticipant?.isCameraEnabled ?? false;
        if (cameraWasOnRef.current) {
          void localParticipant?.setCameraEnabled(false).catch(() => {});
        }
      } else if (cameraWasOnRef.current) {
        void localParticipant?.setCameraEnabled(true).catch(() => {});
      }
      setMode(res.next.mode);
    }
    if (res.broadcast) {
      void session.channel
        .broadcast("ambient", { state: res.broadcast, from: session.senderId })
        .catch(() => {});
      void postAmbientState(session.roomId, res.broadcast, session.participantId).catch(
        () => {},
      );
    }
  };

  // Periodic idle check.
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(
      () => dispatchRef.current({ type: "tick", at: Date.now() }),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [enabled]);

  // Local interaction + tab refocus = activity.
  useEffect(() => {
    if (!enabled) return;
    const wake = () => dispatchRef.current({ type: "local-activity", at: Date.now() });
    let lastMove = 0;
    const onMove = () => {
      const now = Date.now();
      if (now - lastMove > POINTERMOVE_THROTTLE_MS) {
        lastMove = now;
        wake();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") wake();
    };
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake, { passive: true });
    window.addEventListener("touchstart", wake, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  // Anyone speaking (local or remote, surfaced to every client by LiveKit).
  useEffect(() => {
    if (!enabled || !lkRoom) return;
    const onSpeakers = (speakers: unknown[]) => {
      if (speakers.length > 0) {
        dispatchRef.current({ type: "local-activity", at: Date.now() });
      }
    };
    lkRoom.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);
    return () => {
      lkRoom.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
    };
  }, [enabled, lkRoom]);

  // Realtime channel: peers' ambient state + any other engagement broadcast.
  useEffect(() => {
    if (!enabled) return;
    return session.channel.onBroadcast((e) => {
      if (e.payload.from === session.senderId) return; // ignore our own echo
      if (e.kind === "ambient") {
        // ACTIVE wins: a peer going active wakes us; a peer going ambient
        // is informational (we only go ambient via our own idle timer).
        if (e.payload.state === "active") {
          dispatchRef.current({ type: "peer-active", at: Date.now() });
        }
        return;
      }
      // Any other peer broadcast (reactions, captures, activity sync) is
      // real engagement — treat it as activity so both sides stay awake.
      dispatchRef.current({ type: "local-activity", at: Date.now() });
    });
  }, [enabled, session.channel, session.senderId]);

  if (!enabled || mode !== "ambient") return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
      <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] text-cream/90 backdrop-blur">
        <Moon className="h-3.5 w-3.5" aria-hidden />
        Ambient — tap or talk to wake
      </div>
    </div>
  );
}
