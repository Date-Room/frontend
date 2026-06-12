/**
 * Canonical tier list prices — matches marketing (Landing / dateroom.io).
 * M-Pesa checkout amounts from the API take precedence when present.
 */
import {
  formatProductPrice,
  type BillableProduct,
  type BillingProduct,
} from "@/lib/billing";

export type TierId = "try" | "date_pack" | "long_pack" | "together" | "crew";

export type TierPricing = {
  priceLabel: string;
  priceSuffix?: string;
  unit?: string;
};

export const TIER_PRICING: Record<TierId, TierPricing> = {
  try: {
    priceLabel: "Free",
    unit: "one session · 20 min",
  },
  date_pack: {
    priceLabel: "$5",
    unit: "three sessions · 1 hr each",
  },
  long_pack: {
    priceLabel: "$10",
    unit: "five sessions · 2 hr each",
  },
  together: {
    priceLabel: "$20",
    priceSuffix: "/ month",
    unit: "for two · watch party up to 12",
  },
  crew: {
    priceLabel: "$25",
    priceSuffix: "/ month",
    unit: "watch party · up to 12 people",
  },
};

const TIER_TO_PRODUCT: Partial<Record<TierId, BillableProduct>> = {
  date_pack: "date_pack",
  long_pack: "long_pack",
  together: "together",
  crew: "crew",
};

/** Display price for a tier — localized M-Pesa amount when available, else USD list price. */
export function formatTierPrice(
  tier: TierId,
  billingProduct?: BillingProduct | null,
): string {
  if (billingProduct?.amount != null) {
    const formatted = formatProductPrice(billingProduct);
    if (formatted) {
      if (tier === "together" || tier === "crew") return `${formatted}/mo`;
      return formatted;
    }
  }
  const meta = TIER_PRICING[tier];
  return `${meta.priceLabel}${meta.priceSuffix ?? ""}`;
}

export function tierPriceForProduct(
  product: BillableProduct,
  products?: BillingProduct[],
): string {
  const tier = product as TierId;
  const billingProduct = products?.find((p) => p.id === product) ?? null;
  return formatTierPrice(tier, billingProduct);
}

export function tierPricingMeta(tier: TierId): TierPricing {
  return TIER_PRICING[tier];
}

export function billingProductForTier(
  tier: TierId,
  products?: BillingProduct[],
): BillingProduct | null {
  const productId = TIER_TO_PRODUCT[tier];
  if (!productId || !products) return null;
  return products.find((p) => p.id === productId) ?? null;
}
