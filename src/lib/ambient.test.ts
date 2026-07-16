import { describe, it, expect } from "vitest";
import { ambientReducer, initAmbient, type AmbientMachine } from "@/lib/ambient";

const cfg = { idleMs: 10 * 60 * 1000 }; // 10 min

describe("ambient state machine", () => {
  it("stays active while idle time is under the threshold", () => {
    const m = initAmbient(0);
    const r = ambientReducer(m, { type: "tick", at: cfg.idleMs - 1 }, cfg);
    expect(r.next.mode).toBe("active");
    expect(r.changed).toBe(false);
    expect(r.broadcast).toBeUndefined();
  });

  it("enters ambient once idle for the threshold and broadcasts ambient", () => {
    const m = initAmbient(0);
    const r = ambientReducer(m, { type: "tick", at: cfg.idleMs }, cfg);
    expect(r.next.mode).toBe("ambient");
    expect(r.changed).toBe(true);
    expect(r.broadcast).toBe("ambient");
  });

  it("local activity wakes from ambient and broadcasts active", () => {
    const ambient: AmbientMachine = { mode: "ambient", lastActivityAt: 0 };
    const r = ambientReducer(ambient, { type: "local-activity", at: 5000 }, cfg);
    expect(r.next.mode).toBe("active");
    expect(r.next.lastActivityAt).toBe(5000);
    expect(r.changed).toBe(true);
    expect(r.broadcast).toBe("active");
  });

  it("peer-active wakes from ambient WITHOUT echoing a broadcast", () => {
    const ambient: AmbientMachine = { mode: "ambient", lastActivityAt: 0 };
    const r = ambientReducer(ambient, { type: "peer-active", at: 5000 }, cfg);
    expect(r.next.mode).toBe("active");
    expect(r.changed).toBe(true);
    expect(r.broadcast).toBeUndefined();
  });

  it("local activity while already active does not broadcast (only edges do)", () => {
    const m = initAmbient(0);
    const r = ambientReducer(m, { type: "local-activity", at: 3000 }, cfg);
    expect(r.next.mode).toBe("active");
    expect(r.changed).toBe(false);
    expect(r.broadcast).toBeUndefined();
    expect(r.next.lastActivityAt).toBe(3000); // timer reset
  });

  it("a tick while already ambient is a no-op", () => {
    const ambient: AmbientMachine = { mode: "ambient", lastActivityAt: 0 };
    const r = ambientReducer(ambient, { type: "tick", at: 10 * cfg.idleMs }, cfg);
    expect(r.next.mode).toBe("ambient");
    expect(r.changed).toBe(false);
    expect(r.broadcast).toBeUndefined();
  });

  it("activity resets the idle timer so ambient is deferred", () => {
    let m = initAmbient(0);
    // Activity at t=9min keeps us active...
    m = ambientReducer(m, { type: "local-activity", at: 9 * 60 * 1000 }, cfg).next;
    // ...so a tick at t=10min (only 1 min since activity) stays active.
    const r = ambientReducer(m, { type: "tick", at: 10 * 60 * 1000 }, cfg);
    expect(r.next.mode).toBe("active");
    // But a tick a full threshold after the last activity flips to ambient.
    const r2 = ambientReducer(m, { type: "tick", at: 19 * 60 * 1000 }, cfg);
    expect(r2.next.mode).toBe("ambient");
  });
});
