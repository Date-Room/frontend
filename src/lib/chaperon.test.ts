import { describe, it, expect } from "vitest";
import {
  admitSignal,
  dismissCurrent,
  initGate,
  DEFAULT_GATE_CONFIG,
  type ChaperonSignal,
  type ChaperonSeverity,
} from "@/lib/chaperon";

function sig(
  check_id: string,
  severity: ChaperonSeverity,
  event_id: string | null = "e",
): ChaperonSignal {
  return { event_id, check_id, severity, whisper: `${check_id} fired`, confidence: 0.6 };
}

describe("whisper gate — frequency caps", () => {
  it("shows a whisper when nothing is visible", () => {
    const { state, show } = admitSignal(initGate(), sig("scam_script", "warn"), 1000);
    expect(show?.check_id).toBe("scam_script");
    expect(state.current?.check_id).toBe("scam_script");
  });

  it("suppresses a second whisper while one is visible (one at a time)", () => {
    let g = initGate();
    g = admitSignal(g, sig("scam_script", "warn"), 1000).state;
    const { show } = admitSignal(g, sig("balance", "note"), 1500);
    expect(show).toBeNull();
  });

  it("suppresses the same category within its cooldown, allows it after", () => {
    let g = initGate();
    g = admitSignal(g, sig("platform_move", "warn"), 0).state;
    g = dismissCurrent(g); // no longer visible
    // 10s later, same category → still in the 20s cooldown → dropped.
    expect(admitSignal(g, sig("platform_move", "warn"), 10_000).show).toBeNull();
    // 21s later → cooldown elapsed → shown.
    expect(admitSignal(g, sig("platform_move", "warn"), 21_000).show?.check_id).toBe(
      "platform_move",
    );
  });

  it("lets an alert preempt the visible whisper and ignore cooldown", () => {
    let g = initGate();
    g = admitSignal(g, sig("chemistry", "note"), 1000).state; // something visible
    const { show } = admitSignal(g, sig("money_ask", "alert"), 1200);
    expect(show?.check_id).toBe("money_ask");
    expect(show?.severity).toBe("alert");
  });

  it("enforces the coach rate cap (1 per 2 min)", () => {
    let g = initGate();
    // First coach note shows.
    let r = admitSignal(g, sig("chemistry", "note"), 0);
    expect(r.show).not.toBeNull();
    g = dismissCurrent(r.state);
    // A different coach category, past its own cooldown, but within 2 min → capped.
    r = admitSignal(g, sig("balance", "note"), 30_000);
    expect(r.show).toBeNull();
    // After 2 min, coach cue allowed again.
    r = admitSignal(g, sig("balance", "note"), 130_000);
    expect(r.show?.check_id).toBe("balance");
  });

  it("does not rate-cap safety warns the way it caps coach notes", () => {
    let g = initGate();
    g = admitSignal(g, sig("coercion", "warn"), 0).state;
    g = dismissCurrent(g);
    // Different safety category, past cooldown, shortly after → still allowed
    // (warns aren't coach-rate-capped).
    const { show } = admitSignal(g, sig("meetup_pressure", "warn"), 25_000);
    expect(show?.check_id).toBe("meetup_pressure");
  });

  it("uses the spec cadence defaults", () => {
    expect(DEFAULT_GATE_CONFIG.displayMs).toBe(6_000);
    expect(DEFAULT_GATE_CONFIG.categoryCooldownMs).toBe(20_000);
    expect(DEFAULT_GATE_CONFIG.coachShortMax).toBe(1);
    expect(DEFAULT_GATE_CONFIG.coachLongMax).toBe(3);
  });
});
