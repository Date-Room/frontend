import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  deviceLabel,
  groupDevices,
  loadDevicePreference,
  pickDevice,
  resolveDevice,
  saveDevicePreference,
  speakerSelectionSupported,
} from "@/lib/devices";

function dev(deviceId: string, kind: MediaDeviceKind, label = ""): MediaDeviceInfo {
  return { deviceId, kind, label, groupId: "g", toJSON: () => ({}) } as MediaDeviceInfo;
}

beforeEach(() => {
  localStorage.clear();
});

describe("groupDevices", () => {
  it("buckets by kind and ignores unknown kinds", () => {
    const g = groupDevices([
      dev("a", "audioinput"),
      dev("v", "videoinput"),
      dev("s", "audiooutput"),
      dev("a2", "audioinput"),
    ]);
    expect(g.audioinput.map((d) => d.deviceId)).toEqual(["a", "a2"]);
    expect(g.videoinput.map((d) => d.deviceId)).toEqual(["v"]);
    expect(g.audiooutput.map((d) => d.deviceId)).toEqual(["s"]);
  });
});

describe("pickDevice / resolveDevice fallback", () => {
  const available = [dev("mic-a", "audioinput"), dev("mic-b", "audioinput")];

  it("returns the saved device when still present", () => {
    expect(pickDevice("mic-b", available)).toBe("mic-b");
  });

  it("returns undefined when the saved device is unplugged", () => {
    expect(pickDevice("mic-gone", available)).toBeUndefined();
  });

  it("returns undefined when nothing is saved", () => {
    expect(pickDevice(undefined, available)).toBeUndefined();
  });

  it("resolveDevice reads the saved preference and applies the fallback", () => {
    saveDevicePreference("audioinput", "mic-a");
    expect(resolveDevice("audioinput", available)).toBe("mic-a");
    saveDevicePreference("audioinput", "mic-unplugged");
    expect(resolveDevice("audioinput", available)).toBeUndefined();
  });
});

describe("saveDevicePreference", () => {
  it("persists a real device and clears on default/null", () => {
    saveDevicePreference("videoinput", "cam-1");
    expect(loadDevicePreference("videoinput")).toBe("cam-1");
    saveDevicePreference("videoinput", "default");
    expect(loadDevicePreference("videoinput")).toBeUndefined();
    saveDevicePreference("videoinput", "cam-1");
    saveDevicePreference("videoinput", null);
    expect(loadDevicePreference("videoinput")).toBeUndefined();
  });
});

describe("deviceLabel", () => {
  it("uses the label when present", () => {
    expect(deviceLabel(dev("x", "audioinput", "AirPods"), 0, "audioinput")).toBe("AirPods");
  });
  it("falls back to a numbered noun when the label is empty", () => {
    expect(deviceLabel(dev("x", "audioinput"), 1, "audioinput")).toBe("Microphone 2");
    expect(deviceLabel(undefined, 0, "videoinput")).toBe("Camera 1");
    expect(deviceLabel(undefined, 2, "audiooutput")).toBe("Speaker 3");
  });
});

describe("speakerSelectionSupported", () => {
  it("reflects setSinkId presence on HTMLMediaElement", () => {
    const had = "setSinkId" in HTMLMediaElement.prototype;
    // @ts-expect-error test shim
    HTMLMediaElement.prototype.setSinkId = () => Promise.resolve();
    expect(speakerSelectionSupported()).toBe(true);
    if (!had) {
      // @ts-expect-error cleanup
      delete HTMLMediaElement.prototype.setSinkId;
      expect(speakerSelectionSupported()).toBe(false);
    }
    vi.restoreAllMocks();
  });
});
