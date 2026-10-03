/** My purchases & gifts (GET /v1/billing/history). */
import { api } from "@/lib/api";

export type PurchaseStatus = "paid" | "gift" | "confirming" | "failed" | "waiting";

export type PurchaseItem = {
  kind: "purchase" | "gift" | "payment";
  title: string;
  status: PurchaseStatus;
  amount: number | null;
  currency: string | null;
  method: string | null;
  receipt: string | null;
  room_id: string | null;
  room_name: string | null;
  transaction_id: string | null;
  detail: string | null;
  at: string;
};

export type PurchaseHistory = {
  paid_totals: { currency: string; amount: number }[];
  gifts: number;
  confirming: number;
  items: PurchaseItem[];
};

export function getPurchaseHistory(): Promise<PurchaseHistory> {
  return api.get<PurchaseHistory>("/v1/billing/history");
}

export function getUserPurchaseHistory(userId: string): Promise<PurchaseHistory> {
  return api.get<PurchaseHistory>(`/v1/admin/users/${userId}/purchases`);
}

export function recheckMyPayment(transactionId: string) {
  return api.post<{ status: string }>(`/v1/billing/mpesa/transactions/${transactionId}/recheck`);
}

/** Pure: "KES 540" / "KES 540 · USD 4.99" / "Nothing yet". */
export function formatPaidTotals(totals: PurchaseHistory["paid_totals"]): string {
  if (!totals.length) return "Nothing yet";
  return totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ");
}

/** Pure: whole units for KES, two decimals where the currency has cents. */
export function formatMoney(amount: number, currency: string): string {
  const whole = Number.isInteger(amount) || currency === "KES";
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

export const STATUS_LABEL: Record<PurchaseStatus, string> = {
  paid: "Paid",
  gift: "Gift",
  confirming: "Confirming",
  failed: "Didn't go through",
  waiting: "On its way",
};

/** Pure: the second line under an item's title. */
export function itemSubline(item: PurchaseItem): string {
  const when = new Date(item.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const bits = [when];
  if (item.room_name) bits.push(item.room_name);
  if (item.method && item.status !== "waiting") bits.push(item.method);
  if (item.receipt) bits.push(item.receipt);
  return bits.join(" · ");
}
