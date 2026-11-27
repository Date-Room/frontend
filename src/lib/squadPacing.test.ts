/**
 * Nobody drags anybody to the next card.
 *
 * George: "the next button should not force others to change. When they
 * answer, sync answers and show the answers like you're already doing
 * now. But then when someone wants to take their time to click next
 * because they've seen the selections and probably still thinking about
 * them, don't sync that next. They click next at their own pace, and see
 * the next question, and then answer. Then it should enter a waiting
 * state if others are yet to answer."
 *
 * The server deals one round at a time and that is right — the card and
 * the reveal are shared, and a round cannot close until everyone
 * expected has answered it. The fault was this side reading "the room's
 * round" as "my screen". `nextPin` is the whole of the rule; these are
 * the cases it exists for.
 */
import { describe, expect, it } from "vitest";
import { nextPin, roomAhead, waitingLine, type Pinned, type Round, type RoundState } from "@/lib/squadGames";

const round = (over: Partial<Round> = {}): Round => ({
  id: `r${over.number ?? 1}`,
  game: "most_likely",
  number: 1,
  deck: "mild",
  stage: "vote",
  prompt: { id: "c1", text: "Most likely to miss the flight" },
  players: ["a", "b", "c"],
  lead_id: null,
  deadline_at: null,
  submitted: [],
  public: {},
  ...over,
});
const state = (over: Partial<Round> = {}): RoundState => ({ round: round(over), me: { playing: true } });
const pinOf = (s: RoundState): Pinned => ({ number: s.round!.number, state: s });

describe("the round you are on is yours to leave", () => {
  it("joins the room where it is, the first time it looks", () => {
    const here = state();
    expect(nextPin(null, here)).toEqual({ number: 1, state: here });
  });

  it("follows the round it is on through every stage", () => {
    const voting = state({ submitted: ["a"] });
    const closed = state({ stage: "revealed", submitted: ["a", "b", "c"] });
    // The answers and the reveal are the shared payoff: the round cannot
    // close until everyone has answered, so nobody is cut off by this.
    expect(nextPin(pinOf(voting), closed)?.state).toBe(closed);
  });

  it("stays on a reveal when somebody else deals the next card", () => {
    const mine = pinOf(state({ stage: "revealed", submitted: ["a", "b", "c"] }));
    const theirs = state({ number: 2, id: "r2" });
    const after = nextPin(mine, theirs);
    expect(after).toBe(mine);
    expect(after?.state.round?.number).toBe(1);
    // And the button knows it has somewhere to go.
    expect(roomAhead(after, theirs)).toBe(true);
  });

  it("steps onto the new round when I say so, and only then", () => {
    const mine = pinOf(state({ stage: "revealed" }));
    const theirs = state({ number: 2, id: "r2" });
    expect(nextPin(mine, theirs)).toBe(mine);
    // "Next round": the card is already dealt, so this is a step, not a deal.
    const stepped = pinOf(theirs);
    expect(nextPin(stepped, theirs)?.state).toBe(theirs);
    expect(roomAhead(stepped, theirs)).toBe(false);
  });

  it("does follow a new round when mine was never revealed", () => {
    // Someone skipped the card, or settled the stage without me. There is
    // nothing left on this screen to read, so holding it back would just
    // be showing a card that is no longer in play.
    const mine = pinOf(state({ stage: "vote" }));
    const fresh = state({ number: 2, id: "r2" });
    expect(nextPin(mine, fresh)?.state).toBe(fresh);
  });

  it("ignores a read that arrives from behind", () => {
    const mine = pinOf(state({ number: 4, id: "r4" }));
    expect(nextPin(mine, state({ number: 3, id: "r3" }))).toBe(mine);
  });

  it("lets go when the game is cleared out", () => {
    const mine = pinOf(state({ stage: "revealed" }));
    expect(nextPin(mine, { round: null, me: null })).toBeNull();
    expect(nextPin(mine, null)).toBeNull();
    expect(roomAhead(null, state())).toBe(false);
  });
});

describe("the waiting state says what it is waiting for", () => {
  it("names the stage's own verb, and the count", () => {
    expect(waitingLine(round({ submitted: ["a"] }))).toBe("Waiting for the others to vote · 1 of 3.");
    expect(waitingLine(round({ game: "who_said_it", stage: "answer", submitted: ["a", "b"] }))).toBe(
      "Waiting for the others to answer · 2 of 3.",
    );
    expect(waitingLine(round({ game: "who_said_it", stage: "guess", submitted: [] }))).toBe(
      "Waiting for the others to guess · 0 of 3.",
    );
  });

  it("counts only the people this stage expects", () => {
    // Spill the Tea: the judge doesn't write, so two of three is everyone.
    const judged = round({ game: "spill_tea", stage: "answer", lead_id: "a", submitted: ["b"] });
    expect(waitingLine(judged)).toBe("Waiting for the others to answer · 1 of 2.");
    expect(waitingLine(judged, { judging: true })).toContain("You're judging · waiting for the others");
  });

  it("stops waiting once the stage is full", () => {
    expect(waitingLine(round({ submitted: ["a", "b", "c"] }))).toBe("That's everyone · 3 of 3.");
  });
});
