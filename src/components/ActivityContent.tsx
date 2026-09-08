import type { ReactNode } from "react";
import { Bookshelf } from "@/components/Bookshelf";
import { ChatWithBoundary } from "@/components/Chat";
import { FridgeNotes } from "@/components/FridgeNotes";
import { MusicLibrary } from "@/components/MusicRoom";
import { OneHasToGo } from "@/components/OneHasToGo";
import { PickADoor } from "@/components/PickADoor";
import { QuestionDeck } from "@/components/QuestionDeck";
import { RankIt } from "@/components/RankIt";
import { RoomSettings } from "@/components/RoomSettings";
import { The36 } from "@/components/The36";
import { ThisOrThat } from "@/components/ThisOrThat";
import { TruthOrDare } from "@/components/TruthOrDare";
import { TwoTruths } from "@/components/TwoTruths";
import { VisionBoard } from "@/components/VisionBoard";
import { WatchTogether } from "@/components/WatchTogether";
import type { ActivityId } from "@/lib/activityRegistry";

/** Stage mount for each activity in the registry. The Record is exhaustive
 *  over ActivityId, so a new registry entry without a mount won't compile. */
const ACTIVITY_CONTENT: Record<ActivityId, () => ReactNode> = {
  vision_board: () => <VisionBoard />,
  fridge_notes: () => <FridgeNotes active />,
  bookshelf: () => <Bookshelf />,
  questions: () => <QuestionDeck />,
  this_or_that: () => <ThisOrThat />,
  the_36: () => <The36 />,
  "2_truths": () => <TwoTruths />,
  truth_or_dare: () => <TruthOrDare />,
  one_has_to_go: () => <OneHasToGo />,
  pick_a_door: () => <PickADoor />,
  rank_it: () => <RankIt />,
  watch: () => <WatchTogether />,
  // The stage is the library; the player lives in the bottom bar
  // (MusicRoomProvider in RoomStage owns the engine).
  dj: () => <MusicLibrary />,
  chat: () => <ChatWithBoundary />,
  room_details: () => <RoomSettings />,
};

export function renderActivity(id: string): ReactNode {
  const mount = ACTIVITY_CONTENT[id as ActivityId];
  return mount ? mount() : null;
}
