import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Keep the pure gate/catalog real; stub only the network functions.
vi.mock("@/lib/chaperon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chaperon")>();
  return {
    ...actual,
    createChaperonSession: vi.fn(),
    sendChaperonFeedback: vi.fn(),
    endChaperonSession: vi.fn(),
  };
});

import { createChaperonSession, endChaperonSession } from "@/lib/chaperon";
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

const START = {
  mode: "guardian" as const,
  checks: ["scam_script"],
  announcePresence: false,
  dataTier: "shadow" as const,
};

function health(over: Record<string, unknown> = {}) {
  return { type: "chaperon.health", session_id: "sess-1", healthy: true, ...over };
}

async function startedHook() {
  const hook = renderHook(() => useChaperon({ roomId: "room-1", enabled: true }));
  await act(async () => {
    await hook.result.current.start(START);
  });
  return hook;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(createChaperonSession).mockResolvedValue(SESSION);
  vi.mocked(endChaperonSession).mockResolvedValue(SESSION);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useChaperon (agent-only)", () => {
  it("opens the session as 'connecting', never faking 'watching' first", async () => {
    const { result } = await startedHook();
    expect(createChaperonSession).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("connecting");
    expect(result.current.agent.connected).toBe(false);
  });

  it("runs no browser speech recognition or client-side evaluate", async () => {
    const { result } = await startedHook();
    // The hook no longer exposes any browser-transcription surface.
    expect("wordsHeard" in result.current).toBe(false);
    expect("injectText" in result.current).toBe(false);
    expect("listening" in result.current).toBe(false);
  });

  it("a health heartbeat flips to 'watching' and records per-track hearing", async () => {
    const { result } = await startedHook();
    act(() => {
      result.current.ingestAgentMessage(
        health({
          you: { subscribed: true, receiving_audio: false, turns: 0, last_turn_sec_ago: null },
          them: { subscribed: true, receiving_audio: true, turns: 3, last_turn_sec_ago: 2 },
        }),
      );
    });
    expect(result.current.status).toBe("watching");
    expect(result.current.agent.connected).toBe(true);
    // The exact fault we hit: agent subscribed to you but hears no audio.
    expect(result.current.agent.you?.receivingAudio).toBe(false);
    expect(result.current.agent.them?.receivingAudio).toBe(true);
    expect(result.current.agent.them?.turns).toBe(3);
  });

  it("an unhealthy heartbeat shows 'degraded' and carries the last error", async () => {
    const { result } = await startedHook();
    act(() => {
      result.current.ingestAgentMessage(health({ healthy: false, last_error: "HTTP 529" }));
    });
    expect(result.current.status).toBe("degraded");
    expect(result.current.agent.lastError).toBe("HTTP 529");
  });

  it("goes back to 'connecting' if the agent goes silent (no fake green dot)", async () => {
    const { result } = await startedHook();
    act(() => result.current.ingestAgentMessage(health()));
    expect(result.current.status).toBe("watching");

    // No heartbeat for longer than the silence window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21_000);
    });
    expect(result.current.status).toBe("connecting");
    expect(result.current.agent.connected).toBe(false);
  });

  it("shows a whisper the agent delivers", async () => {
    const { result } = await startedHook();
    act(() => {
      result.current.ingestAgentMessage({
        type: "chaperon.whisper",
        check_id: "money_ask",
        severity: "alert",
        whisper: "This looks like a money ask.",
        event_id: "e1",
      });
    });
    expect(result.current.currentWhisper?.whisper).toBe("This looks like a money ask.");
    expect(result.current.whisperLog).toHaveLength(1);
  });

  it("ignores agent messages once stopped, and ends the session", async () => {
    const { result } = await startedHook();
    await act(async () => {
      await result.current.stop();
    });
    expect(endChaperonSession).toHaveBeenCalledWith("sess-1");
    expect(result.current.status).toBe("off");

    act(() => result.current.ingestAgentMessage(health()));
    expect(result.current.status).toBe("off"); // no resurrection after stop
  });
});
