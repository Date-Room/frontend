import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Keep the pure gate/catalog real; stub only the network functions.
vi.mock("@/lib/chaperon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chaperon")>();
  return {
    ...actual,
    createChaperonSession: vi.fn(),
    evaluateChaperon: vi.fn(),
    sendChaperonFeedback: vi.fn(),
    endChaperonSession: vi.fn(),
  };
});

import {
  createChaperonSession,
  evaluateChaperon,
  sendChaperonFeedback,
  type ChaperonEvaluateResponse,
} from "@/lib/chaperon";
import { useChaperon } from "@/hooks/useChaperon";

const SESSION = {
  id: "sess-1",
  room_id: "room-1",
  mode: "guardian" as const,
  checks: ["scam_script"],
  announce_presence: false,
  data_tier: "shadow" as const,
  started_at: "",
  ended_at: null,
};

function evalResponse(over: Partial<ChaperonEvaluateResponse> = {}): ChaperonEvaluateResponse {
  return { signals: [], next_eval_ms: 5_000, healthy: true, ...over };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(createChaperonSession).mockResolvedValue(SESSION);
  vi.mocked(evaluateChaperon).mockResolvedValue(evalResponse());
  vi.mocked(sendChaperonFeedback).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useChaperon", () => {
  it("evaluates on the server-driven cadence (next_eval_ms)", async () => {
    const { result } = renderHook(() =>
      useChaperon({ roomId: "room-1", enabled: true }),
    );

    await act(async () => {
      await result.current.start({
        mode: "guardian",
        checks: ["scam_script"],
        announcePresence: false,
        dataTier: "shadow",
      });
    });
    expect(createChaperonSession).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("watching");

    // First tick fires ~1s after start.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(evaluateChaperon).toHaveBeenCalledTimes(1);

    // Server said 5000ms — a 4s advance should NOT trigger another tick...
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(evaluateChaperon).toHaveBeenCalledTimes(1);
    // ...but crossing 5000ms does.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(evaluateChaperon).toHaveBeenCalledTimes(2);
  });

  it("surfaces a whisper and posts feedback for it", async () => {
    vi.mocked(evaluateChaperon).mockResolvedValue(
      evalResponse({
        signals: [
          { event_id: "evt-9", check_id: "money_ask", severity: "alert", whisper: "money ask", confidence: 0.6 },
        ],
      }),
    );

    const { result } = renderHook(() =>
      useChaperon({ roomId: "room-1", enabled: true }),
    );
    await act(async () => {
      await result.current.start({
        mode: "guardian",
        checks: ["money_ask"],
        announcePresence: false,
        dataTier: "shadow",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(result.current.currentWhisper?.check_id).toBe("money_ask");

    act(() => result.current.sendFeedback(true));
    expect(sendChaperonFeedback).toHaveBeenCalledWith("sess-1", {
      event_id: "evt-9",
      helpful: true,
    });
  });

  it("goes degraded after two consecutive failures", async () => {
    vi.mocked(evaluateChaperon).mockRejectedValue(new Error("down"));
    const { result } = renderHook(() =>
      useChaperon({ roomId: "room-1", enabled: true }),
    );
    await act(async () => {
      await result.current.start({
        mode: "guardian",
        checks: ["scam_script"],
        announcePresence: false,
        dataTier: "shadow",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000); // failure 1
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000); // conservative retry → failure 2
    });
    expect(result.current.status).toBe("degraded");
  });

  it("logs whispers newest-first, bumps unread, and clears it on markRailSeen", async () => {
    vi.mocked(evaluateChaperon).mockResolvedValue(
      evalResponse({
        signals: [
          { event_id: "evt-1", check_id: "money_ask", severity: "alert", whisper: "first", confidence: 0.6 },
        ],
      }),
    );
    const { result } = renderHook(() => useChaperon({ roomId: "room-1", enabled: true }));
    await act(async () => {
      await result.current.start({
        mode: "guardian",
        checks: ["money_ask"],
        announcePresence: false,
        dataTier: "shadow",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(result.current.whisperLog).toHaveLength(1);
    expect(result.current.whisperLog[0].signal.whisper).toBe("first");
    expect(result.current.unreadCount).toBe(1);

    act(() => result.current.markRailSeen());
    expect(result.current.unreadCount).toBe(0);
  });

  it("keeps alerts on screen but auto-hides coaching after the display window", async () => {
    // An alert stays until dismissed.
    vi.mocked(evaluateChaperon).mockResolvedValue(
      evalResponse({
        signals: [
          { event_id: "a", check_id: "money_ask", severity: "alert", whisper: "alert", confidence: 0.7 },
        ],
        next_eval_ms: 999_999,
      }),
    );
    const { result } = renderHook(() => useChaperon({ roomId: "room-1", enabled: true }));
    await act(async () => {
      await result.current.start({
        mode: "guardian",
        checks: ["money_ask"],
        announcePresence: false,
        dataTier: "shadow",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.currentWhisper?.whisper).toBe("alert");
    // Well past the 10s coach window — the alert must still be visible.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(result.current.currentWhisper?.whisper).toBe("alert");
  });

  it("auto-hides a coaching whisper after the display window", async () => {
    vi.mocked(evaluateChaperon).mockResolvedValue(
      evalResponse({
        signals: [
          { event_id: "c", check_id: "warmth", severity: "note", whisper: "nice", confidence: 0.5 },
        ],
        next_eval_ms: 999_999,
      }),
    );
    const { result } = renderHook(() => useChaperon({ roomId: "room-1", enabled: true }));
    await act(async () => {
      await result.current.start({
        mode: "wingman",
        checks: ["warmth"],
        announcePresence: false,
        dataTier: "shadow",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.currentWhisper?.whisper).toBe("nice");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000);
    });
    expect(result.current.currentWhisper).toBeNull();
    // Still in the log for the rail even though the toast is gone.
    expect(result.current.whisperLog).toHaveLength(1);
  });

  it("rates a specific past whisper by event_id", async () => {
    vi.mocked(evaluateChaperon).mockResolvedValue(
      evalResponse({
        signals: [
          { event_id: "evt-42", check_id: "money_ask", severity: "alert", whisper: "x", confidence: 0.6 },
        ],
      }),
    );
    const { result } = renderHook(() => useChaperon({ roomId: "room-1", enabled: true }));
    await act(async () => {
      await result.current.start({
        mode: "guardian",
        checks: ["money_ask"],
        announcePresence: false,
        dataTier: "shadow",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    act(() => result.current.sendFeedback(false, "evt-42"));
    expect(sendChaperonFeedback).toHaveBeenCalledWith("sess-1", {
      event_id: "evt-42",
      helpful: false,
    });
  });

  it("does nothing when disabled", async () => {
    const { result } = renderHook(() =>
      useChaperon({ roomId: "room-1", enabled: false }),
    );
    await act(async () => {
      await result.current.start({
        mode: "guardian",
        checks: [],
        announcePresence: false,
        dataTier: "shadow",
      });
    });
    expect(createChaperonSession).not.toHaveBeenCalled();
    expect(result.current.status).toBe("off");
  });
});
