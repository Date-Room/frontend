/**
 * Billing client — Stripe-backed subscription surface on the web.
 *
 * Two endpoints:
 *  - GET  /v1/billing/subscription   — current entitlement + flag.
 *  - POST /v1/billing/checkout-session → Stripe Checkout URL the
 *    client navigates the browser to.
 *
 * Server-side webhook does the post-checkout state mutation; the
 * client polls /subscription on the success bounce to confirm.
 */
import { api } from "@/lib/api";

export type SubscriptionSnapshot = {
  id: string;
  platform: "ios" | "android" | "stripe";
  status: "active" | "grace" | "cancelled" | "expired";
  product_id: string;
  current_period_start: string;
  current_period_end: string;
};

export type SubscriptionStatus = {
  /** Server-side feature flag. When false the client skips paywall
   *  UI entirely — everything is treated as entitled. */
  paywall_enabled: boolean;
  /** Whether the user can use premium features right now. Honours
   *  the flag (always true when paywall is off). */
  entitled: boolean;
  subscription: SubscriptionSnapshot | null;
};

export function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return api.get<SubscriptionStatus>("/v1/billing/subscription");
}

/** Mint a Stripe Checkout URL — caller navigates the browser to it. */
export function createCheckoutSession(): Promise<{ url: string }> {
  return api.post<{ url: string }>("/v1/billing/checkout-session");
}
