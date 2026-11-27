/**
 * The options are on the card, with faces, in a line.
 *
 * George, twice: "I saw the full options on mobile, can't see any options
 * on web"; then, after the call-join fix, "On web, its not showing me the
 * selections." The first fix made the ballot appear for anyone who had
 * not joined the call — but on the call the card still handed the vote to
 * the faces in the video and drew nothing itself, so a layout where the
 * seats were small, scrolled away or simply not where he was looking left
 * him reading "tap a seat to vote" over a card with nothing on it.
 *
 * A ballot that is sometimes somewhere else is a ballot you cannot rely
 * on. The card now always draws its own, and tapping a face in the call
 * still works as a shortcut on top of it.
 *
 * And what it draws is people: "since we are selecting people, show their
 * profile.. like their name with the profile photo, so the options look
 * more cool. And animate the questions and options roll out. Keep options
 * in a straight line."
 *
 * Source-level: the component needs a live LiveKit room and a room
 * channel to render, and what went wrong is structural — which branch
 * draws the options at all.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/squad/SquadGame.tsx", "utf8");

describe("the ballot", () => {
  it("is never hidden because the faces are elsewhere", () => {
    // `faceVote` may still decide where the HINT goes; it may never
    // decide whether there are options to tap.
    const ballots = [...src.matchAll(/<Ballot\b/g)];
    expect(ballots.length).toBeGreaterThanOrEqual(3); // vote, imposter, guess
    for (const m of ballots) {
      const before = src.slice(Math.max(0, m.index! - 400), m.index!);
      expect(before).not.toContain("faceVote");
    }
    expect(src).not.toContain("faceVote={faceVote}");
    // The grid it replaced is gone, not left behind as a second answer.
    expect(src).not.toContain("PlayerGrid");
  });

  it("is a straight line of people, not a grid of names", () => {
    const at = src.indexOf("function Ballot({");
    expect(at).toBeGreaterThan(0);
    const body = src.slice(at, at + 2600);
    // One per row, full width: no grid-cols anywhere in it.
    expect(body).not.toMatch(/grid-cols-/);
    expect(body).toContain("flex w-full items-center");
    // A photo (or their initial, or a silhouette — never a "?").
    expect(body).toContain("<Face photo={photoOf(pid)}");
    expect(body).toContain("<PersonLabel");
  });

  it("rolls out under the question", () => {
    const ballot = src.slice(src.indexOf("function Ballot({"), src.indexOf("function AnswerBox("));
    expect(ballot).toContain("stagger-children");
    const prompt = src.slice(src.indexOf("function Prompt({"), src.indexOf("function Face({"));
    expect(prompt).toContain("animate-float-up");
    // Keyed on the text, or a new card inherits the finished animation
    // and the question simply appears.
    expect(prompt).toContain("key={text}");
  });

  it("draws the photo through UserAvatarImg, with a face to fall back to", () => {
    // Google's CDN 403s a bare <img> from another origin; UserAvatarImg
    // is the one that sends no referrer and falls back on error.
    const face = src.slice(src.indexOf("function Face({"), src.indexOf("function Ballot({"));
    expect(face).toContain("<UserAvatarImg");
    expect(face).toContain("<FaceMark");
    expect(face).not.toContain("?");
  });

  it("keeps the card up while you wait, instead of replacing it", () => {
    // The wait panel used to take the card's place the moment you had
    // moved, which removed the only view of what you had picked.
    const at = src.indexOf('{plan.mode === "waiting" && (');
    expect(at).toBeGreaterThan(0);
    expect(src.slice(at, at + 400)).toContain("<WaitPanel");
    const play = src.indexOf("<Play");
    expect(play).toBeGreaterThan(0);
    expect(play).toBeLessThan(at); // the card first, the waiting under it
    expect(src).not.toContain("<Folded");
  });

  it("says what the room is waiting for", () => {
    expect(src).toContain("waitingLine(round)");
  });
});

describe("Next round moves one person", () => {
  it("steps onto a round somebody else dealt rather than dealing again", () => {
    const at = src.indexOf("if (ahead && current) join(current);");
    expect(at).toBeGreaterThan(0);
    expect(src.slice(at, at + 120)).toContain("else setSetup(true)");
  });

  it("renders the round this device is pinned to", () => {
    expect(src).toMatch(/setPin\(\(p\) => nextPin\(p, current\)\)/);
    expect(src).toContain("const view = pin?.state ?? current;");
    expect(src).toContain("const round = view?.round ?? null;");
    // Dealing or skipping is me choosing to move, so it moves my pin too.
    expect(src).toContain("join(s);");
  });
});
