import { describe, expect, it } from "vitest";

import {
  applyAvatarGesture,
  avatarBaseScale,
  avatarCropRect,
  clampAvatarOffset,
} from "./avatarCrop";

const LANDSCAPE = { imageWidth: 1200, imageHeight: 800 };
const VIEWPORT = 300;

describe("avatarBaseScale", () => {
  it("covers the window from the short edge, so there are never empty bars", () => {
    // Short edge is 800 → it has to reach 300.
    expect(avatarBaseScale(1200, 800, 300)).toBeCloseTo(300 / 800);
    expect(avatarBaseScale(800, 1200, 300)).toBeCloseTo(300 / 800);
  });

  it("survives a zero-sized image instead of dividing by nothing", () => {
    expect(avatarBaseScale(0, 0, 300)).toBe(1);
  });
});

describe("clampAvatarOffset", () => {
  const scale = avatarBaseScale(LANDSCAPE.imageWidth, LANDSCAPE.imageHeight, VIEWPORT);

  it("allows travel on the axis with slack and none on the axis without", () => {
    const far = clampAvatarOffset({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      scale,
      offset: { x: 9999, y: 9999 },
    });
    // At cover scale the short edge exactly fills the window: no vertical give.
    expect(far.y).toBe(0);
    expect(far.x).toBeCloseTo((1200 * scale - VIEWPORT) / 2);
  });

  it("clamps symmetrically in the negative direction", () => {
    const far = clampAvatarOffset({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      scale,
      offset: { x: -9999, y: -9999 },
    });
    expect(far.x).toBeCloseTo(-(1200 * scale - VIEWPORT) / 2);
    expect(far.y).toBe(0);
  });
});

describe("applyAvatarGesture", () => {
  it("accumulates each pan delta, so three 10px drags travel 30px", () => {
    // The bug this guards: adding the delta to the offset captured at
    // gesture start makes the photo spring back on every event and the
    // frame cannot be moved at all.
    let offset = { x: 0, y: 0 };
    for (let i = 0; i < 3; i++) {
      offset = applyAvatarGesture({
        ...LANDSCAPE,
        viewport: VIEWPORT,
        zoomAtStart: 1,
        scaleFactor: 1,
        offset,
        panDelta: { x: 10, y: 0 },
      }).offset;
    }
    expect(offset.x).toBeCloseTo(30);
  });

  it("multiplies the pinch onto the zoom the gesture started at", () => {
    const { zoom } = applyAvatarGesture({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      zoomAtStart: 1.5,
      scaleFactor: 2,
      offset: { x: 0, y: 0 },
      panDelta: { x: 0, y: 0 },
    });
    expect(zoom).toBeCloseTo(3);
  });

  it("never zooms below cover or past the ceiling", () => {
    const base = {
      ...LANDSCAPE,
      viewport: VIEWPORT,
      offset: { x: 0, y: 0 },
      panDelta: { x: 0, y: 0 },
    };
    expect(applyAvatarGesture({ ...base, zoomAtStart: 1, scaleFactor: 0.1 }).zoom).toBe(1);
    expect(applyAvatarGesture({ ...base, zoomAtStart: 1, scaleFactor: 99 }).zoom).toBe(4);
  });

  it("pulls the offset back when zooming out removes the slack it was using", () => {
    const zoomedOut = applyAvatarGesture({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      zoomAtStart: 4,
      scaleFactor: 0.25, // back to cover
      offset: { x: 0, y: 200 }, // only possible while zoomed in
      panDelta: { x: 0, y: 0 },
    });
    expect(zoomedOut.offset.y).toBe(0);
  });
});

describe("avatarCropRect", () => {
  it("takes the centred square when nothing has been moved", () => {
    const scale = avatarBaseScale(LANDSCAPE.imageWidth, LANDSCAPE.imageHeight, VIEWPORT);
    const rect = avatarCropRect({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      scale,
      offset: { x: 0, y: 0 },
    });
    expect(rect.width).toBeCloseTo(800);
    expect(rect.height).toBeCloseTo(800);
    expect(rect.left).toBeCloseTo(200);
    expect(rect.top).toBeCloseTo(0);
  });

  it("dragging the photo right moves the cut leftward in the image", () => {
    const scale = avatarBaseScale(LANDSCAPE.imageWidth, LANDSCAPE.imageHeight, VIEWPORT);
    const rect = avatarCropRect({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      scale,
      offset: { x: 30, y: 0 },
    });
    // 30 viewport px at this scale is 30/scale image px.
    expect(rect.left).toBeCloseTo(200 - 30 / scale);
  });

  it("a zoomed-in crop takes a smaller region", () => {
    const scale = avatarBaseScale(LANDSCAPE.imageWidth, LANDSCAPE.imageHeight, VIEWPORT) * 2;
    const rect = avatarCropRect({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      scale,
      offset: { x: 0, y: 0 },
    });
    expect(rect.width).toBeCloseTo(400);
  });

  it("never reaches outside the bitmap", () => {
    const scale = avatarBaseScale(LANDSCAPE.imageWidth, LANDSCAPE.imageHeight, VIEWPORT);
    const rect = avatarCropRect({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      scale,
      offset: { x: 1e6, y: 1e6 },
    });
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left + rect.width).toBeLessThanOrEqual(LANDSCAPE.imageWidth + 1e-6);
    expect(rect.top + rect.height).toBeLessThanOrEqual(LANDSCAPE.imageHeight + 1e-6);
  });

  it("falls back to the whole image rather than dividing by a zero scale", () => {
    const rect = avatarCropRect({
      ...LANDSCAPE,
      viewport: VIEWPORT,
      scale: 0,
      offset: { x: 0, y: 0 },
    });
    expect(rect).toEqual({ left: 0, top: 0, width: 1200, height: 800 });
  });
});
