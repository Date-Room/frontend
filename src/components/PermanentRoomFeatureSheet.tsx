import { ArrowLeft } from "lucide-react";
import { Bookshelf } from "@/components/Bookshelf";
import { ChatWithBoundary } from "@/components/Chat";
import { DJ } from "@/components/DJ";
import { FridgeNotes } from "@/components/FridgeNotes";
import { QuestionDeck } from "@/components/QuestionDeck";
import { The36 } from "@/components/The36";
import { ThisOrThat } from "@/components/ThisOrThat";
import { TruthOrDare } from "@/components/TruthOrDare";
import { TwoTruths } from "@/components/TwoTruths";
import { VisionBoard } from "@/components/VisionBoard";
import { WatchTogether } from "@/components/WatchTogether";

export type HomeFeatureId =
  | "vision_board"
  | "fridge_notes"
  | "bookshelf"
  | "watch"
  | "dj"
  | "questions"
  | "this_or_that"
  | "the_36"
  | "2_truths"
  | "truth_or_dare"
  | "chat";

const FEATURE_TITLES: Record<HomeFeatureId, string> = {
  vision_board: "Vision Board",
  fridge_notes: "Fridge",
  bookshelf: "Bookshelf",
  watch: "Watch",
  dj: "DJ",
  questions: "Questions",
  this_or_that: "This or That",
  the_36: "The 36",
  "2_truths": "2 Truths",
  truth_or_dare: "Truth or Dare",
  chat: "Chat",
};

type Props = {
  feature: HomeFeatureId | null;
  onClose: () => void;
};

export function PermanentRoomFeatureSheet({ feature, onClose }: Props) {
  if (!feature) return null;

  return (
    <div
      className="perm-feature-overlay animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={FEATURE_TITLES[feature]}
    >
      <div className="perm-feature-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="perm-feature-header">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm text-amber hover:text-cream"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to room
          </button>
          <p className="font-serif font-semibold text-cream text-lg">{FEATURE_TITLES[feature]}</p>
          <span className="w-16" aria-hidden />
        </header>
        <div className="perm-feature-body wall-surface">
          {feature === "vision_board" && <VisionBoard />}
          {feature === "fridge_notes" && <FridgeNotes active />}
          {feature === "bookshelf" && <Bookshelf />}
          {feature === "watch" && <WatchTogether />}
          {feature === "dj" && <DJ watchActive={false} />}
          {feature === "questions" && <QuestionDeck />}
          {feature === "this_or_that" && <ThisOrThat />}
          {feature === "the_36" && <The36 />}
          {feature === "2_truths" && <TwoTruths />}
          {feature === "truth_or_dare" && <TruthOrDare />}
          {feature === "chat" && <ChatWithBoundary />}
        </div>
      </div>
    </div>
  );
}
