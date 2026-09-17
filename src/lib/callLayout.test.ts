import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetCallLayoutForTests,
  clampPaneWidth,
  getCallMode,
  getPaneWidth,
  PANE_MIN_PX,
  setCallMode,
  setPaneWidth,
} from "./callLayout";

describe("callLayout store", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetCallLayoutForTests();
  });

  it("defaults to split and persists a change", () => {
    expect(getCallMode()).toBe("split");
    setCallMode("bubble");
    expect(getCallMode()).toBe("bubble");
    expect(localStorage.getItem("dr:call-layout")).toBe("bubble");
  });

  it("pane width persists and clears", () => {
    expect(getPaneWidth()).toBeNull();
    setPaneWidth(333.6);
    expect(getPaneWidth()).toBe(334);
    expect(localStorage.getItem("dr:call-pane-width")).toBe("334");
    setPaneWidth(null);
    expect(getPaneWidth()).toBeNull();
    expect(localStorage.getItem("dr:call-pane-width")).toBeNull();
  });

  it("clamps between the minimum and half the row", () => {
    expect(clampPaneWidth(100, 1400)).toBe(PANE_MIN_PX);
    expect(clampPaneWidth(900, 1400)).toBe(700);
    expect(clampPaneWidth(500, 1400)).toBe(500);
    // A row too narrow for half ≥ min still yields the minimum, never less.
    expect(clampPaneWidth(400, 400)).toBe(PANE_MIN_PX);
  });
});
