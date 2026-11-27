/**
 * Starting a call must not rebuild what you were doing.
 *
 * George: "When a question is already selected on the web, and a call is
 * started, it deselects the option selected.. is this because those
 * components are being rebuilt? If that's the case would it be better
 * performance to simply move the same activity back and forth between
 * calls? As opposed to rebuilding... This includes game activities,
 * music, watch, etc.. Check for each and implement the most efficient
 * and best user experience pattern..."
 *
 * Right on both counts. Starting a call changes which layout branch the
 * stage takes — the split pane, the squad table, the game-and-faces
 * split — and each branch rendered the activity at a different place in
 * the React tree. A component that changes position unmounts and mounts
 * again, so every activity was rebuilt from scratch: a half-answered
 * question lost its selection, a film lost its position and re-buffered,
 * the music stopped and started, a game threw away a pick not yet sent.
 *
 * The call has never had the problem, because it is portalled into a
 * hand-managed node that React does not reconcile: moving the NODE keeps
 * the subtree mounted. The activity now gets the same treatment.
 *
 * Source-level: the component needs a live room, a channel and LiveKit
 * to render, and what matters is structural — how many places build the
 * activity, and whether the layout moves a node or rebuilds a tree.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/RoomStage.tsx", "utf8");

describe("the staged activity survives a layout change", () => {
  it("is built in exactly one place", () => {
    // Three call sites was the bug: each one is a different position in
    // the tree, and the layout chose between them.
    const built = [...src.matchAll(/renderContent\(staged, commitStage\)/g)];
    expect(built).toHaveLength(1);
    const boundaries = [...src.matchAll(/<ActivityBoundary\b/g)];
    expect(boundaries).toHaveLength(1);
  });

  it("goes into a node React does not reconcile", () => {
    expect(src).toContain("const stageHostRef = useRef<HTMLDivElement | null>(null)");
    expect(src).toMatch(/stageHostRef\.current = document\.createElement\("div"\)/);
    // `contents`, so the slot's own flex and height rules still reach it.
    expect(src).toMatch(/stageHostRef\.current\.style\.display = "contents"/);
    expect(src).toMatch(/createPortal\(\s*<ActivityBoundary/);
    expect(src).toContain("stageHostRef.current,");
  });

  it("is moved, not rebuilt, when the layout changes", () => {
    const at = src.indexOf("const host = stageHostRef.current;");
    expect(at).toBeGreaterThan(0);
    const body = src.slice(at, at + 700);
    expect(body).toContain("target.appendChild(host)");
    // Nothing to do when it is already where it belongs.
    expect(body).toContain("host.parentElement === target");
    // Every layout that owns a slot is a reason to re-home.
    for (const dep of ["table", "squadGameStaged", "staged"]) {
      expect(body).toContain(dep);
    }
  });

  it("re-homes in the same task that moved the slot", () => {
    // A plain effect runs after the browser may have already dropped the
    // detached subtree's media — the call learned this the hard way.
    const at = src.indexOf("const host = stageHostRef.current;");
    const before = src.slice(Math.max(0, at - 400), at);
    expect(before).toContain("useLayoutEffect");
  });

  it("still rebuilds when you switch to a different activity", () => {
    // The one time a rebuild is the right answer: a new activity is new
    // state, not continued state.
    expect(src).toMatch(/<ActivityBoundary label=\{stagedItem\?\.title\} resetKey=\{staged\}>/);
  });

  it("keeps a slot in every layout the stage can take", () => {
    for (const slot of ["tableStageSlotRef", "gameStageSlotRef", "plainStageSlotRef"]) {
      // Declared, and mounted as a ref on a div.
      expect(src).toContain(`const ${slot} = useRef<HTMLDivElement>(null)`);
      expect(src).toContain(`ref={${slot}}`);
    }
  });
});
