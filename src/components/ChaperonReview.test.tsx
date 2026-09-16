import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({ rate: vi.fn(async () => undefined) }));
vi.mock("@/lib/chaperon", async (orig) => {
  const mod = await orig<typeof import("@/lib/chaperon")>();
  return {
    ...mod,
    rateChaperonDebrief: api.rate,
    getProtectStatus: vi.fn(async () => ({ metering_enabled: false, free_used: true, credits_remaining: 0 })),
    getCoachBetaStatus: vi.fn(async () => ({ calls_remaining: 1, application_status: "granted" })),
  };
});

import { ChaperonReview, protectSummary } from "@/components/ChaperonReview";
import type { ChaperonDebriefResponse } from "@/lib/chaperon";

function res(over: Partial<ChaperonDebriefResponse> = {}): ChaperonDebriefResponse {
  return {
    session_id: "s1",
    mode: "coached",
    data_tier: "beta_labeled",
    started_at: "",
    ended_at: "x",
    debrief: {
      headline: "You stayed grounded.",
      moments: ["A real ask at 4:12."],
      tip: "Bring back the trip thread.",
      safety: "flagged",
    },
    counts: { protect: 1, coach: 3 },
    probe_caught: true,
    rating: null,
    ...over,
  };
}

function mount(r: ChaperonDebriefResponse) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ChaperonReview roomId="room-1" res={r} partnerName="Amara" />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("protectSummary", () => {
  it("counts flags, says all clear, and names the test", () => {
    expect(protectSummary({ protect: 2 }, "flagged", false)).toEqual({ pill: "2 flags", tone: "flagged", test: null });
    expect(protectSummary({ protect: 0 }, "all_clear", true).test).toMatch(/caught your test/);
    expect(protectSummary({ protect: 0 }, "all_clear", false).pill).toBe("All clear");
  });
});

describe("ChaperonReview", () => {
  it("renders the two cards, the test line, and rates the review", async () => {
    mount(res());
    expect(screen.getByText("You stayed grounded.")).toBeTruthy();
    expect(screen.getByText("1 flag")).toBeTruthy();
    expect(screen.getByText("3 nudges")).toBeTruthy();
    expect(screen.getByText(/caught your test/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostly" }));
    await waitFor(() => expect(api.rate).toHaveBeenCalledWith("room-1", "mostly"));
    await waitFor(() => expect(screen.getByText("Thanks.")).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Coach · 1 call/)).toBeTruthy());
  });

  it("hides the Coach card on a Protect-only date and reads all clear with the partner's name", () => {
    mount(res({ mode: "guardian", counts: { protect: 0, coach: 0 }, probe_caught: false, debrief: { headline: "Quiet one.", moments: [], tip: "", safety: "all_clear" } }));
    expect(screen.queryByText(/nudge/)).toBeNull();
    expect(screen.getByText("All clear")).toBeTruthy();
    expect(screen.getByText(/Nothing to flag with Amara/)).toBeTruthy();
  });

  it("shows a prior rating as selected", () => {
    mount(res({ rating: "fair" }));
    expect(screen.getByRole("button", { name: "Yes" }).getAttribute("aria-pressed")).toBe("true");
  });
});
