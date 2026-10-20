// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Each game reads its state from the room's activity hook; drive it directly
// so a test can play a game from mid-arc to its last screen.
let mockState: unknown = null;
vi.mock("@/lib/activities/useReducedActivity", () => ({
  useReducedActivity: () => ({ state: mockState, emit: () => {}, senderId: "me" }),
}));
vi.mock("@/lib/stagecraft/usePartnerName", () => ({ usePartnerName: () => "Sam" }));
vi.mock("@/lib/tryDemo", () => ({ useTryRoom: () => false, TRY_CAPS: { pick_a_door_rounds: 99 } }));
vi.mock("@/lib/activityHelpNow", () => ({ setHelpNow: () => {} }));

import { OneHasToGo } from "./OneHasToGo";
import { PickADoor } from "./PickADoor";
import { OHTG_ROUNDS, initialOhtgState } from "@/lib/activities/oneHasToGo";
import { DOOR_ROUNDS, initialPickADoorState } from "@/lib/activities/pickADoor";

afterEach(() => {
  cleanup();
  mockState = null;
});

// The finished screen used to return before a hook the in-play screen calls,
// so React threw "Rendered fewer hooks than expected" on the last round and
// the whole room fell to its error boundary.
describe("games reaching their last screen", () => {
  it("One Has To Go moves from a round to the finished screen and back", () => {
    mockState = { ...initialOhtgState(), round: OHTG_ROUNDS.length - 1 };
    const { rerender } = render(<OneHasToGo />);

    mockState = { ...initialOhtgState(), round: OHTG_ROUNDS.length };
    rerender(<OneHasToGo />);
    expect(screen.getByText(/That's all \d+ rounds/)).toBeTruthy();

    mockState = initialOhtgState();
    rerender(<OneHasToGo />);
    expect(screen.queryByText(/That's all \d+ rounds/)).toBeNull();
  });

  it("Pick a Door moves from a round to the finished screen and back", () => {
    mockState = { ...initialPickADoorState(), round: DOOR_ROUNDS.length - 1 };
    const { rerender } = render(<PickADoor />);

    mockState = { ...initialPickADoorState(), round: DOOR_ROUNDS.length };
    rerender(<PickADoor />);
    expect(screen.getByText(/rounds, done/)).toBeTruthy();

    mockState = initialPickADoorState();
    rerender(<PickADoor />);
    expect(screen.queryByText(/rounds, done/)).toBeNull();
  });
});
