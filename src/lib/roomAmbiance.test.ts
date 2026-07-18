import { describe, it, expect } from "vitest";
import { backgroundMoodLabel } from "@/lib/roomAmbiance";
import { PLAIN_MOOD } from "@/lib/ambiance";

describe("backgroundMoodLabel", () => {
  it("labels a known preset with its name + emoji", () => {
    expect(backgroundMoodLabel("ocean")).toBe("Ocean hush 🌊");
    expect(backgroundMoodLabel("golden")).toBe("Golden hour 🌇");
  });

  it("labels the plain / unset room", () => {
    expect(backgroundMoodLabel(PLAIN_MOOD)).toBe("a plain room");
    expect(backgroundMoodLabel(null)).toBe("a plain room");
    expect(backgroundMoodLabel(undefined)).toBe("a plain room");
  });

  it("falls back to plain for legacy / unknown slugs", () => {
    expect(backgroundMoodLabel("gradient-dusk")).toBe("a plain room");
  });
});
