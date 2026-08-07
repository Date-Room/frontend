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
