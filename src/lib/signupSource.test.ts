import { describe, it, expect, beforeEach } from "vitest";
import { captureSignupSource, clearSignupSource, getSignupSource } from "@/lib/signupSource";

beforeEach(() => localStorage.clear());

describe("signupSource", () => {
  it("captures a clean token from ?src and ignores junk", () => {
    captureSignupSource("?src=Recap_Hook&next=%2Fx");
    expect(getSignupSource()).toBe("recap_hook");
    captureSignupSource("?src=<script>");
    expect(getSignupSource()).toBe("recap_hook"); // junk never overwrites
    captureSignupSource("?nothing=1");
    expect(getSignupSource()).toBe("recap_hook");
    clearSignupSource();
    expect(getSignupSource()).toBeNull();
  });
});
