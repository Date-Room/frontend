import { describe, expect, it } from "vitest";
import { mergeMessages, normalizeIncoming, readMessages, MAX_KEEP } from "./chatMessages";
import type { ActivityEvent } from "./activitySession";

const ev = (payload: Record<string, unknown>, userId = "u2", timestamp = "2026-09-17T10:00:00Z"): ActivityEvent => ({
  activityId: "chat",
  type: "send",
  payload,
  userId,
  timestamp,
  sequenceNumber: 1,
});

describe("normalizeIncoming", () => {
  it("rebuilds a message from mobile's minimal {id, text} plus the envelope", () => {
    expect(normalizeIncoming(ev({ id: "m1", text: "hi" }))).toEqual({
      id: "m1",
      text: "hi",
      from_user_id: "u2",
      sent_at: "2026-09-17T10:00:00Z",
    });
  });
  it("prefers payload-embedded sender/time from older web builds", () => {
    const m = normalizeIncoming(ev({ id: "m1", text: "hi", from_user_id: "u9", sent_at: "2020-01-01T00:00:00Z" }));
    expect(m?.from_user_id).toBe("u9");
    expect(m?.sent_at).toBe("2020-01-01T00:00:00Z");
  });
  it("drops rather than crashes on a malformed payload", () => {
    expect(normalizeIncoming(ev({ text: "no id" }))).toBeNull();
    expect(normalizeIncoming(ev({ id: "x" }))).toBeNull();
  });
});

describe("mergeMessages", () => {
  const a = { id: "1", from_user_id: "u1", text: "a", sent_at: "2026-09-17T10:00:01Z" };
  const b = { id: "2", from_user_id: "u2", text: "b", sent_at: "2026-09-17T10:00:00Z" };
  it("unions by id and orders by time", () => {
    expect(mergeMessages([a], [b, a]).map((m) => m.id)).toEqual(["2", "1"]);
  });
  it("tolerates a missing sent_at", () => {
    expect(() => mergeMessages([{ ...a, sent_at: "" }], [b])).not.toThrow();
  });
  it("caps the kept history", () => {
    const many = Array.from({ length: MAX_KEEP + 20 }, (_, i) => ({
      id: String(i),
      from_user_id: "u1",
      text: "x",
      sent_at: new Date(1700000000000 + i * 1000).toISOString(),
    }));
    expect(mergeMessages([], many)).toHaveLength(MAX_KEEP);
  });
});

describe("readMessages", () => {
  it("validates each row and skips bad ones", () => {
    const out = readMessages({ messages: [{ id: "1", text: "ok" }, { id: 2 }, null, { text: "no id" }] });
    expect(out.map((m) => m.id)).toEqual(["1"]);
  });
  it("returns empty for a missing or non-array field", () => {
    expect(readMessages(null)).toEqual([]);
    expect(readMessages({ messages: "nope" })).toEqual([]);
  });
});
