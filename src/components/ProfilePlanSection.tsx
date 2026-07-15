import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PaymentCheckout } from "@/components/PaymentCheckout";
import { StoreDownloadCta } from "@/components/StoreDownloadCta";
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
  isStoreCheckout,
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
  const [buyOpen, setBuyOpen] = useState(false);

  const paywallOpen = billingConfig && !billingConfig.paywall_enabled;

  // Plans the user owns right now — packages/credits they've bought (and the
  // free Try session), each with how many are left. A user can own several at
  // once, so this is a list, not a single "current tier".
  type OwnedPlan = { emoji: string; title: string; detail: string; count: number | null };
  const ownedPlans: OwnedPlan[] = [];
  if (entitlement) {
    ownedPlans.push({ emoji: "🕯️", title: "Try", detail: "20-min session", count: null });
    if (entitlement.date_pack_remaining > 0) {
      ownedPlans.push({
        emoji: "💌",
        title: "Date Pack",
        detail: "1 hour each",
        count: entitlement.date_pack_remaining,
      });
    }
    if (entitlement.long_pack_remaining > 0) {
      ownedPlans.push({
        emoji: "🌙",
        title: "Long Pack",
        detail: "2 hours each",
        count: entitlement.long_pack_remaining,
      });
    }
    if (entitlement.has_active_subscription) {
      ownedPlans.push({
        emoji: entitlement.account_tier === "crew" ? "🎬" : "🏠",
        title: entitlement.account_tier === "crew" ? "Crew" : "Together",
        detail: "Subscription active",
        count: null,
      });
    } else {
      if ((entitlement.together_remaining ?? 0) > 0) {
        ownedPlans.push({
          emoji: "🏠",
          title: "Together",
          detail: "Persistent room",
          count: entitlement.together_remaining ?? 0,
        });
      }
      if ((entitlement.crew_remaining ?? 0) > 0) {
        ownedPlans.push({
          emoji: "🎬",
          title: "Crew",
          detail: "Persistent group room",
          count: entitlement.crew_remaining ?? 0,
        });
      }
    }
  }

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
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <p className="text-sm font-medium text-cream">Plans you own</p>
          </div>
          {billingConfig && !paywallOpen && (
            <span className="text-[11px] text-muted-foreground">
              {isStoreCheckout(billingConfig)
                ? "Purchases in the app"
                : `Pay with ${paymentRailLabel(billingConfig.payment_provider)}`}
            </span>
          )}
        </div>

        {ownedPlans.length > 0 && (
          <ul className="divide-y divide-white/[0.06] border-b border-white/[0.06]">
            {ownedPlans.map((p) => (
              <li key={p.title} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg ring-1 ring-primary/20">
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-cream">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.detail}</p>
                </div>
                {p.count !== null ? (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-cream">
                    ×{p.count}
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {p.title === "Try" ? "Free" : "Active"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {paywallOpen ? (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            Everything&apos;s open during early access — no upgrade needed right now.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setBuyOpen((v) => !v)}
              aria-expanded={buyOpen}
              className="focus-ring flex w-full items-center justify-center gap-2 border-t border-white/[0.06] bg-primary/[0.08] px-4 py-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.14]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Buy a plan
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-200", buyOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out",
                buyOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                  {TIER_OPTIONS.filter((o) => o.product).map((option) => {
                    const meta = billingProductForTier(option.id, billingConfig?.products);
                    const price = formatTierPrice(option.id, meta);
                    const unit = tierPricingMeta(option.id).unit;
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
                            </div>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                              {option.desc}
                              {unit && option.id !== "try" ? ` · ${unit}` : ""}
                            </p>
                          </div>
                          {option.product && (
                            <button
                              type="button"
                              onClick={() => setUpgradeProduct(option.product)}
                              disabled={loading}
                              className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15 disabled:opacity-40"
                            >
                              Buy
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        )}
      </section>

      <Dialog open={upgradeProduct !== null} onOpenChange={(open) => !open && setUpgradeProduct(null)}>
        <DialogContent className="border-white/10 bg-card/95 text-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif font-semibold text-xl">{upgradeTitle}</DialogTitle>
          </DialogHeader>
          {billingConfig && isStoreCheckout(billingConfig) ? (
            <StoreDownloadCta note={`${upgradeTitle} is available in the DateRoom app.`} />
          ) : checkoutBlocked ? (
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
