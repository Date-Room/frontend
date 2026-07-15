/**
 * In-session time extensions — add minutes to the live room timer.
 */
import { api } from "@/lib/api";
import {
  paymentRailLabel,
  STORE_ONLY_MESSAGE,
  type PaymentProvider,
  waitForMpesaPayment,
} from "@/lib/billing";

export type TimeExtensionProductId = "time_15" | "time_30" | "time_60";

export type TimeExtensionProduct = {
  id: TimeExtensionProductId;
  label: string;
  minutes: number;
  amount: number;
  currency: string;
  available: boolean;
};

export type TimeExtensionConfig = {
  payment_provider: PaymentProvider;
  country_code: string | null;
  stripe_configured: boolean;
  mpesa_configured: boolean;
  dev_checkout_enabled?: boolean;
  expires_at: string | null;
  products: TimeExtensionProduct[];
};

/** List prices — always shown in the Add more time dialog. */
export const TIME_EXTENSION_CATALOG: TimeExtensionProduct[] = [
  {
    id: "time_15",
    label: "15 minutes",
    minutes: 15,
    amount: 0.99,
    currency: "USD",
    available: true,
  },
  {
    id: "time_30",
    label: "30 minutes",
    minutes: 30,
    amount: 1.99,
    currency: "USD",
    available: true,
  },
  {
    id: "time_60",
    label: "1 hour",
    minutes: 60,
    amount: 2.99,
    currency: "USD",
    available: true,
  },
];

export function defaultTimeExtensionConfig(): TimeExtensionConfig {
  return {
    payment_provider: "stripe",
    country_code: null,
    stripe_configured: false,
    mpesa_configured: false,
    dev_checkout_enabled: false,
    expires_at: null,
    products: TIME_EXTENSION_CATALOG,
  };
}

/** Merge server config over defaults — keeps catalog visible if the API fails. */
export function resolveTimeExtensionConfig(
  server: TimeExtensionConfig | undefined,
): TimeExtensionConfig {
  if (!server) return defaultTimeExtensionConfig();
  return {
    ...defaultTimeExtensionConfig(),
    ...server,
    products:
      server.products.length > 0 ? server.products : TIME_EXTENSION_CATALOG,
  };
}

export function getTimeExtensionConfig(
  roomId: string,
  participantId?: string,
): Promise<TimeExtensionConfig> {
  const qs = participantId
    ? `?participant_id=${encodeURIComponent(participantId)}`
    : "";
  return api.get<TimeExtensionConfig>(
    `/v1/rooms/${roomId}/time-extensions${qs}`,
  );
}

export function createTimeExtensionCheckout(
  roomId: string,
  product: TimeExtensionProductId,
): Promise<{ url: string }> {
  return api.post<{ url: string }>(
    `/v1/rooms/${roomId}/time-extensions/checkout`,
    { product },
  );
}

export function initiateTimeExtensionMpesa(
  roomId: string,
  payload: {
    product: TimeExtensionProductId;
    phone: string;
    country_code?: string | null;
  },
): Promise<{ transaction_id: string }> {
  return api.post<{ transaction_id: string }>(
    `/v1/rooms/${roomId}/time-extensions/mpesa/stk-push`,
    payload,
  );
}

export function devPurchaseTimeExtension(
  roomId: string,
  product: TimeExtensionProductId,
): Promise<{ expires_at: string }> {
  return api.post<{ expires_at: string }>(
    `/v1/rooms/${roomId}/time-extensions/dev/purchase`,
    { product },
  );
}

export function formatTimeExtensionPrice(product: TimeExtensionProduct): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: product.currency,
      minimumFractionDigits: product.currency === "USD" ? 2 : 0,
      maximumFractionDigits: product.currency === "USD" ? 2 : 0,
    }).format(product.amount);
  } catch {
    return `${product.currency} ${product.amount}`;
  }
}

export function isTimeCheckoutReady(config: TimeExtensionConfig): boolean {
  if (config.dev_checkout_enabled) return true;
  if (config.payment_provider === "store") return false;
  return config.payment_provider === "mpesa"
    ? config.mpesa_configured
    : config.stripe_configured;
}

export function isTimeStoreCheckout(config: TimeExtensionConfig): boolean {
  return config.payment_provider === "store" && !config.dev_checkout_enabled;
}

export function timeCheckoutBlockedMessage(
  config: TimeExtensionConfig,
): string | null {
  if (isTimeStoreCheckout(config)) return STORE_ONLY_MESSAGE;
  if (config.payment_provider === "mpesa" && !config.country_code) {
    return "Set your country in Manage profile before paying with M-Pesa.";
  }
  if (!isTimeCheckoutReady(config)) {
    return `Checkout is not available yet — ${paymentRailLabel(config.payment_provider)} is not configured on the server.`;
  }
  return null;
}

export async function purchaseTimeExtension(
  roomId: string,
  product: TimeExtensionProductId,
  config: TimeExtensionConfig,
  phone?: string,
): Promise<{ result: "redirected" | "completed"; expires_at?: string }> {
  if (config.dev_checkout_enabled) {
    const { expires_at } = await devPurchaseTimeExtension(roomId, product);
    return { result: "completed", expires_at };
  }

  if (config.payment_provider === "store") {
    throw new Error(STORE_ONLY_MESSAGE);
  }

  if (config.payment_provider === "mpesa") {
    if (!phone?.trim()) {
      throw new Error("Enter your M-Pesa mobile number.");
    }
    if (!config.country_code) {
      throw new Error("Set your country in Profile before paying with M-Pesa.");
    }
    const { transaction_id } = await initiateTimeExtensionMpesa(roomId, {
      product,
      phone: phone.trim(),
      country_code: config.country_code,
    });
    await waitForMpesaPayment(transaction_id);
    return { result: "completed" };
  }

  const { url } = await createTimeExtensionCheckout(roomId, product);
  window.location.assign(url);
  return { result: "redirected" };
}
