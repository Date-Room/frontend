import { afterEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn(async () => ({ muted: ["microphone"] })));
vi.mock("@/lib/api", async (orig) => {
  const mod = await orig<typeof import("@/lib/api")>();
  return { ...mod, api: { ...mod.api, post } };
});

import { muteParticipant, mutedNotice } from "@/lib/rooms";

afterEach(() => post.mockClear());

describe("mutedNotice", () => {
  const me = "user-1";
  it("tells the muted person who did it and how to undo it", () => {
    expect(mutedNotice({ identity: me, by: "Joshua", muted: ["microphone"] }, me)).toBe(
      "Joshua muted your microphone. Tap the mic to talk again.",
    );
    expect(mutedNotice({ identity: me, by: "Joshua", muted: ["camera"] }, me)).toMatch(/turned off your camera/);
    expect(mutedNotice({ identity: me, muted: ["microphone", "camera"] }, me)).toMatch(/^Someone muted your microphone and turned off/);
  });
  it("stays quiet for everyone else, and when nothing was muted", () => {
    expect(mutedNotice({ identity: "user-2", by: "Joshua", muted: ["microphone"] }, me)).toBeNull();
    expect(mutedNotice({ identity: me, by: "Joshua", muted: [] }, me)).toBeNull();
    expect(mutedNotice({ identity: me, muted: ["microphone"] }, "")).toBeNull();
  });
});

describe("muteParticipant", () => {
  it("asks the server to mute the other person's mic", async () => {
    await muteParticipant("room-1", "p-2", { microphone: true });
    expect(post).toHaveBeenCalledWith("/v1/rooms/room-1/participants/p-2/mute", {
      microphone: true,
      camera: false,
      participant_id: null,
    });
  });
});
