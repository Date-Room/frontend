import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Drive the controller directly so we control `enabled` timing.
let mockCtrl: Record<string, unknown> | null = null;
vi.mock("@/context/ChaperonContext", () => ({
  useChaperonController: () => mockCtrl,
}));

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

    mockCtrl = ctrl(true);
    rerender(wrap());

    const shield = document.querySelector('[aria-label="Chaperon"]');
    expect(shield).not.toBeNull();
    expect(document.contains(shield)).toBe(true); // in the live DOM, not detached
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

  it("starts with the status card expanded (beta default)", () => {
    mockCtrl = activeCtrl(0);
    render(wrap());
    expect(document.querySelector('[aria-label="Collapse chaperon status"]')).not.toBeNull();
  });

  // Regression: the expanded status card used to float OVER the whisper rail
  // with no way to move it, hiding the coach's words. It must collapse to the
  // slim chip the moment a new whisper arrives.
  it("auto-collapses the status card when a whisper lands", () => {
    mockCtrl = activeCtrl(0);
    const { rerender } = render(wrap());
    expect(document.querySelector('[aria-label="Collapse chaperon status"]')).not.toBeNull();

    mockCtrl = activeCtrl(1);
    rerender(wrap());

    expect(document.querySelector('[aria-label="Collapse chaperon status"]')).toBeNull();
    expect(document.querySelector('[aria-label="Expand chaperon status"]')).not.toBeNull();
  });

  it("keeps the whole cluster in one flow column so the card cannot overlap the rail", () => {
    mockCtrl = activeCtrl(2);
    render(wrap());
    const shield = document.querySelector('[aria-label="Chaperon"]') as HTMLElement;
    const column = shield.parentElement as HTMLElement;
    // The pill, the status chip/card, and (when open) the rail are siblings in
    // one flex column — normal flow, so overlap is structurally impossible.
    expect(column.className).toContain("flex-col");
    expect(column.contains(document.querySelector('[aria-label="Collapse chaperon status"]'))).toBe(
      true,
    );
  });
});
