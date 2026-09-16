/**
 * Who is actually on the call, from LiveKit itself.
 *
 * Presence (the room WebSocket) is what the lobby uses to say "X is in the
 * room", but it has two schemas (web-legacy vs mobile) and `is_in_call` is
 * not reliably set by every client, so the "Ringing X…" bar could stay up
 * through a whole connected call. LiveKit's participant list is the ground
 * truth for "in the call": if a remote human track owner is connected, they
 * are in the call, whatever presence says.
 *
 * `CallPeersBridge` must render inside <LiveKitRoom>; the provider sits above
 * RoomShell so the stage header can read it.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type Participant, type Room } from "livekit-client";

/** The server-side chaperon agent joins as an invisible subscriber; it is not a person. */
export const AGENT_IDENTITY = "chaperon-agent";

export type CallPeer = { identity: string; name: string | null };

type CallPeersValue = {
  peers: CallPeer[];
  setPeers: (peers: CallPeer[]) => void;
};

const Ctx = createContext<CallPeersValue | null>(null);

export function CallPeersProvider({ children }: { children: ReactNode }) {
  const [peers, setPeers] = useState<CallPeer[]>([]);
  const value = useMemo(() => ({ peers, setPeers }), [peers]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Remote humans on the call (never the agent). Empty outside a provider. */
export function useCallPeers(): CallPeer[] {
  return useContext(Ctx)?.peers ?? [];
}

/** Pure: the humans among a room's remote participants. */
export function humanPeers(participants: Iterable<Participant>): CallPeer[] {
  const out: CallPeer[] = [];
  for (const p of participants) {
    if (p.identity === AGENT_IDENTITY) continue;
    out.push({ identity: p.identity, name: p.name?.trim() || null });
  }
  return out;
}

function readPeers(room: Room): CallPeer[] {
  return humanPeers(room.remoteParticipants.values());
}

/** Renders nothing; keeps the provider in step with LiveKit's participant list. */
export function CallPeersBridge() {
  const room = useRoomContext();
  const ctx = useContext(Ctx);
  const setPeers = ctx?.setPeers;

  useEffect(() => {
    if (!room || !setPeers) return;
    const sync = () => setPeers(readPeers(room));
    sync();
    const events = [
      RoomEvent.Connected,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ParticipantNameChanged,
      RoomEvent.Disconnected,
    ] as const;
    for (const ev of events) room.on(ev, sync);
    return () => {
      for (const ev of events) room.off(ev, sync);
      setPeers([]);
    };
  }, [room, setPeers]);

  return null;
}
