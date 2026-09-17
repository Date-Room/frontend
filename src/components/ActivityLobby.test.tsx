// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mockTry = false;
vi.mock("@/lib/tryDemo", () => ({ useTryRoom: () => mockTry }));
vi.mock("@/context/ChaperonContext", () => ({ useChaperonController: () => ({ enabled: true }) }));

import { ActivityLobby } from "./ActivityLobby";

const TABS = [
  { id: "watch", label: "Watch Together", icon: "🎬" },
  { id: "dj", label: "Listen Together", icon: "🎧" },
  { id: "this_or_that", label: "This or That", icon: "↔️" },
  { id: "rank_it", label: "Rank It", icon: "📊" },
  { id: "questions", label: "Open Book", icon: "❓" },
  { id: "vision_board", label: "Vision Board", icon: "✨" },
];

afterEach(() => {
  cleanup();
  mockTry = false;
});

describe("ActivityLobby", () => {
  it("utilities open on the first tap; pickers expand instead", () => {
    const onPick = vi.fn();
    render(<ActivityLobby tabs={TABS} onPick={onPick} />);

    fireEvent.click(screen.getByRole("button", { name: /Listen Together/ }));
    expect(onPick).toHaveBeenCalledWith("dj");

    const games = screen.getByRole("button", { name: /Play a Game/ });
    expect(games).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(games);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Rank It/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Rank It/ }));
    expect(onPick).toHaveBeenLastCalledWith("rank_it");
  });

  it("counts what is there, and words a Try room as intent", () => {
    const { unmount } = render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    expect(screen.getByText("2 ready")).toBeTruthy();
    expect(screen.getByText("1 ready")).toBeTruthy();
    unmount();

    mockTry = true;
    render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    expect(screen.getByText("2 to try")).toBeTruthy();
    expect(screen.queryByText(/ready/)).toBeNull();
  });

  it("carries no per-card copy on the shelf; the lines live in the picker", () => {
    render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    expect(screen.queryByText(/Same film, same second/)).toBeNull();
    expect(screen.queryByText(/Open it/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Play a Game/ }));
    expect(screen.getByText(/Five snap choices/)).toBeTruthy();
  });

  it("session rooms list walls as chips, Together rooms as tiles", () => {
    const { unmount } = render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    expect(screen.getByText("What are we doing tonight?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Vision Board/ })).toBeTruthy();
    unmount();

    render(<ActivityLobby tabs={TABS} onPick={() => {}} wallRoom />);
    expect(screen.getByText("Your room")).toBeTruthy();
    expect(screen.getByText("Tonight")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
  });
});
