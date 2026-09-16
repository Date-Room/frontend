import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChaperonReactions, checkLabel, familyOf } from "@/components/ChaperonReactions";
import type { ChaperonSignal } from "@/lib/chaperon";

const sig = (over: Partial<ChaperonSignal> = {}): ChaperonSignal => ({
  event_id: "e1",
  check_id: "money_ask",
  severity: "alert",
  whisper: "w",
  confidence: 0.9,
  ...over,
});

afterEach(cleanup);

describe("helpers", () => {
  it("maps severity to family and check ids to labels", () => {
    expect(familyOf("alert")).toBe("protect");
    expect(familyOf("warn")).toBe("protect");
    expect(familyOf("note")).toBe("coach");
    expect(checkLabel("money_ask")).toBe("Money ask");
    expect(checkLabel("meetup-pressure")).toBe("Meetup pressure");
  });
});

describe("ChaperonReactions", () => {
  it("uses Protect words and sends Agree as helpful", () => {
    const onRate = vi.fn();
    render(<ChaperonReactions signal={sig()} rated={undefined} onRate={onRate} />);
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    expect(onRate).toHaveBeenCalledWith(true);
  });

  it("uses Coach words for notes", () => {
    render(<ChaperonReactions signal={sig({ severity: "note" })} rated={undefined} onRate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Right call" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not that" })).toBeTruthy();
  });

  it("Wrong call asks one why, share is off by default, Send carries both", () => {
    const onRate = vi.fn();
    render(<ChaperonReactions signal={sig()} rated={undefined} onRate={onRate} />);
    fireEvent.click(screen.getByRole("button", { name: "Wrong call" }));
    expect(screen.getByText("What did I get wrong?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "That did not happen" }));
    const share = screen.getByRole("checkbox") as HTMLInputElement;
    expect(share.checked).toBe(false);
    fireEvent.click(share);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onRate).toHaveBeenCalledWith(false, { reason: "not_happen", shareWithTeam: true });
  });

  it("Skip on the why sends a plain unhelpful with nothing shared", () => {
    const onRate = vi.fn();
    render(<ChaperonReactions signal={sig()} rated={undefined} onRate={onRate} />);
    fireEvent.click(screen.getByRole("button", { name: "Wrong call" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onRate).toHaveBeenCalledWith(false);
  });

  it("shows the chosen word once rated, and nothing on a probe or unrateable signal", () => {
    const { rerender } = render(<ChaperonReactions signal={sig()} rated="up" onRate={vi.fn()} />);
    expect(screen.getByText("Agreed")).toBeTruthy();
    rerender(<ChaperonReactions signal={sig()} rated="down" onRate={vi.fn()} />);
    expect(screen.getByText(/Noted/)).toBeTruthy();
    rerender(<ChaperonReactions signal={sig({ probe: true })} rated={undefined} onRate={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<ChaperonReactions signal={sig({ event_id: null })} rated={undefined} onRate={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
