import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PaymentCheckout } from "@/components/PaymentCheckout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type AccountTier,
  type BillableProduct,
  type BillingConfig,
  type Entitlement,
  checkoutBlockedMessage,
  paymentRailLabel,
} from "@/lib/billing";
import {
  billingProductForTier,
  formatTierPrice,
  tierPricingMeta,
} from "@/lib/tierPricing";
import { cn } from "@/lib/utils";

type TierOption = {
  id: AccountTier;
  product: BillableProduct | null;
  title: string;
  desc: string;
  emoji: string;
};

const TIER_OPTIONS: TierOption[] = [
  {
    id: "try",
    product: null,
    title: "Try",
    desc: "One free session, 20 minutes.",
    emoji: "🕯️",
  },
  {
    id: "date_pack",
    product: "date_pack",
    title: "Date Pack",
    desc: "Three sessions, 1 hour each.",
    emoji: "💌",
  },
  {
    id: "long_pack",
    product: "long_pack",
    title: "Long Pack",
    desc: "Five sessions, 2 hours each.",
    emoji: "🌙",
  },
  {
    id: "together",
    product: "together",
    title: "Together",
    desc: "Persistent room + watch party for up to 12.",
    emoji: "🏠",
  },
  {
    id: "crew",
    product: "crew",
    title: "Crew",
    desc: "Group watch parties for 10+ people.",
    emoji: "🎬",
  },
];

function planDetail(entitlement: Entitlement | undefined): string {
  if (!entitlement) return "Loading your plan…";
  if (entitlement.has_active_subscription) {
    if (entitlement.account_tier === "crew") return "Crew subscription active · watch party";
    return "Together subscription active · watch party";
  }
  if (entitlement.remaining_passes > 0) {
    const parts: string[] = [];
    if (entitlement.date_pack_remaining > 0) {
      parts.push(`${entitlement.date_pack_remaining} Date Pack`);
    }
    if (entitlement.long_pack_remaining > 0) {
      parts.push(`${entitlement.long_pack_remaining} Long Pack`);
    }
    return `${parts.join(" · ")} credit${entitlement.remaining_passes === 1 ? "" : "s"} left`;
  }
  return "Free sessions only";
}

function tierRank(tier: AccountTier): number {
  switch (tier) {
    case "try":
      return 0;
    case "date_pack":
      return 1;
    case "long_pack":
      return 2;
    case "together":
    case "crew":
      return 3;
  }
}

function upgradeLabel(currentTier: AccountTier, option: TierOption): string {
  if (!option.product) return "";
  if (currentTier === option.id && (option.id === "together" || option.id === "crew")) return "Renew";
  if (currentTier === option.id) return "Add more";
  if (tierRank(option.id) > tierRank(currentTier)) return "Upgrade";
  return "Get";
}

/** Paid tiers are always purchasable — credits stack and upgrades apply. */
function canUpgradeTo(option: TierOption, paywallOpen: boolean): boolean {
  return Boolean(option.product) && !paywallOpen;
}

export function ProfilePlanSection({
  entitlement,
  billingConfig,
  loading,
}: {
  entitlement: Entitlement | undefined;
  billingConfig: BillingConfig | undefined;
  loading?: boolean;
}) {
  const queryClient = useQueryClient();
  const [upgradeProduct, setUpgradeProduct] = useState<BillableProduct | null>(null);

  const currentTier = entitlement?.account_tier ?? billingConfig?.account_tier ?? "try";
  const currentLabel = entitlement?.account_tier_label ?? billingConfig?.account_tier_label ?? "Try";
  const paywallOpen = billingConfig && !billingConfig.paywall_enabled;

  async function refreshBilling() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entitlement"] }),
      queryClient.invalidateQueries({ queryKey: ["billing-config"] }),
      queryClient.invalidateQueries({ queryKey: ["subscription-status"] }),
    ]);
    setUpgradeProduct(null);
  }

  const upgradeTitle =
    upgradeProduct === "crew"
      ? "Subscribe to Crew"
      : upgradeProduct === "together"
      ? "Subscribe to Together"
      : upgradeProduct === "long_pack"
        ? "Buy Long Pack"
        : upgradeProduct === "date_pack"
          ? "Buy Date Pack"
          : "Upgrade";

  const checkoutBlocked =
    billingConfig && upgradeProduct ? checkoutBlockedMessage(billingConfig) : null;

  return (
    <>
      <section className="editorial-card overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <p className="text-sm font-medium text-cream">Your plan</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                currentTier === "together" || currentTier === "crew"
                  ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
                  : currentTier === "try"
                    ? "border-white/15 bg-white/[0.04] text-muted-foreground"
                    : "border-primary/35 bg-primary/12 text-primary",
              )}
            >
              {loading ? "…" : currentLabel}
            </span>
            <span className="text-xs text-muted-foreground">{planDetail(entitlement)}</span>
          </div>
          {billingConfig && !paywallOpen && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Pay with {paymentRailLabel(billingConfig.payment_provider)}
              {billingConfig.country_code ? ` · ${billingConfig.country_code}` : ""}
            </p>
          )}
        </div>

        {paywallOpen ? (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            Everything&apos;s open during early access — no upgrade needed right now.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {TIER_OPTIONS.map((option) => {
              const isCurrent = currentTier === option.id;
              const meta = billingProductForTier(option.id, billingConfig?.products);
              const price = formatTierPrice(option.id, meta);
              const unit = tierPricingMeta(option.id).unit;
              const showUpgrade = canUpgradeTo(option, Boolean(paywallOpen));

              return (
                <li key={option.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg ring-1 ring-primary/20">
                      {option.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-cream">{option.title}</p>
                        <span className="text-sm font-semibold tabular-nums text-primary">
                          {price}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                            <Check className="h-3 w-3" aria-hidden />
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {option.desc}
                        {unit && option.id !== "try" ? ` · ${unit}` : ""}
                      </p>
                    </div>
                    {showUpgrade && option.product && (
                      <button
                        type="button"
                        onClick={() => setUpgradeProduct(option.product)}
                        disabled={loading}
                        className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15 disabled:opacity-40"
                      >
                        {upgradeLabel(currentTier, option)}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={upgradeProduct !== null} onOpenChange={(open) => !open && setUpgradeProduct(null)}>
        <DialogContent className="border-white/10 bg-card/95 text-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif italic text-xl">{upgradeTitle}</DialogTitle>
          </DialogHeader>
          {checkoutBlocked ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>{checkoutBlocked}</p>
              {checkoutBlocked.includes("country") && (
                <Link
                  to="/settings"
                  className="btn-primary inline-flex w-full items-center justify-center rounded-[1.15rem] py-3 font-semibold"
                  onClick={() => setUpgradeProduct(null)}
                >
                  Set country in profile
                </Link>
              )}
            </div>
          ) : billingConfig && upgradeProduct ? (
            <PaymentCheckout
              config={billingConfig}
              product={upgradeProduct}
              label={upgradeTitle}
              onConfigRefresh={refreshBilling}
              onComplete={refreshBilling}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading checkout…</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
