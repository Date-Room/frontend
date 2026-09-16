import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  coach: { calls_remaining: 0, application_status: null as string | null },
  protect: { metering_enabled: false, free_used: false, credits_remaining: 0 },
}));
vi.mock("@/lib/chaperon", async (orig) => {
  const mod = await orig<typeof import("@/lib/chaperon")>();
  return {
    ...mod,
    getCoachBetaStatus: vi.fn(async () => api.coach),
    getProtectStatus: vi.fn(async () => api.protect),
    applyCoachBeta: vi.fn(async () => api.coach),
  };
});

import {
  ChaperonSetupSheet,
  prefsToStartConfig,
  setChaperonAutostart,
  takeChaperonAutostart,
} from "@/components/ChaperonSetupSheet";
import { protectPill } from "@/lib/chaperon";

function mount(props: Partial<React.ComponentProps<typeof ChaperonSetupSheet>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ChaperonSetupSheet open onClose={() => {}} variant="live" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  api.coach = { calls_remaining: 0, application_status: null };
  api.protect = { metering_enabled: false, free_used: false, credits_remaining: 0 };
});
afterEach(cleanup);

describe("protectPill", () => {
  it("says what there is to spend", () => {
    expect(protectPill(undefined).label).toBe("1 free date");
    expect(protectPill({ metering_enabled: false, free_used: true, credits_remaining: 0 }).label).toBe("Free");
    expect(protectPill({ metering_enabled: true, free_used: true, credits_remaining: 2 }).label).toBe("2 dates left");
    expect(protectPill({ metering_enabled: true, free_used: true, credits_remaining: 0 }).tone).toBe("empty");
  });
});

describe("prefsToStartConfig", () => {
  it("only sends coached when Coach is on AND a call exists", () => {
    const base = { protect: true, coach: true, announcePresence: true };
    expect(prefsToStartConfig(base, true).mode).toBe("coached");
    expect(prefsToStartConfig(base, false).mode).toBe("guardian");
    expect(prefsToStartConfig({ ...base, coach: false }, true).mode).toBe("guardian");
  });
});

describe("ChaperonSetupSheet", () => {
  it("starts off, names the free date, and only starts once Protect is on", async () => {
    const onStart = vi.fn();
    mount({ onStart, partnerName: "Amara" });
    expect(screen.getByText("Want me in the room?")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("1 free date")).toBeTruthy());
    const primary = screen.getByRole("button", { name: /Choose what you want/ });
    expect((primary as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Tell Amara I'm here/)).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Protect" }));
    const go = screen.getByRole("button", { name: /Use my free protected date/ });
    fireEvent.click(go);
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "guardian", announcePresence: true }),
    );
  });

  it("Coach rides on Protect and shows the call count", async () => {
    api.coach = { calls_remaining: 1, application_status: "granted" };
    const onStart = vi.fn();
    mount({ onStart });
    await waitFor(() => expect(screen.getByText("1 beta call")).toBeTruthy());
    const coach = screen.getByRole("switch", { name: "Coach" }) as HTMLButtonElement;
    expect(coach.disabled).toBe(true); // Protect off → Coach unavailable
    fireEvent.click(screen.getByRole("switch", { name: "Protect" }));
    fireEvent.click(screen.getByRole("switch", { name: "Coach" }));
    fireEvent.click(screen.getByRole("button", { name: /Use my free protected date/ }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ mode: "coached" }));
  });

  it("uses tune, never train, and offers a declined applicant another go", async () => {
    api.coach = { calls_remaining: 0, application_status: "declined" };
    mount();
    await waitFor(() => expect(screen.getByText(/Not this time/)).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/train/i);
    expect(screen.getByRole("button", { name: "Ask again" })).toBeTruthy();
  });

  it("pre-room save arms a one-shot start for that room", async () => {
    const onClose = vi.fn();
    mount({ variant: "preferences", roomId: "room-1", onClose });
    await waitFor(() => expect(screen.getByText("1 free date")).toBeTruthy());
    fireEvent.click(screen.getByRole("switch", { name: "Protect" }));
    fireEvent.click(screen.getByRole("button", { name: /Use my free protected date/ }));
    expect(onClose).toHaveBeenCalled();
    expect(takeChaperonAutostart("room-1")).toBe(true);
    expect(takeChaperonAutostart("room-1")).toBe(false); // consumed
    setChaperonAutostart("room-2", false);
    expect(takeChaperonAutostart("room-2")).toBe(false);
  });
});
