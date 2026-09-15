import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomChannel } from "./roomChannel";

/**
 * A scriptable WebSocket: the test drives open/message/close by hand and
 * records everything the channel sends, so we can prove the reconnect
 * contract that activity re-sync relies on.
 */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
  }
  // ── test controls ──
  serverOpen() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  serverReady() {
    this.onmessage?.({ data: JSON.stringify({ type: "ready", self: "me", presence: {} }) });
  }
  serverDrop(code = 1006) {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code });
  }
  sentTypes(): string[] {
    return this.sent.map((s) => {
      const m = JSON.parse(s) as { type: string; event?: string };
      return m.type === "broadcast" ? `broadcast:${m.event}` : m.type;
    });
  }
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RoomChannel reconnect contract", () => {
  it("reports status transitions, and fires onReconnect only for a RE-connect", async () => {
    const ch = new RoomChannel("room-1");
    const statuses: string[] = [];
    ch.onStatus((s) => statuses.push(s));
    let reconnects = 0;
    ch.onReconnect(() => reconnects++);

    const open = ch.open();
    const s1 = FakeSocket.instances[0];
    s1.serverOpen();
    s1.serverReady();
    await open;
    expect(statuses).toEqual(["connecting", "open", "subscribed"]);
    expect(reconnects).toBe(0); // the first ready is not a reconnect

    s1.serverDrop();
    expect(ch.status).toBe("closed:1006");
    vi.advanceTimersByTime(600); // past the 500ms backoff
    const s2 = FakeSocket.instances[1];
    expect(s2).toBeDefined();
    s2.serverOpen();
    s2.serverReady();
    expect(ch.status).toBe("subscribed");
    expect(reconnects).toBe(1);
    ch.dispose();
  });

  it("flushes moves queued during the drop BEFORE reconnect listeners run", async () => {
    // The re-sync request must be ordered after the queued moves, so the
    // peer's snapshot already includes them.
    const ch = new RoomChannel("room-1");
    const order: string[] = [];
    const open = ch.open();
    const s1 = FakeSocket.instances[0];
    s1.serverOpen();
    s1.serverReady();
    await open;

    s1.serverDrop();
    // Player keeps tapping while the socket is down.
    void ch.broadcast("activity", { type: "lock" });
    void ch.broadcast("activity", { type: "cut" });

    ch.onReconnect(() => {
      order.push("reconnect-listener");
      void ch.broadcast("activity", { type: "__resync" });
    });

    vi.advanceTimersByTime(600);
    const s2 = FakeSocket.instances[1];
    s2.serverOpen();
    s2.serverReady();

    const broadcasts = s2
      .sent.map((raw) => JSON.parse(raw) as { type: string; payload?: { type?: string } })
      .filter((m) => m.type === "broadcast")
      .map((m) => m.payload?.type);
    expect(broadcasts).toEqual(["lock", "cut", "__resync"]);
    expect(order).toEqual(["reconnect-listener"]);
    ch.dispose();
  });

  it("does not retry on a bad-token close, and stops reporting after dispose", async () => {
    const ch = new RoomChannel("room-1");
    const statuses: string[] = [];
    ch.onStatus((s) => statuses.push(s));
    const open = ch.open();
    const s1 = FakeSocket.instances[0];
    s1.serverDrop(4401);
    await expect(open).rejects.toThrow();
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.instances).toHaveLength(1); // no reconnect attempt
    ch.dispose();
    expect(statuses[statuses.length - 1]).toBe("closed:4401");
  });
});
