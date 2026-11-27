/**
 * A notice behaves like a notice.
 *
 * George: "The notice on web that someone has joined the call, it should
 * be swipe-to-dismiss like any other toast. Instead it stays there and
 * asks me to join. It doesn't even auto-dismiss... It needs to. Also,
 * Can we make it like a call notification with like a vibrating call
 * icon, in green."
 *
 * Source-level: the card portals itself over a live room, and what was
 * wrong is structural — it had no timer and no gesture, and a call
 * looked exactly like an invitation to a word game.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/ActivityInvite.tsx", "utf8");
const stage = readFileSync("src/components/RoomStage.tsx", "utf8");
const css = readFileSync("src/index.css", "utf8");

describe("the notice", () => {
  it("sees itself out", () => {
    expect(src).toContain("STAY_MS");
    expect(src).toMatch(/setTimeout\(onDecline, call \? STAY_MS\.call : STAY_MS\.activity\)/);
    // A call is given longer: it is the one worth looking up for.
    expect(src).toMatch(/call: 30_000/);
    expect(src).toMatch(/activity: 12_000/);
    // Restarted per notice, so a second invite gets its own full stay.
    expect(src).toMatch(/\}, \[activityId, call, onDecline\]\)/);
  });

  it("can be pushed away", () => {
    for (const hook of ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel"]) {
      expect(src).toContain(hook);
    }
    expect(src).toContain("SWIPE_OUT");
    // Follows the finger, and springs back when the swipe was half-hearted.
    expect(src).toContain("translateX(${dx}px)");
    expect(src).toMatch(/Math\.abs\(dx\) >= SWIPE_OUT\) onDecline\(\);\s*else setDx\(0\)/);
    // A drag that starts on Join is a tap on Join.
    expect(src).toContain('closest("button")');
  });

  it("rings in green when it is a call", () => {
    expect(src).toContain('kind?: "activity" | "call"');
    expect(src).toContain("<PhoneCall");
    expect(src).toContain("dr-handset");
    expect(src).toContain("dr-ring-pulse");
    expect(src).toMatch(/emerald/);
    // The animations exist, and stop for anyone who asked for less motion.
    expect(css).toContain("@keyframes dr-handset");
    expect(css).toContain("@keyframes dr-ring-pulse");
    const reduce = css.slice(css.indexOf("@keyframes dr-handset"));
    expect(reduce).toMatch(/prefers-reduced-motion[\s\S]{0,200}dr-handset/);
  });
});

describe("the room raises it", () => {
  it("once per call, and never at someone already in it", () => {
    expect(stage).toContain("const [callNotice, setCallNotice] = useState<string | null>(null)");
    expect(stage).toContain("toldOfCall");
    const at = stage.indexOf("useEffect(() => {\n    if (!callerName)");
    expect(at).toBeGreaterThan(0);
    const body = stage.slice(at, at + 700);
    // In it already: nothing to tell me. Call over: the latch resets so
    // the next one is announced.
    expect(body).toContain("if (callActive)");
    expect(body).toContain("toldOfCall.current = false");
    expect(body).toContain("inviteChime(true)");
  });

  it("and the call comes before a word game", () => {
    expect(stage).toContain('kind="call"');
    const call = stage.indexOf('kind="call"');
    const activity = stage.indexOf("{!callNotice &&\n        inviteId &&");
    expect(call).toBeGreaterThan(0);
    expect(activity).toBeGreaterThan(call);
  });
});
