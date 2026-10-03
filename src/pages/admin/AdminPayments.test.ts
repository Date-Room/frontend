import { describe, expect, it } from "vitest";
import { stuckLabel } from "./AdminPayments";

describe("stuckLabel", () => {
  it("names why an order is stuck", () => {
    expect(stuckLabel({ status: "unconfirmed", result_description: null })).toBe("No answer in 72h");
    expect(stuckLabel({ status: "failed", result_description: "Expired without provider confirmation." })).toBe(
      "Failed by the old 1-hour cut-off",
    );
    expect(stuckLabel({ status: "pending", result_description: null })).toBe("Waiting on M-Pesa");
  });
});
