import { describe, it, expect } from "vitest";
import {
  AvatarImageError,
  AVATAR_QUALITIES,
  assertValidAvatarFile,
  dataUrlByteSize,
  encodeUnderBudget,
  squareCropRect,
} from "@/lib/avatarImage";

describe("squareCropRect", () => {
  it("crops a landscape image to a centered square", () => {
    expect(squareCropRect(1000, 600)).toEqual({ sx: 200, sy: 0, size: 600 });
  });
  it("crops a portrait image to a centered square", () => {
    expect(squareCropRect(600, 1000)).toEqual({ sx: 0, sy: 200, size: 600 });
  });
  it("leaves a square image unchanged", () => {
    expect(squareCropRect(800, 800)).toEqual({ sx: 0, sy: 0, size: 800 });
  });
});

describe("dataUrlByteSize", () => {
  it("estimates bytes from a base64 data URL", () => {
    // "AAAA" (4 base64 chars, no padding) → 3 bytes.
    expect(dataUrlByteSize("data:image/jpeg;base64,AAAA")).toBe(3);
  });
  it("accounts for padding", () => {
    expect(dataUrlByteSize("data:image/jpeg;base64,AAA=")).toBe(2);
    expect(dataUrlByteSize("data:image/jpeg;base64,AA==")).toBe(1);
  });
  it("returns 0 for an empty payload", () => {
    expect(dataUrlByteSize("data:image/jpeg;base64,")).toBe(0);
  });
});

describe("encodeUnderBudget", () => {
  const url = (chars: number) => "data:image/jpeg;base64," + "A".repeat(chars);

  it("returns the first quality whose output fits the budget", () => {
    // ~30 bytes budget. q0.85 → big, q0.7 → fits.
    const sizes: Record<number, number> = { 0.85: 200, 0.7: 20, 0.55: 8 };
    const calls: number[] = [];
    const out = encodeUnderBudget(
      (q) => {
        calls.push(q);
        return url(sizes[q]);
      },
      AVATAR_QUALITIES,
      30,
    );
    expect(dataUrlByteSize(out)).toBeLessThanOrEqual(30);
    expect(calls).toEqual([0.85, 0.7]); // stopped once it fit — didn't try 0.55
  });

  it("returns the smallest (last) attempt when nothing fits", () => {
    const out = encodeUnderBudget(() => url(400), AVATAR_QUALITIES, 30);
    expect(dataUrlByteSize(out)).toBeGreaterThan(30); // best effort, over budget
    expect(out).toBe(url(400));
  });
});

describe("assertValidAvatarFile", () => {
  it("accepts an image within the size cap", () => {
    expect(() =>
      assertValidAvatarFile({ type: "image/jpeg", size: 8 * 1024 * 1024 }),
    ).not.toThrow();
  });
  it("rejects a non-image", () => {
    expect(() => assertValidAvatarFile({ type: "application/pdf", size: 1000 })).toThrow(
      AvatarImageError,
    );
  });
  it("rejects a file over the input cap", () => {
    expect(() =>
      assertValidAvatarFile({ type: "image/png", size: 20 * 1024 * 1024 }),
    ).toThrow(/under 15 MB/);
  });
});
