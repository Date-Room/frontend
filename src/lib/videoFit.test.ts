import { describe, expect, it } from "vitest";
import { coverCrop, videoFit, videoFitFor, MAX_CROP } from "./videoFit";

const PHONE = 9 / 16;       // what a handset publishes: 540x960
const LAPTOP = 16 / 9;
const WEBCAM = 4 / 3;
const SQUARE = 1;

describe("coverCrop", () => {
  it("measures what cover throws away", () => {
    expect(coverCrop(LAPTOP, LAPTOP)).toBe(0);
    // The bug: a phone feed in a laptop tile loses the top and bottom of
    // the person, which is why it looked zoomed in.
    expect(coverCrop(PHONE, LAPTOP)).toBeCloseTo(0.68, 2);
    expect(coverCrop(PHONE, SQUARE)).toBeCloseTo(0.44, 2);
    expect(coverCrop(WEBCAM, LAPTOP)).toBeCloseTo(0.25, 2);
  });

  it("is symmetric — a tile on its side crops the same", () => {
    expect(coverCrop(PHONE, LAPTOP)).toBeCloseTo(coverCrop(LAPTOP, PHONE), 10);
  });

  it("treats a feed with no dimensions as nothing to crop", () => {
    expect(coverCrop(0, LAPTOP)).toBe(0);
    expect(coverCrop(NaN, LAPTOP)).toBe(0);
  });
});

describe("videoFit", () => {
  it("fills when the shapes are close", () => {
    expect(videoFit(LAPTOP, LAPTOP)).toBe("cover");
    // 4:3 into 16:9 is the familiar case and has always filled fine.
    expect(videoFit(WEBCAM, LAPTOP)).toBe("cover");
  });

  it("stops cropping once it would cut the person up", () => {
    expect(videoFit(PHONE, LAPTOP)).toBe("contain");
    expect(videoFit(PHONE, SQUARE)).toBe("contain");
    expect(videoFit(LAPTOP, SQUARE)).toBe("contain");
  });

  it("switches exactly at the stated threshold", () => {
    // Pin the boundary so changing the constant is a deliberate act.
    const justUnder = 1 / (1 - (MAX_CROP - 0.001));
    const justOver = 1 / (1 - (MAX_CROP + 0.001));
    expect(videoFit(1, justUnder)).toBe("cover");
    expect(videoFit(1, justOver)).toBe("contain");
  });
});

describe("videoFitFor", () => {
  it("fills until the feed reports a size", () => {
    // A tile that has not received a frame must not flash letterboxed.
    expect(videoFitFor({ videoWidth: 0, videoHeight: 0 }, { clientWidth: 800, clientHeight: 450 })).toBe("cover");
    expect(videoFitFor(null, { clientWidth: 800, clientHeight: 450 })).toBe("cover");
    expect(videoFitFor({ videoWidth: 540, videoHeight: 960 }, null)).toBe("cover");
  });

  it("letterboxes a real phone feed in a real laptop tile", () => {
    expect(videoFitFor({ videoWidth: 540, videoHeight: 960 }, { clientWidth: 960, clientHeight: 540 })).toBe("contain");
  });

  it("fills a laptop feed in a laptop tile", () => {
    expect(videoFitFor({ videoWidth: 1280, videoHeight: 720 }, { clientWidth: 960, clientHeight: 540 })).toBe("cover");
  });
});
