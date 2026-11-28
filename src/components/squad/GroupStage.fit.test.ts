/**
 * The fit decision has to reach the pixels.
 *
 * George: "You've not figured out a way to write a smart layout for
 * calls on web, so that portrait videos are portrait. Everything is
 * still landscape on web. EVERYTHING!!!"
 *
 * The measuring was right — `videoFit` has always said a phone's feed
 * in a laptop tile loses 68% of the frame and must letterbox, and the
 * row planner has been choosing rows from the real feed shapes. The
 * answer simply never arrived: LiveKit's own stylesheet ships
 * `.lk-participant-media-video { object-fit: cover }`, which is the
 * same specificity as Tailwind's `object-contain` and is imported after
 * it, so the class lost every time and every feed cropped to its tile
 * regardless of what had been decided.
 *
 * `RoomVideo` found this and set the property inline, with a comment
 * saying why. The squad call is where that lesson never arrived. These
 * tests are about the mechanism, not the maths — videoFit.test.ts
 * covers the rule.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stage = readFileSync("src/components/squad/GroupStage.tsx", "utf8");
const video = readFileSync("src/components/RoomVideo.tsx", "utf8");

describe("every call tile sets object-fit where a stylesheet cannot overrule it", () => {
  it("inline, on every tile in the squad call", () => {
    expect(stage).toContain("const fitStyle = { objectFit: fitBox.fit } as const;");
    const tiles = [...stage.matchAll(/<VideoTrack\b/g)];
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    for (const m of tiles) {
      const tag = stage.slice(m.index!, stage.indexOf("/>", m.index!) + 2);
      expect(tag).toContain("style={fitStyle}");
    }
  });

  it("and never as a class, which is what lost", () => {
    // The class is the bug. `bg-black` behind a letterboxed feed is
    // fine — it is the fit itself that cannot be a utility. (The
    // comment above it is allowed to name what lost.)
    const code = stage
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(code).not.toContain("object-contain");
    const fit = code.slice(code.indexOf("const fit = () =>"), code.indexOf("const fitStyle"));
    expect(fit).not.toContain("object-cover");
  });

  it("the same way the 1:1 call already did", () => {
    // If this ever stops being true, the comment in GroupStage is
    // pointing at something that no longer exists.
    expect(video).toContain("objectFit: contain ? \"contain\" : autoFit");
    expect(video).toContain("object-fit is set inline, not as a class");
  });

  it("and my own tile is a mirror, while everyone else's is a window", () => {
    // George: "The web camera is inverting what I see of myself. It
    // should naturally invert what the receiver sees, since that way, it
    // creates a true looking at me feel.. But if I raised my right
    // hand, I want to see my right hand raised in the video feed as
    // well."
    //
    // A camera captures what it sees, so raising your right hand puts it
    // on the LEFT of the frame — right for everyone watching you, wrong
    // for you, because every mirror you have used does the opposite. One
    // flip, on the local tile only: the wire is untouched, so the people
    // you are talking to still see you the right way round.
    const fit = stage.slice(stage.indexOf("const fit = () =>"), stage.indexOf("const fitStyle"));
    expect(fit).toContain('isMe && "scale-x-[-1]"');
    // The 1:1 call has always done it; the squad call never got it,
    // which is why this only went wrong on a squad night.
    expect(video).toContain('isLocal ? "scale-x-[-1]"');
    // And it is decided by who the tile belongs to, not by a prop
    // somebody has to remember to pass.
    expect(stage).toContain("const isMe = id === self;");
  });

  it("and the row plan still comes from the real feed shapes", () => {
    // The planner was never the broken part, but it is the other half
    // of the answer: rows sized to the feeds in them.
    expect(stage).toMatch(/useSquadRowPlan\(\s*order\.map[\s\S]{0,200}?publication\?\.dimensions/);
    expect(stage).toContain("callPlan.shares[r]");
  });
});
