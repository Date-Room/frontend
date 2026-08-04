import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useChaperonController } from "@/context/ChaperonContext";

const decoder = new TextDecoder();

/**
 * Bridges the server agent's targeted data messages (topic "chaperon") into the
 * chaperon controller — whispers + health heartbeats the agent sends only to
 * this viewer. Must render inside <LiveKitRoom>. Renders nothing.
 */
export function ChaperonAgentBridge() {
  const room = useRoomContext();
  const ctrl = useChaperonController();
  const ingest = ctrl?.ingestAgentMessage;

  useEffect(() => {
    if (!room || !ingest) return;
    const onData = (payload: Uint8Array, _p: unknown, _k: unknown, topic?: string) => {
      if (topic !== "chaperon") return;
      try {
        const msg = JSON.parse(decoder.decode(payload)) as Record<string, unknown>;
        if (msg && typeof msg === "object") ingest(msg);
      } catch {
        /* ignore malformed */
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, ingest]);

  return null;
}
