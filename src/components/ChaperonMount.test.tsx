import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Drive the controller directly so we control `enabled` timing.
let mockCtrl: Record<string, unknown> | null = null;
vi.mock("@/context/ChaperonContext", () => ({
  useChaperonController: () => mockCtrl,
}));
vi.mock("@/context/RoomSessionContext", () => ({
  useRoomSession: () => ({ roomId: "room-test", senderId: "u1", presence: [], channel: {} }),
}));
vi.mock("@/lib/stagecraft/usePartnerName", () => ({ usePartnerName: () => "Them" }));

import { ChaperonMount } from "@/components/ChaperonMount";

function ctrl(enabled: boolean) {
  return {
    enabled,
    status: "off",
    agent: { connected: false, judgeOk: false, you: null, them: null, lastError: null },
    currentWhisper: null,
    active: false,
    whisperLog: [],
    unreadCount: 0,
    unread: { protect: 0, coach: 0 },
    session: null,
    probe: "idle",
    startProbe: () => {},
    cancelProbe: () => {},
    markRailSeen: () => {},
    dismiss: () => {},
    sendFeedback: () => {},
    start: () => {},
    stop: () => {},
    ingestAgentMessage: () => {},
  };
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = () => (
  <QueryClientProvider client={qc}>
    <ChaperonMount />
  </QueryClientProvider>
);

afterEach(() => cleanup());

describe("ChaperonMount portal attachment", () => {
  it("renders nothing while the chaperon is disabled", () => {
    mockCtrl = ctrl(false);
    render(wrap());
    expect(document.querySelector('[aria-label="Chaperon"]')).toBeNull();
  });

  // Regression: `chaperon_enabled` arrives from an async fetch, so the component
  // mounts disabled and only later flips enabled. The portal host must attach to
  // the live document on that flip — not stay in a detached node (the bug that
  // made the whole chaperon surface invisible in-call).
  it("attaches the shield to the document when enabled flips true after mount", () => {
    mockCtrl = ctrl(false);
    const { rerender } = render(wrap());
    expect(document.querySelector('[aria-label="Chaperon"]')).toBeNull();

    mockCtrl = { ...ctrl(true), active: true, status: "watching" };
    rerender(wrap());

    // Chip (healthy) or dots (agent not yet connected): either way, the surface
    // is in the live document.
    const shield = document.querySelector('[aria-label^="Chaperon"]');
    expect(shield).not.toBeNull();
    expect(document.contains(shield)).toBe(true); // in the live DOM, not detached
  });

  // Off means nothing in the call area: the way in is the lobby card, the
  // dock tile, or the pre-room sheet, never a grey pill on every date.
  it("shows no shield while enabled but off", () => {
    mockCtrl = ctrl(true);
    render(wrap());
    expect(document.querySelector('[aria-label="Chaperon"]')).toBeNull();
  });
});

describe("status panel vs whisper priority", () => {
  function activeCtrl(whispers: number) {
    const log = Array.from({ length: whispers }, (_, i) => ({
      id: `w${i}`,
      signal: {
        event_id: `e${i}`,
        check_id: "chemistry",
        severity: "note" as const,
        whisper: `whisper ${i}`,
        confidence: 0.5,
      },
      at: Date.now(),
      elapsedSec: i * 10,
    }));
    return {
      ...ctrl(true),
      active: true,
      status: "watching",
      agent: { connected: true, judgeOk: true, you: null, them: null, lastError: null },
      whisperLog: log,
    };
  }

  const OK = { subscribed: true, receivingAudio: true, turns: 1, lastTurnSecAgo: 1 };

  // Quiet when healthy: no status card, no dots, just the icon chip.
  it("shows only the icon chip while every stage is healthy", () => {
    mockCtrl = { ...activeCtrl(0), agent: { connected: true, judgeOk: true, you: OK, them: OK, lastError: null } };
    render(wrap());
    expect(document.querySelector('[role="group"][aria-label="Chaperon"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Collapse chaperon status"]')).toBeNull();
    expect(document.querySelector('[aria-label="not working"]')).toBeNull();
  });

  // Specific when not: the chip becomes the four dots with the reason, and a
  // tap opens the panel with the sentence and the rows.
  it("becomes the dots when a stage fails and opens the panel on tap", () => {
    const silent = { subscribed: true, receivingAudio: false, turns: 0, lastTurnSecAgo: null };
    mockCtrl = { ...activeCtrl(0), agent: { connected: true, judgeOk: true, you: OK, them: silent, lastError: null } };
    render(wrap());
    const chip = document.querySelector('[aria-label^="Chaperon: Not hearing"]') as HTMLElement;
    expect(chip).not.toBeNull();
    fireEvent.click(chip);
    expect(document.querySelector('[aria-label="Collapse chaperon status"]')).not.toBeNull();
  });

  // Regression: the expanded status card used to float OVER the whisper rail
  // with no way to move it, hiding the coach's words. It must leave the moment
  // a new whisper arrives.
  it("auto-collapses the status panel when a whisper lands", () => {
    const silent = { subscribed: true, receivingAudio: false, turns: 0, lastTurnSecAgo: null };
    const agent = { connected: true, judgeOk: true, you: OK, them: silent, lastError: null };
    mockCtrl = { ...activeCtrl(0), agent };
    const { rerender } = render(wrap());
    fireEvent.click(document.querySelector('[aria-label^="Chaperon: Not hearing"]') as HTMLElement);
    expect(document.querySelector('[aria-label="Collapse chaperon status"]')).not.toBeNull();

    mockCtrl = { ...activeCtrl(1), agent };
    rerender(wrap());
    expect(document.querySelector('[aria-label="Collapse chaperon status"]')).toBeNull();
  });

  it("keeps the whole cluster in one flow column so nothing can overlap the rail", () => {
    mockCtrl = { ...activeCtrl(2), agent: { connected: true, judgeOk: true, you: OK, them: OK, lastError: null } };
    render(wrap());
    const chip = document.querySelector('[role="group"][aria-label="Chaperon"]') as HTMLElement;
    const column = chip.parentElement as HTMLElement;
    expect(column.className).toContain("flex-col");
  });
});
