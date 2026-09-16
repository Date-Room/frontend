import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  queue: { unreviewed: 2, items: [] as unknown[] },
  verdicts: [] as unknown[],
}));
vi.mock("@/lib/admin", async (orig) => {
  const mod = await orig<typeof import("@/lib/admin")>();
  return {
    ...mod,
    getBetaOverview: vi.fn(async () => ({ on_air: { sessions: 0, coached: 0, guardian: 0 }, today: {}, yesterday: {}, unreviewed: 2 })),
    getBetaLive: vi.fn(async () => ({ sessions: [] })),
    getBetaHealth: vi.fn(async () => ({ needs_you: [], stuck_sessions: [], cost: { rows_today: 0, sessions_ended_today: 0 }, unwritten_debriefs: 0, suppression: { signals: 0, agent: 0, gate: 0 }, judges: [], by_check: [] })),
    getBetaFeed: vi.fn(async () => ({ items: [], next_cursor: null })),
    getBetaReviewQueue: vi.fn(async () => api.queue),
    postBetaVerdict: vi.fn(async (b: unknown) => { api.verdicts.push(b); }),
    listCoachBetaApplicationsBy: vi.fn(async () => ({ items: [], pending_count: 0 })),
  };
});

import AdminBeta, { delta, outcomeLabel, reactionLabel, waitingFor } from "@/pages/admin/AdminBeta";

const row = (over: Record<string, unknown> = {}) => ({
  event_id: "e1", at: "2026-09-16T18:42:10Z", call: "Call 1A2B", tester: "T-31", team: false, mode: "coached",
  family: "protect", check_id: "money_ask", severity: "alert", confidence: 0.82, pattern: "direct request, amount stated",
  provider: "anthropic", model: "claude-haiku-4-5", rubric_version: "v3", elapsed_sec: 759, outcome: "shown",
  reaction: "unhelpful", reaction_reason: "not_happen", shared: true, probe: false, review: null,
  whisper: "[your date] just asked you for $2,000.", ...over,
});

afterEach(() => { cleanup(); api.verdicts.length = 0; });

describe("helpers", () => {
  it("delta, outcome words, reaction words, waiting time", () => {
    expect(delta(41, 35)).toEqual({ text: "+6", tone: "up" });
    expect(delta(30, 34, " pts")).toEqual({ text: "−4 pts", tone: "down" });
    expect(delta(5, 5).text).toBe("flat");
    expect(delta(null, 5).text).toBe("");
    expect(outcomeLabel("suppressed_gate")).toBe("held · gate");
    expect(outcomeLabel("suppressed_agent")).toBe("held · cooldown");
    expect(reactionLabel({ reaction: "helpful", reaction_reason: null, family: "protect" })).toBe("agreed");
    expect(reactionLabel({ reaction: "unhelpful", reaction_reason: "too_late", family: "coach" })).toBe("not that · too late");
    const now = Date.parse("2026-09-16T12:00:00Z");
    expect(waitingFor("2026-09-16T09:30:00Z", now)).toBe("2h");
    expect(waitingFor("2026-09-13T09:30:00Z", now)).toBe("3d");
  });
});

describe("Review tab", () => {
  it("shows the pattern and the flag, saves a verdict with a tag and moves on", async () => {
    api.queue = { unreviewed: 2, items: [row(), row({ event_id: "e2", shared: false, check_id: "stall" })] };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><AdminBeta /></QueryClientProvider>);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Review/ }));
    await waitFor(() => expect(screen.getByText("direct request, amount stated")).toBeTruthy());
    expect(screen.getByText(/Flagged by the tester/)).toBeTruthy();
    const save = screen.getByRole("button", { name: /Save & next/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "wrong" }));
    fireEvent.click(screen.getByRole("button", { name: "User is right" }));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(api.verdicts).toHaveLength(1));
    expect(api.verdicts[0]).toMatchObject({ event_id: "e1", verdict: "wrong", tag: "user_right" });
  });

  it("never renders words about a call, even if a stray field arrived", async () => {
    api.queue = { unreviewed: 1, items: [row({ shared: true, whisper: "[your date] just asked for $2,000." } as Record<string, unknown>)] };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><AdminBeta /></QueryClientProvider>);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Review/ }));
    await waitFor(() => expect(screen.getByText("direct request, amount stated")).toBeTruthy());
    expect(screen.queryByText(/just asked/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$2,000/);
  });
});
