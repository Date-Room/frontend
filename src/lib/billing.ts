/**
 * Billing client — Stripe (global) + M-Pesa (KE/TZ/UG) payment rails.
 */
import { api } from "@/lib/api";

export type AccountTier = "try" | "date_pack" | "long_pack" | "together" | "crew";
// "store" = web can't take payment in this region (non-KE while card
// checkout is dark); purchases happen in the native app instead.
export type PaymentProvider = "stripe" | "mpesa" | "store";
export type BillableProduct = "date_pack" | "long_pack" | "together" | "crew";

/** Shown wherever a store-region user would otherwise see a checkout. */
export const STORE_ONLY_MESSAGE = "Purchases are available in the DateRoom app.";

export type SubscriptionSnapshot = {
  id: string;
  platform: "ios" | "android" | "stripe" | "mpesa";
  status: "active" | "grace" | "cancelled" | "expired";
  product_id: string;
  current_period_start: string;
  current_period_end: string;
};

export type SubscriptionStatus = {
  paywall_enabled: boolean;
  entitled: boolean;
  subscription: SubscriptionSnapshot | null;
  account_tier: AccountTier;
  account_tier_label: string;
  watch_party_enabled?: boolean;
  watch_party_capacity?: number;
  payment_provider: PaymentProvider;
  country_code: string | null;
};

export type Entitlement = {
  has_active_subscription: boolean;
  remaining_passes: number;
  date_pack_remaining: number;
  long_pack_remaining: number;
  together_remaining?: number;
  crew_remaining?: number;
  account_tier: AccountTier;
  account_tier_label: string;
  watch_party_enabled?: boolean;
  watch_party_capacity?: number;
  payment_provider: PaymentProvider;
  country_code: string | null;
};

export type BillingProduct = {
  id: BillableProduct;
  label: string;
  amount: number | null;
  currency: string;
  available: boolean;
};

export type BillingConfig = {
  paywall_enabled: boolean;
  payment_provider: PaymentProvider;
  country_code: string | null;
  stripe_configured: boolean;
  mpesa_configured: boolean;
  dev_checkout_enabled?: boolean;
  account_tier: AccountTier;
  account_tier_label: string;
  products: BillingProduct[];
};

export type MpesaStkPushResponse = {
  transaction_id: string;
  checkout_request_id: string;
  message: string;
};

export type MpesaTransactionStatus = {
  transaction_id: string;
  status: "pending" | "completed" | "failed" | string;
  product_kind: BillableProduct;
  result_description: string | null;
};

export function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return api.get<SubscriptionStatus>("/v1/billing/subscription");
}

export function getEntitlement(): Promise<Entitlement> {
  return api.get<Entitlement>("/v1/entitlements");
}

export function getBillingConfig(): Promise<BillingConfig> {
  return api.get<BillingConfig>("/v1/billing/config");
}

export type CheckoutReturnPaths = {
  successPath?: string;
  cancelPath?: string;
};

export function createCheckoutSession(
  product: "together" | "crew" = "together",
  paths?: CheckoutReturnPaths,
): Promise<{ url: string }> {
  return api.post<{ url: string }>("/v1/billing/checkout-session", {
    product,
    success_path: paths?.successPath,
    cancel_path: paths?.cancelPath,
  });
}

export function createPackCheckoutSession(
  pack_kind: "date_pack" | "long_pack",
  paths?: CheckoutReturnPaths,
): Promise<{ url: string }> {
  return api.post<{ url: string }>("/v1/billing/pack-checkout-session", {
    pack_kind,
    success_path: paths?.successPath,
    cancel_path: paths?.cancelPath,
  });
}

export function devPurchaseProduct(
  product: BillableProduct,
): Promise<void> {
  return api.post<void>("/v1/billing/dev/purchase", { product });
}

export function initiateMpesaStkPush(payload: {
  phone: string;
  product_kind: BillableProduct;
  country_code?: string | null;
}): Promise<MpesaStkPushResponse> {
  return api.post<MpesaStkPushResponse>("/v1/billing/mpesa/stk-push", payload);
}

export function getMpesaTransactionStatus(
  transactionId: string,
): Promise<MpesaTransactionStatus> {
  return api.get<MpesaTransactionStatus>(
    `/v1/billing/mpesa/transactions/${transactionId}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Poll M-Pesa STK until completed or failed (max ~2 min). */
export async function waitForMpesaPayment(
  transactionId: string,
  opts?: { onPending?: () => void },
): Promise<MpesaTransactionStatus> {
  for (let i = 0; i < 40; i += 1) {
    const status = await getMpesaTransactionStatus(transactionId);
    if (status.status === "completed") return status;
    if (status.status === "failed") {
      throw new Error(status.result_description || "M-Pesa payment failed.");
    }
    opts?.onPending?.();
    await sleep(3000);
  }
  throw new Error("Payment is taking longer than expected — check your phone and try again.");
}

/** Start checkout on the correct rail. Stripe redirects; M-Pesa returns when done. */
export async function purchaseProduct(
  product: BillableProduct,
  config: BillingConfig,
  phone?: string,
  paths?: CheckoutReturnPaths,
): Promise<"redirected" | "completed"> {
  if (config.dev_checkout_enabled) {
    await devPurchaseProduct(product);
    return "completed";
  }

  // Store regions can't pay on the web — callers should route to the app
  // download instead of reaching here; this is the safety net.
  if (config.payment_provider === "store") {
    throw new Error(STORE_ONLY_MESSAGE);
  }

  if (config.payment_provider === "mpesa") {
    if (!phone?.trim()) {
      throw new Error("Enter your M-Pesa mobile number.");
    }
    if (!config.country_code) {
      throw new Error("Pick your country below before paying with M-Pesa.");
    }
    const { transaction_id } = await initiateMpesaStkPush({
      phone: phone.trim(),
      product_kind: product,
      country_code: config.country_code,
    });
    await waitForMpesaPayment(transaction_id);
    return "completed";
  }

  const { url } =
    product === "together" || product === "crew"
      ? await createCheckoutSession(product, paths)
      : await createPackCheckoutSession(product, paths);
  window.location.assign(url);
  return "redirected";
}

export function formatProductPrice(product: BillingProduct): string | null {
  if (product.amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: product.currency,
      maximumFractionDigits: 0,
    }).format(product.amount);
  } catch {
    return `${product.currency} ${product.amount}`;
  }
}

export function paymentRailLabel(provider: PaymentProvider): string {
  if (provider === "mpesa") return "M-Pesa";
  if (provider === "store") return "the DateRoom app";
  return "Stripe";
}

/** True when this region's purchases happen in the native app, not the web. */
export function isStoreCheckout(config: {
  payment_provider: PaymentProvider;
  dev_checkout_enabled?: boolean;
}): boolean {
  return config.payment_provider === "store" && !config.dev_checkout_enabled;
}

/** True when the server can start checkout on the user's payment rail. */
export function isCheckoutReady(config: BillingConfig): boolean {
  if (config.dev_checkout_enabled) return true;
  if (config.payment_provider === "store") return false;
  return config.payment_provider === "mpesa"
    ? config.mpesa_configured
    : config.stripe_configured;
}

export function checkoutBlockedMessage(config: BillingConfig): string | null {
  if (isStoreCheckout(config)) return STORE_ONLY_MESSAGE;
  if (!isCheckoutReady(config)) {
    return `Checkout is not available yet — ${paymentRailLabel(config.payment_provider)} is not configured on the server.`;
  }
  return null;
}
