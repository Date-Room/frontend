/**
 * Try-room demo caps — the "first chunk free" rules. Each game plays one
 * complete natural unit in a free room, then shows the upgrade curtain at
 * the chunk boundary (never mid-round). Caps are read from the room's
 * package, which both clients share, so the curtain falls on both screens
 * at once. Server-side, the Try tier caps WHICH games enter the room
 * (backend normalize); these caps govern how far each one plays.
 */
import { useRoomSession } from "@/context/RoomSessionContext";

/** Rounds (or runs/turns/cards — each game's natural unit) free in Try. */
export const TRY_CAPS = {
  this_or_that_runs: 1,
  pick_a_door_rounds: 2,
  one_has_to_go_rounds: 3,
  rank_it_rounds: 2,
  two_truths_rounds: 2, // one each — both get to lie once
  truth_or_dare_turns: 2, // one dealt card each
  open_book_cards: 3,
  // Closer: the 3-question stretch IS the natural cap (stretch options 6/12
  // hide in Try; the banked place is the conversion hook).
} as const;

export function useTryRoom(): boolean {
  return useRoomSession().roomPackage === "single_pass";
}
