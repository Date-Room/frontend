import { describe, expect, it } from "vitest";
import { claimReport } from "./featureOpened";

describe("claimReport", () => {
  it("reports each feature once per room", () => {
    const seen = new Set<string>();
    expect(claimReport(seen, "r1", "watch")).toBe(true);
    expect(claimReport(seen, "r1", "watch")).toBe(false);
    expect(claimReport(seen, "r2", "watch")).toBe(true);
    expect(claimReport(seen, "r1", "the_36")).toBe(true);
  });
  it("ignores names the server would ignore", () => {
    const seen = new Set<string>();
    expect(claimReport(seen, "r1", "Not-A-Feature")).toBe(false);
    expect(claimReport(seen, "", "watch")).toBe(false);
  });
});
