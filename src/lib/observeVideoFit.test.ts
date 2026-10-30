import { describe, expect, it, vi } from "vitest";
import { observeVideoFit } from "./observeVideoFit";

/** A <video> jsdom will report dimensions for. */
function video(w: number, h: number) {
  const el = document.createElement("video");
  Object.defineProperty(el, "videoWidth", { value: w, configurable: true });
  Object.defineProperty(el, "videoHeight", { value: h, configurable: true });
  return el;
}

function tile(w: number, h: number) {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: w, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: h, configurable: true });
  document.body.appendChild(el);
  return el;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("observeVideoFit", () => {
  it("waits for a video that is not there yet", async () => {
    // The bug this exists for. LiveKit mounts the <video> itself, a beat
    // after the component's effect runs. The first version looked once,
    // found nothing, attached listeners to null and never measured — so
    // every tile stayed cropped.
    const el = tile(960, 540); // landscape tile
    const seen: string[] = [];
    const obs = observeVideoFit(el, (f) => seen.push(f), {
      MutationObserver: globalThis.MutationObserver,
    });

    expect(seen).toEqual(["cover"]); // nothing to measure yet

    el.appendChild(video(540, 960)); // a phone's portrait feed arrives
    await flush();

    expect(seen.at(-1)).toBe("contain");
    obs.stop();
  });

  it("measures a video that is already there", async () => {
    const el = tile(960, 540);
    el.appendChild(video(540, 960));
    const seen: string[] = [];
    const obs = observeVideoFit(el, (f) => seen.push(f), {
      MutationObserver: globalThis.MutationObserver,
    });
    expect(seen.at(-1)).toBe("contain");
    obs.stop();
  });

  it("leaves a well-matched feed filling", async () => {
    const el = tile(960, 540);
    el.appendChild(video(1280, 720));
    const seen: string[] = [];
    const obs = observeVideoFit(el, (f) => seen.push(f), {
      MutationObserver: globalThis.MutationObserver,
    });
    expect(seen.at(-1)).toBe("cover");
    obs.stop();
  });

  it("follows a phone turned sideways mid-call", async () => {
    const el = tile(960, 540);
    const v = video(540, 960);
    el.appendChild(v);
    const seen: string[] = [];
    const obs = observeVideoFit(el, (f) => seen.push(f), {
      MutationObserver: globalThis.MutationObserver,
    });
    expect(seen.at(-1)).toBe("contain");

    // Same element, new shape — no remount, so only `resize` tells us.
    Object.defineProperty(v, "videoWidth", { value: 960, configurable: true });
    Object.defineProperty(v, "videoHeight", { value: 540, configurable: true });
    v.dispatchEvent(new Event("resize"));

    expect(seen.at(-1)).toBe("cover");
    obs.stop();
  });

  it("stops listening when told to", async () => {
    const el = tile(960, 540);
    const onFit = vi.fn();
    const obs = observeVideoFit(el, onFit, { MutationObserver: globalThis.MutationObserver });
    obs.stop();
    onFit.mockClear();

    el.appendChild(video(540, 960));
    await flush();

    expect(onFit).not.toHaveBeenCalled();
  });
});
