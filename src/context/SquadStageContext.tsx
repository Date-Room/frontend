/**
 * The squad stage: how a game and the call talk to each other on a squad
 * night. The game (SquadGame) says what the moment is (reading a card,
 * deciding, waiting on others, a reveal) and which faces can be tapped;
 * the call (GroupStage) arranges the faces to match; the room bar
 * (RoomStage) shows mute and camera from the call next to Activities and
 * chat. One live call, rearranged: never a second copy of anyone's video.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * reading    faces shrink to a strip (you're reading or writing)
 * deciding   faces are the ballot: a grid of friends, you beside the question
 * waiting    same grid, with who's in and who's still thinking
 * spotlight  one face steps forward (the reveal)
 * hero       one face stays big for the whole round (Clue Me In's guesser)
 */
export type StageMode = "reading" | "deciding" | "waiting" | "spotlight" | "hero";

/** What a single face shows, keyed by the person's call identity (user id). */
export type FaceCue = {
  /** "in": moved this stage. "thinking": still to move. "reading": still
   *  to move, with their first-round card open. */
  badge?: "in" | "thinking" | "reading";
  /** My pick (gold ring). */
  picked?: boolean;
  /** Not pickable, or not picked at a reveal. */
  dim?: boolean;
  /** A gold ring without a pick: whose turn it is. */
  ring?: boolean;
  /** Tapping this face makes a move. */
  tappable?: boolean;
};

export type StageCue = {
  mode: StageMode;
  /** The face that steps forward in spotlight and hero. */
  focus?: string | null;
  faces?: Record<string, FaceCue>;
  /** One short line over the faces ("Tap a face"). */
  hint?: string | null;
  onTap?: (identity: string) => void;
  /** A round is being played (not dealing, not the reveal). Invites from
   *  friends wait until this is false. */
  live?: boolean;
};

/** Mute and camera, lifted out of the call so the room bar can show them. */
export type CallControls = {
  mic: boolean;
  cam: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
};

type SquadStage = {
  cue: StageCue | null;
  setCue: (cue: StageCue | null) => void;
  controls: CallControls | null;
  setControls: (controls: CallControls | null) => void;
};

const Ctx = createContext<SquadStage | null>(null);

export function SquadStageProvider({ children }: { children: ReactNode }) {
  const [cue, setCue] = useState<StageCue | null>(null);
  const [controls, setControls] = useState<CallControls | null>(null);
  const value = useMemo(() => ({ cue, setCue, controls, setControls }), [cue, controls]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The squad stage, or null outside one (dates, previews, tests). */
// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useSquadStage(): SquadStage | null {
  return useContext(Ctx);
}
