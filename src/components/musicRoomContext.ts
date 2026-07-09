import { createContext, useContext } from "react";
import type { DjTrack } from "@/components/DJ";

/**
 * Music room context — kept in its own module (no component exports) so React
 * Fast Refresh can hot-update the provider/components cleanly. Mixing a hook +
 * components in one file breaks Fast Refresh and can leave a stale context,
 * which made `useMusicRoom` throw and crash the room.
 */

export type Reaction = { id: string; emoji: string };
export type RepeatMode = "none" | "all" | "one";

export type MusicCtxValue = {
  nowPlaying: DjTrack | null;
  tracks: DjTrack[];
  currentId: string | null;
  upcomingCount: number;
  playing: boolean;
  silence: boolean;
  videoId: string | null;
  trackTitle: string | null;
  trackChannel: string | null;
  thumb: string | null;
  repeat: RepeatMode;
  cycleRepeat: () => void;
  position: number;
  duration: number;
  seekFraction: (f: number) => void;
  volume: number;
  setVolume: (v: number) => void;
  needsAudioGesture: boolean;
  enableAudio: () => void;
  reactions: Reaction[];
  playId: (id: string) => void;
  playTrack: (id: string) => void;
  togglePlayPause: () => void;
  restartCurrent: () => void;
  previous: () => void;
  stop: () => void;
  next: () => void;
  removeTrack: (id: string) => void;
  reorderTracks: (from: number, to: number) => void;
  clearQueue: () => void;
  close: () => void;
  closed: boolean;
  hasContent: boolean;
};

export const MusicCtx = createContext<MusicCtxValue | null>(null);

export function useMusicRoom(): MusicCtxValue {
  const v = useContext(MusicCtx);
  if (!v) throw new Error("useMusicRoom must be used within MusicRoomProvider");
  return v;
}
