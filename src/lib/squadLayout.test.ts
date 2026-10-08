import { afterEach, describe, expect, it } from "vitest";
import { AUTO_GRID_MIN_WIDTH, readSquadLayout, resolveSquadLayout, saveSquadLayout } from "@/lib/squadLayout";

afterEach(() => localStorage.clear());

describe("resolveSquadLayout", () => {
  const wide = { tucked: false, width: AUTO_GRID_MIN_WIDTH };
  const narrow = { tucked: false, width: AUTO_GRID_MIN_WIDTH - 1 };
  it("honours the viewer's choice", () => {
    expect(resolveSquadLayout("grid", narrow)).toBe("grid");
    expect(resolveSquadLayout("speaker", wide)).toBe("focus");
  });
  it("auto: grid from a laptop-ish window, speaker below it", () => {
    expect(resolveSquadLayout("auto", wide)).toBe("grid");
    expect(resolveSquadLayout("auto", narrow)).toBe("focus");
    expect(AUTO_GRID_MIN_WIDTH).toBe(768);
  });
  it("a tucked-away call is always the speaker view", () => {
    expect(resolveSquadLayout("grid", { tucked: true, width: 2000 })).toBe("focus");
  });
});

describe("the saved choice", () => {
  it("is remembered on this device, auto by default", () => {
    expect(readSquadLayout()).toBe("auto");
    saveSquadLayout("grid");
    expect(readSquadLayout()).toBe("grid");
    saveSquadLayout("auto");
    expect(localStorage.getItem("dr:squad-layout")).toBeNull();
  });
});
