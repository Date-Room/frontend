import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const statuses: Record<string, string> = {};
const post = vi.fn();

vi.mock("@/lib/billing", () => ({
  getMpesaTransactionStatus: vi.fn(async (id: string) => ({
    transaction_id: id,
    status: statuses[id] ?? "pending",
    product_kind: "squad_night",
    result_description: statuses[id] === "failed" ? "Payment cancelled by user." : null,
  })),
}));
vi.mock("@/lib/api", () => ({ api: { post: (...a: unknown[]) => post(...a) } }));

import {
  RESEND_AFTER_MS,
  SLOW_AFTER_MS,
  canResend,
  checkNow,
  closePanel,
  flowPhase,
  getFlow,
  isMpesaStillConfirming,
  resendPrompt,
  runMpesaPayment,
  setOnLateConfirm,
} from "./mpesaFlow";

describe("pure rules", () => {
  it("moves from waiting to slow after two minutes, keeps terminal phases", () => {
    expect(flowPhase({ phase: "waiting", lastPushAt: 0 }, SLOW_AFTER_MS - 1)).toBe("waiting");
    expect(flowPhase({ phase: "waiting", lastPushAt: 0 }, SLOW_AFTER_MS)).toBe("slow");
    expect(flowPhase({ phase: "failed", lastPushAt: 0 }, 1)).toBe("failed");
    expect(flowPhase({ phase: "done", lastPushAt: 0 }, SLOW_AFTER_MS * 2)).toBe("done");
  });

  it("allows a resend only after the prompt window, at once after a failure, never when done", () => {
    const base = { lastPushAt: 0, resending: false };
    expect(canResend({ ...base, phase: "waiting" }, RESEND_AFTER_MS - 1)).toBe(false);
    expect(canResend({ ...base, phase: "waiting" }, RESEND_AFTER_MS)).toBe(true);
    expect(canResend({ ...base, phase: "failed" }, 1)).toBe(true);
    expect(canResend({ ...base, phase: "done" }, RESEND_AFTER_MS)).toBe(false);
    expect(canResend({ ...base, phase: "waiting", resending: true }, RESEND_AFTER_MS)).toBe(false);
  });
});

describe("runMpesaPayment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const k of Object.keys(statuses)) delete statuses[k];
    post.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when M-Pesa confirms", async () => {
    const paying = runMpesaPayment({ label: "Squad Night", start: async () => ({ transaction_id: "t1" }) });
    await vi.advanceTimersByTimeAsync(3_000);
    statuses.t1 = "completed";
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(paying).resolves.toMatchObject({ transaction_id: "t1", status: "completed" });
    expect(getFlow()?.phase).toBe("done");
  });

  it("a resent prompt's payment settles it, and the older one still counts", async () => {
    let n = 0;
    const start = vi.fn(async () => ({ transaction_id: `r${++n}` }));
    const paying = runMpesaPayment({ label: "Squad Night", start });
    await vi.advanceTimersByTimeAsync(RESEND_AFTER_MS);
    await resendPrompt();
    expect(start).toHaveBeenCalledTimes(2);
    expect(getFlow()?.attempts).toEqual(["r1", "r2"]);
    statuses.r1 = "completed"; // the first prompt was paid after all
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(paying).resolves.toMatchObject({ transaction_id: "r1" });
  });

  it("shows the failure of the latest prompt and offers to try again", async () => {
    const paying = runMpesaPayment({ label: "extra time", start: async () => ({ transaction_id: "f1" }) });
    statuses.f1 = "failed";
    await vi.advanceTimersByTimeAsync(3_000);
    expect(getFlow()?.phase).toBe("failed");
    expect(getFlow()?.failure).toBe("Payment cancelled by user.");
    closePanel();
    await expect(paying).rejects.toThrow("Payment cancelled by user.");
  });

  it("closing early is not a failure, and a late confirmation still lands", async () => {
    const late = vi.fn();
    setOnLateConfirm(late);
    const paying = runMpesaPayment({ label: "Date Pack", start: async () => ({ transaction_id: "l1" }) });
    await vi.advanceTimersByTimeAsync(3_000);
    closePanel();
    const err = await paying.catch((e) => e);
    expect(isMpesaStillConfirming(err)).toBe(true);
    statuses.l1 = "completed";
    await vi.advanceTimersByTimeAsync(3_000);
    expect(late).toHaveBeenCalledWith("Date Pack");
  });

  it("'I've paid, check now' asks the server to re-check and settles on a yes", async () => {
    post.mockResolvedValue({ transaction_id: "c1", status: "completed", product_kind: "date_pack" });
    const paying = runMpesaPayment({ label: "Date Pack", start: async () => ({ transaction_id: "c1" }) });
    await vi.advanceTimersByTimeAsync(0); // the prompt has been sent
    await checkNow();
    expect(post).toHaveBeenCalledWith("/v1/billing/mpesa/transactions/c1/recheck");
    await expect(paying).resolves.toMatchObject({ status: "completed" });
  });
});
