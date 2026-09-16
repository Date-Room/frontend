import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

let mockCtrl: Record<string, unknown> | null = null;
vi.mock("@/context/ChaperonContext", () => ({ useChaperonController: () => mockCtrl }));

import { ChaperonTryCard, hasTriedChaperon } from "@/components/ChaperonTryCard";

function ctrl(over: Record<string, unknown> = {}) {
  return {
    enabled: true,
    active: true,
    probe: "idle",
    startProbe: vi.fn(async () => {}),
    cancelProbe: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ChaperonTryCard", () => {
  it("shows the line once, arms on 'I said it', and leaves after the catch", () => {
    mockCtrl = ctrl();
    const { rerender } = render(<ChaperonTryCard partnerName="Amara" />);
    expect(screen.getByText(/Say this to Amara/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "I said it" }));
    expect((mockCtrl as ReturnType<typeof ctrl>).startProbe).toHaveBeenCalled();

    mockCtrl = ctrl({ probe: "armed" });
    rerender(<ChaperonTryCard partnerName="Amara" />);
    expect(screen.getByText(/Listening for it/)).toBeTruthy();

    mockCtrl = ctrl({ probe: "caught" });
    rerender(<ChaperonTryCard partnerName="Amara" />);
    expect(screen.getByText(/Caught it/)).toBeTruthy();
    expect(hasTriedChaperon()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(6_500);
    });
    expect(screen.queryByText(/Caught it/)).toBeNull();
  });

  it("skip remembers and cancels; never shows again", () => {
    mockCtrl = ctrl();
    render(<ChaperonTryCard partnerName={null} />);
    expect(screen.getByText(/Say this to them/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect((mockCtrl as ReturnType<typeof ctrl>).cancelProbe).toHaveBeenCalled();
    cleanup();
    render(<ChaperonTryCard partnerName={null} />);
    expect(screen.queryByText(/Say this to/)).toBeNull();
  });

  it("renders nothing when the chaperon is off", () => {
    mockCtrl = ctrl({ active: false });
    render(<ChaperonTryCard partnerName="Amara" />);
    expect(screen.queryByText(/Say this to/)).toBeNull();
  });
});
