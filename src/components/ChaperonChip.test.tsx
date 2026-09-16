import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChaperonChip } from "@/components/ChaperonChip";
import { healthSummary } from "@/components/ChaperonStatusPanel";
import { seamTone } from "@/components/ChaperonSeam";
import type { AgentStatus } from "@/hooks/useChaperon";

const ok = { subscribed: true, receivingAudio: true, turns: 3, lastTurnSecAgo: 2 };
const silent = { subscribed: true, receivingAudio: false, turns: 0, lastTurnSecAgo: null };
const healthy: AgentStatus = { connected: true, judgeOk: true, you: ok, them: ok, lastError: null };

afterEach(cleanup);

describe("healthSummary + seamTone (pure)", () => {
  it("is quiet when healthy and names the failing stage when not", () => {
    expect(healthSummary("watching", healthy, "Amara").healthy).toBe(true);
    expect(healthSummary("watching", { ...healthy, them: silent }, "Amara")).toMatchObject({
      healthy: false,
      sentence: "Not hearing Amara yet.",
    });
    expect(healthSummary("connecting", { ...healthy, connected: false }).sentence).toBe("Connecting…");
    expect(healthSummary("degraded", { ...healthy, judgeOk: false }).sentence).toMatch(/Coaching paused/);
  });
  it("seam encodes health only, and flashes rose for an alert", () => {
    expect(seamTone("off", false)).toBe("off");
    expect(seamTone("watching", false)).toBe("listening");
    expect(seamTone("connecting", false)).toBe("connecting");
    expect(seamTone("degraded", false)).toBe("degraded");
    expect(seamTone("watching", true)).toBe("alert");
  });
});

describe("ChaperonChip", () => {
  it("shows icons only with per-family badges, opens the rail per family", () => {
    const onOpenRail = vi.fn();
    render(
      <ChaperonChip
        status="watching"
        agent={healthy}
        coached
        unread={{ protect: 1, coach: 3 }}
        alertOnScreen={false}
        remoteName="Amara"
        onOpenRail={onOpenRail}
        onOpenStatus={vi.fn()}
      />,
    );
    // No words in the chip body; the label lives in the title (hover).
    expect(screen.getByRole("group", { name: "Chaperon" }).textContent).toBe("13");
    expect(screen.getByRole("group").getAttribute("title")).toBe("Protect + Coach · listening");
    fireEvent.click(screen.getByRole("button", { name: "Protect, 1 unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Coach, 3 unread" }));
    expect(onOpenRail.mock.calls.map((c) => c[0])).toEqual(["protect", "coach"]);
  });

  it("hides the compass without Coach", () => {
    render(
      <ChaperonChip
        status="watching"
        agent={healthy}
        coached={false}
        unread={{ protect: 0, coach: 0 }}
        alertOnScreen={false}
        remoteName="Amara"
        onOpenRail={vi.fn()}
        onOpenStatus={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Coach/ })).toBeNull();
    expect(screen.getByRole("group").getAttribute("title")).toBe("Protect · listening");
  });

  it("becomes the four dots with a reason when a stage fails, and opens status", () => {
    const onOpenStatus = vi.fn();
    render(
      <ChaperonChip
        status="watching"
        agent={{ ...healthy, them: silent }}
        coached
        unread={{ protect: 0, coach: 0 }}
        alertOnScreen={false}
        remoteName="Amara"
        onOpenRail={vi.fn()}
        onOpenStatus={onOpenStatus}
      />,
    );
    const btn = screen.getByRole("button", { name: "Chaperon: Not hearing Amara yet." });
    expect(btn.querySelectorAll('[aria-label="working"]').length).toBe(3);
    expect(btn.querySelectorAll('[aria-label="not working"]').length).toBe(1);
    fireEvent.click(btn);
    expect(onOpenStatus).toHaveBeenCalled();
  });
});
