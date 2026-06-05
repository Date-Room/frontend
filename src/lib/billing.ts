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

/** Full entitlement snapshot — used by the room-creation picker to
 * render per-pack balances and decide whether to bounce the user
 * through Stripe before creating the room. */
export type Entitlement = {
  has_active_subscription: boolean;
  remaining_passes: number;
  date_pack_remaining: number;
  long_pack_remaining: number;
};

export function getEntitlement(): Promise<Entitlement> {
  return api.get<Entitlement>("/v1/entitlements");
}

/** Mint a one-time Stripe Checkout URL for a consumable pack. */
export function createPackCheckoutSession(
  pack_kind: "date_pack" | "long_pack",
): Promise<{ url: string }> {
  return api.post<{ url: string }>("/v1/billing/pack-checkout-session", {
    pack_kind,
  });
}
