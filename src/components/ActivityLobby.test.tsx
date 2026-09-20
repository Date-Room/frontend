// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mockTry = false;
vi.mock("@/lib/tryDemo", () => ({ useTryRoom: () => mockTry }));

import { ActivityLobby } from "./ActivityLobby";

const TABS = [
  { id: "vision_board", label: "Vision Board", icon: "✨" },
  { id: "fridge_notes", label: "Sticky Notes", icon: "📝" },
  { id: "this_or_that", label: "This or That", icon: "⚖️" },
  { id: "2_truths", label: "2 Truths", icon: "🎭" },
  { id: "guacamole", label: "Guacamole Panic", icon: "🥑" },
  { id: "rank_it", label: "Rank It", icon: "📊" },
  { id: "questions", label: "Open Book", icon: "📖" },
  { id: "watch", label: "Watch", icon: "📺" },
  { id: "dj", label: "Music", icon: "🎵" },
];

afterEach(() => {
  cleanup();
  mockTry = false;
});

describe("ActivityLobby", () => {
  it("asks the question, then groups the answers", () => {
    render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    expect(screen.getByText("What would you like to do today?")).toBeTruthy();
    expect(screen.getByText("Room")).toBeTruthy();
    expect(screen.getByText("Games")).toBeTruthy();
    expect(screen.getByText("Media")).toBeTruthy();
  });

  it("every card opens its activity on the first tap", () => {
    const onPick = vi.fn();
    render(<ActivityLobby tabs={TABS} onPick={onPick} />);

    fireEvent.click(screen.getByRole("button", { name: /Vision Board/ }));
    expect(onPick).toHaveBeenLastCalledWith("vision_board");

    fireEvent.click(screen.getByRole("button", { name: /^Music/ }));
    expect(onPick).toHaveBeenLastCalledWith("dj");

    fireEvent.click(screen.getByRole("button", { name: /This or That/ }));
    expect(onPick).toHaveBeenLastCalledWith("this_or_that");
  });

  it("shows three games up front and keeps the rest behind one door", () => {
    render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    // Lightest three first — what asks least of two people who just sat down.
    expect(screen.getByRole("button", { name: /This or That/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /2 Truths/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Guacamole Panic/ })).toBeTruthy();
    // The heavier ones are not on the first screen.
    expect(screen.queryByRole("button", { name: /Rank It/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Open Book/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /View all 5/ }));
    expect(screen.getByRole("button", { name: /Rank It/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open Book/ })).toBeTruthy();
  });

  it("carries no per-game copy up front; the lines live behind the door", () => {
    render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    expect(screen.queryByText(/Five snap choices/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /View all 5/ }));
    expect(screen.getByText(/Five snap choices/)).toBeTruthy();
    expect(screen.getByText("5–10 min")).toBeTruthy();
  });

  it("words a Try room as intent rather than a shortage", () => {
    mockTry = true;
    render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /All 5 to try/ })).toBeTruthy();
  });

  it("walls follow what the room has, not whether it is a Together room", () => {
    // A session room that still carries a vision board must still offer it.
    render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /Vision Board/ })).toBeTruthy();

    cleanup();
    render(<ActivityLobby tabs={TABS.filter((t) => t.id !== "vision_board")} onPick={() => {}} />);
    expect(screen.queryByRole("button", { name: /Vision Board/ })).toBeNull();
  });

  it("searches the games by name and by what they are", () => {
    render(<ActivityLobby tabs={TABS} onPick={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /View all 5/ }));

    const search = screen.getByRole("searchbox", { name: /Search games/ });
    // Scoped to the list: the lobby's featured cards are still mounted behind
    // the overlay, so an unscoped query would find them.
    const list = () => within(screen.getByRole("list", { name: "All games" }));

    fireEvent.change(search, { target: { value: "rank" } });
    expect(list().getByRole("button", { name: /Rank It/ })).toBeTruthy();
    expect(list().queryByRole("button", { name: /Guacamole/ })).toBeNull();

    // The description counts too: Open Book never says "questions" in its name.
    fireEvent.change(search, { target: { value: "questions" } });
    expect(list().getByRole("button", { name: /Open Book/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it("omits a group the room has nothing for", () => {
    render(<ActivityLobby tabs={TABS.filter((t) => !["watch", "dj"].includes(t.id))} onPick={() => {}} />);
    expect(screen.queryByText("Media")).toBeNull();
    expect(screen.getByText("Games")).toBeTruthy();
  });
});
