import { describe, expect, it } from "vitest";
import { TAB_DEVICE_ID, otherDeviceOnCall } from "@/lib/deviceId";

describe("otherDeviceOnCall", () => {
  const me = "user-1";
  it("spots the same account on the call from another device", () => {
    expect(otherDeviceOnCall([{ user_id: me, is_in_call: true, device_id: "other-tab" }], me, "this-tab")).toBe(true);
  });
  it("ignores this device, other people, and my devices that aren't on the call", () => {
    expect(otherDeviceOnCall([{ user_id: me, is_in_call: true, device_id: "this-tab" }], me, "this-tab")).toBe(false);
    expect(otherDeviceOnCall([{ user_id: "user-2", is_in_call: true, device_id: "x" }], me, "this-tab")).toBe(false);
    expect(otherDeviceOnCall([{ user_id: me, is_in_call: false, device_id: "x" }], me, "this-tab")).toBe(false);
    expect(otherDeviceOnCall([], me, "this-tab")).toBe(false);
    expect(otherDeviceOnCall([{ user_id: me, is_in_call: true }], "", "this-tab")).toBe(false);
  });
  it("counts an older app without a device marker as another device", () => {
    expect(otherDeviceOnCall([{ sender_id: me, is_in_call: true }], me, "this-tab")).toBe(true);
  });
  it("gives each tab its own marker", () => {
    expect(TAB_DEVICE_ID).toMatch(/.{8,}/);
  });
});
