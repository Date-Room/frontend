import { describe, expect, it } from "vitest";
import { VideoPresets } from "livekit-client";
import { groupRoomOptions } from "@/lib/videoProfiles";

describe("groupRoomOptions", () => {
  it("captures laptops at 540p with two smaller layers", () => {
    const o = groupRoomOptions(false);
    expect(o.videoCaptureDefaults?.resolution).toEqual(VideoPresets.h540.resolution);
    expect(o.publishDefaults?.videoSimulcastLayers).toEqual([VideoPresets.h180, VideoPresets.h360]);
    expect(o.publishDefaults?.videoEncoding).toBeUndefined();
  });
  it("keeps phones at 360p, one small layer, and a lower top bitrate", () => {
    const o = groupRoomOptions(true);
    expect(o.videoCaptureDefaults?.resolution).toEqual(VideoPresets.h360.resolution);
    expect(o.publishDefaults?.videoSimulcastLayers).toEqual([VideoPresets.h180]);
    expect(o.publishDefaults?.videoEncoding?.maxBitrate).toBe(300_000);
  });
  it("never pulls faces at double size for a sharp screen", () => {
    for (const phone of [true, false]) {
      expect(groupRoomOptions(phone).adaptiveStream).toEqual({ pixelDensity: 1 });
    }
  });
});
