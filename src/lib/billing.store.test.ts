import { describe, it, expect } from "vitest";
import {
  checkoutBlockedMessage,
  isCheckoutReady,
  isStoreCheckout,
  paymentRailLabel,
  STORE_ONLY_MESSAGE,
  type BillingConfig,
} from "@/lib/billing";

function config(overrides: Partial<BillingConfig> = {}): BillingConfig {
  return {
    paywall_enabled: true,
    payment_provider: "stripe",
    country_code: "US",
    stripe_configured: true,
    mpesa_configured: false,
    dev_checkout_enabled: false,
    account_tier: "try",
    account_tier_label: "Try",
    products: [],
    ...overrides,
  };
}

describe("store payment provider", () => {
  it("labels the store rail as the app, not Stripe", () => {
    expect(paymentRailLabel("store")).toBe("the DateRoom app");
    expect(paymentRailLabel("stripe")).toBe("Stripe");
    expect(paymentRailLabel("mpesa")).toBe("M-Pesa");
  });

  it("store is not web-checkout-ready", () => {
    expect(isCheckoutReady(config({ payment_provider: "store" }))).toBe(false);
    expect(isCheckoutReady(config({ payment_provider: "stripe" }))).toBe(true);
  });

  it("blocks store checkout with the app message", () => {
    expect(checkoutBlockedMessage(config({ payment_provider: "store" }))).toBe(
      STORE_ONLY_MESSAGE,
    );
    expect(checkoutBlockedMessage(config())).toBeNull();
  });

  it("isStoreCheckout respects the dev-checkout override", () => {
    expect(isStoreCheckout({ payment_provider: "store" })).toBe(true);
    expect(
      isStoreCheckout({ payment_provider: "store", dev_checkout_enabled: true }),
    ).toBe(false);
    expect(isStoreCheckout({ payment_provider: "stripe" })).toBe(false);
  });
});
