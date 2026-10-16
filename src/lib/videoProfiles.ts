import { VideoPresets, type RoomOptions } from "livekit-client";

// Squad nights: up to six people each receiving everyone (decided
// 2026-10-08, priced in the squad cost model).
// - Laptops capture at 540p with 180p and 360p layers, so a big tile is
//   sharp; phones capture at 360p with a 180p layer, capped lower, to stay
//   cool and spare their data.
// - Everyone pulls each face at the size it is drawn, never doubled for a
//   sharp screen (pixelDensity 1): small tiles get the small layer, so a
//   bigger call costs about the same per seat as a small one.
export function groupRoomOptions(phone: boolean): RoomOptions {
  return {
    adaptiveStream: { pixelDensity: 1 },
    dynacast: true,
    videoCaptureDefaults: {
      resolution: (phone ? VideoPresets.h360 : VideoPresets.h540).resolution,
    },
    publishDefaults: {
      simulcast: true,
      videoSimulcastLayers: phone ? [VideoPresets.h180] : [VideoPresets.h180, VideoPresets.h360],
      // A phone's top layer at 300 kbps instead of 450: less upload data.
      ...(phone ? { videoEncoding: { maxBitrate: 300_000, maxFramerate: 20 } } : {}),
    },
  };
}
