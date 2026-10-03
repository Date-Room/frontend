/**
 * In-session time extensions — add minutes to the live room timer.
 */
import { runMpesaPayment } from "@/lib/mpesaFlow";
import { api } from "@/lib/api";
import {
  paymentRailLabel,
  STORE_ONLY_MESSAGE,
  type PaymentProvider,
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
  /** A Try room: paying anything unlocks the full room; it can become a pack date. */
  is_try?: boolean;
  /** The 15-minute top-up is offered in the last 5 minutes only. */
  time_15_open?: boolean;
  upgrade_packs?: UpgradePack[];
};

export type UpgradePackId = "date_pack" | "long_pack";

export type UpgradePack = {
  id: UpgradePackId;
  sessions: number;
  minutes: number;
  amount: number;
  currency: string;
  /** vs the same hours bought as 1-hour add-ons; null when it isn't a saving */
  save_percent: number | null;
  /** Unused dates of this pack the caller already owns. */
  owned: number;
};

/** "Upgrade this date" leads with packs; "Add more time" with minutes. */
export type TimeSheetMode = "upgrade" | "time";

/** Pure: which time options to show. 15 minutes only near the end, never on the upgrade sheet. */
export function visibleTimeProducts(config: TimeExtensionConfig, mode: TimeSheetMode): TimeExtensionProduct[] {
  return config.products.filter((p) => {
    if (p.id !== "time_15") return true;
    return mode === "time" && config.time_15_open !== false;
  });
}

/** Pure: packs best value first (Long Pack), with the badge text. */
export function upgradePackRows(config: TimeExtensionConfig): (UpgradePack & {
  title: string;
  sub: string;
  badge: string | null;
  bestValue: boolean;
})[] {
  const packs = [...(config.upgrade_packs ?? [])].sort((a, b) => (b.save_percent ?? 0) - (a.save_percent ?? 0));
  return packs.map((p, i) => {
    const hours = p.minutes / 60;
    const words: Record<number, string> = { 1: "one", 2: "two", 3: "three" };
    const length = `${words[hours] ?? hours}-hour`;
    return {
      ...p,
      title: p.id === "long_pack" ? "Long Pack" : "Date Pack",
      sub: `${p.sessions} ${length} dates · this one starts now`,
      badge: p.save_percent ? `Save ${p.save_percent}%` : null,
      bestValue: i === 0 && packs.length > 1,
    };
  });
}

/** Pure: "KES 600" / "$4.99". */
export function formatPackPrice(pack: Pick<UpgradePack, "amount" | "currency">): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: pack.currency,
      minimumFractionDigits: pack.currency === "USD" ? 2 : 0,
      maximumFractionDigits: pack.currency === "USD" ? 2 : 0,
    }).format(pack.amount);
  } catch {
    return `${pack.currency} ${pack.amount}`;
  }
}

/** Make this Try room a pack date with one of my own dates. */
export function upgradeRoomWithOwnedPack(
  roomId: string,
  pack: UpgradePackId,
): Promise<{ package: string; expires_at: string | null }> {
  return api.post(`/v1/rooms/${roomId}/upgrade`, { pack });
}

/** Buy a pack by M-Pesa "for this room": once paid, the room becomes its first date. */
export async function buyPackForRoom(roomId: string, pack: UpgradePackId, phone: string): Promise<void> {
  const number = phone.trim();
  await runMpesaPayment({
    label: pack === "long_pack" ? "Long Pack" : "Date Pack",
    start: () =>
      api.post<{ transaction_id: string }>("/v1/billing/mpesa/stk-push", {
        phone: number,
        product_kind: pack,
        room_id: roomId,
      }),
  });
}

/** Tell the room page to reload its plan now (menu, timer, package). */
export const ROOM_PLAN_CHANGED = "dateroom:room-plan-changed";
export function announceRoomPlanChanged(): void {
  window.dispatchEvent(new Event(ROOM_PLAN_CHANGED));
}

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
    const countryCode = config.country_code;
    await runMpesaPayment({
      label: "extra time",
      start: () =>
        initiateTimeExtensionMpesa(roomId, { product, phone: phone.trim(), country_code: countryCode }),
    });
    return { result: "completed" };
  }

  const { url } = await createTimeExtensionCheckout(roomId, product);
  window.location.assign(url);
  return { result: "redirected" };
}
