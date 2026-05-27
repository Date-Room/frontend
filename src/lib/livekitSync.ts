// Lightweight pub/sub over LiveKit's data channel.
// Used for low-latency sync of Watch + DJ playback between participants.
// Video/voice tracks are unaffected — this just adds a sidecar JSON channel.

import { ConnectionState, RoomEvent, type Room, type RemoteParticipant } from "livekit-client";

export type SyncChannel = "watch" | "dj";
export type SyncAction = "play" | "pause" | "seek" | "load" | "silence";

export type SyncMessage = {
  channel: SyncChannel;
  action: SyncAction;
  videoId?: string | null;
  timestamp?: number;
  senderUserId: string;
  sentAt: number;
};

type Listener = (msg: SyncMessage, from?: RemoteParticipant) => void;
type PublishOptions = { reliable?: boolean };
type PendingPublish = {
  msg: SyncMessage;
  reliable: boolean;
  resolve: () => void;
  reject: (error: unknown) => void;
};

let currentRoom: Room | null = null;
let currentRoomStateHandler: (() => void) | null = null;
const listeners = new Set<Listener>();
const pendingPublishes: PendingPublish[] = [];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function setSyncRoom(room: Room | null) {
  if (currentRoom === room) {
    schedulePendingFlush();
    return;
  }

  if (currentRoom && currentRoomStateHandler) {
    currentRoom.off(RoomEvent.ConnectionStateChanged, currentRoomStateHandler);
  }

  currentRoom = room;
  currentRoomStateHandler = null;

  if (room) {
    currentRoomStateHandler = () => schedulePendingFlush();
    room.on(RoomEvent.ConnectionStateChanged, currentRoomStateHandler);
    schedulePendingFlush();
  }
}

export function getSyncRoom(): Room | null {
  return currentRoom;
}

export function onSyncMessage(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Called by the Stage component when LiveKit emits a DataReceived event.
export function dispatchIncoming(payload: Uint8Array, from?: RemoteParticipant) {
  try {
    const text = decoder.decode(payload);
    const msg = JSON.parse(text) as SyncMessage;
    if (!msg || typeof msg !== "object" || !msg.channel || !msg.action) return;
    listeners.forEach((l) => {
      try { l(msg, from); } catch (e) { console.warn("[sync] listener error", e); }
    });
  } catch (e) {
    console.warn("[sync] failed to decode message", e);
  }
}

function isRoomReady(room: Room | null): room is Room {
  return Boolean(
    room &&
      room.state === ConnectionState.Connected &&
      room.localParticipant &&
      room.localParticipant.sid &&
      room.localParticipant.isActive,
  );
}

function schedulePendingFlush() {
  const room = currentRoom;
  if (!room) return;
  if (room.state === ConnectionState.Connected && room.localParticipant?.sid && !room.localParticipant.isActive) {
    room.localParticipant.waitUntilActive().then(() => void flushPendingPublishes()).catch((error) => {
      console.warn("[sync] waiting for local participant readiness failed", error);
    });
    return;
  }
  void flushPendingPublishes();
}

async function waitForRoomReady(room: Room) {
  if (room.state !== ConnectionState.Connected) {
    throw new Error(`LiveKit room is not connected: ${room.state}`);
  }
  if (!room.localParticipant?.sid) {
    throw new Error("LiveKit local participant is not ready");
  }
  if (!room.localParticipant.isActive) {
    await room.localParticipant.waitUntilActive();
  }
  if (room.state !== ConnectionState.Connected) {
    throw new Error(`LiveKit room changed state before publish: ${room.state}`);
  }
}

async function sendSyncMessage(msg: SyncMessage, reliable: boolean) {
  const room = currentRoom;
  if (!room) throw new Error("LiveKit room is not available");
  await waitForRoomReady(room);
  const data = encoder.encode(JSON.stringify(msg));
  await room.localParticipant.publishData(data, { reliable });
}

let flushingPublishes = false;
async function flushPendingPublishes() {
  if (flushingPublishes || pendingPublishes.length === 0 || !currentRoom) return;
  if (!isRoomReady(currentRoom)) return;

  flushingPublishes = true;
  try {
    while (pendingPublishes.length > 0 && isRoomReady(currentRoom)) {
      const pending = pendingPublishes.shift()!;
      try {
        await sendSyncMessage(pending.msg, pending.reliable);
        pending.resolve();
      } catch (error) {
        if (!isRoomReady(currentRoom)) {
          pendingPublishes.unshift(pending);
          break;
        }
        pending.reject(error);
      }
    }
  } finally {
    flushingPublishes = false;
  }
}

export async function publishSync(msg: Omit<SyncMessage, "sentAt">, options: PublishOptions = {}) {
  const reliable = options.reliable ?? true;
  const full: SyncMessage = { ...msg, sentAt: Date.now() };

  if (!isRoomReady(currentRoom)) {
    return new Promise<void>((resolve, reject) => {
      pendingPublishes.push({ msg: full, reliable, resolve, reject });
      schedulePendingFlush();
    });
  }

  await sendSyncMessage(full, reliable);
}
