import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PaymentCheckout } from "@/components/PaymentCheckout";
import { StoreDownloadCta } from "@/components/StoreDownloadCta";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShimmerSkeleton } from "@/components/ui/skeleton";
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
    desc: "A persistent room, just for the two of you.",
    emoji: "🏠",
  },
  {
    id: "crew",
    product: "crew",
    title: "Crew",
    desc: "Group watch parties for up to 5 people.",
    emoji: "🎬",
  },
];

function tierOption(id: AccountTier): TierOption {
  return TIER_OPTIONS.find((t) => t.id === id) ?? TIER_OPTIONS[0];
}

function currentTierDetail(entitlement: Entitlement): string {
  if (entitlement.has_active_subscription) {
    return entitlement.account_tier === "crew"
      ? "Subscription active · group watch"
      : "Subscription active · persistent room";
  }
  const parts: string[] = [];
  if (entitlement.account_tier === "try") {
    parts.push("Free · 20-minute sessions");
  } else {
    parts.push(entitlement.account_tier_label || tierOption(entitlement.account_tier).title);
  }
  if (entitlement.date_pack_remaining > 0) {
    parts.push(`${entitlement.date_pack_remaining} Date Pack session${entitlement.date_pack_remaining === 1 ? "" : "s"} left`);
  }
  if (entitlement.long_pack_remaining > 0) {
    parts.push(`${entitlement.long_pack_remaining} Long Pack session${entitlement.long_pack_remaining === 1 ? "" : "s"} left`);
  }
  if ((entitlement.together_remaining ?? 0) > 0 && !entitlement.has_active_subscription) {
    parts.push(`${entitlement.together_remaining} Together credit${(entitlement.together_remaining ?? 0) === 1 ? "" : "s"}`);
  }
  if ((entitlement.crew_remaining ?? 0) > 0 && entitlement.account_tier !== "crew") {
    parts.push(`${entitlement.crew_remaining} Crew credit${(entitlement.crew_remaining ?? 0) === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

function isActiveTier(entitlement: Entitlement, tierId: AccountTier): boolean {
  if (entitlement.account_tier === tierId) return true;
  if (tierId === "together" && entitlement.has_active_subscription && entitlement.account_tier === "together") {
    return true;
  }
  if (tierId === "crew" && entitlement.has_active_subscription && entitlement.account_tier === "crew") {
    return true;
  }
  return false;
}

function recommendedUpgrade(entitlement: Entitlement | undefined): BillableProduct | null {
  if (!entitlement) return "date_pack";
  if (entitlement.has_active_subscription && entitlement.account_tier === "crew") return null;
  if (entitlement.has_active_subscription && entitlement.account_tier === "together") return "crew";
  if (entitlement.account_tier === "long_pack" || entitlement.long_pack_remaining > 0) return "together";
  if (entitlement.account_tier === "date_pack" || entitlement.date_pack_remaining > 0) return "long_pack";
  return "date_pack";
}

export function ProfilePlanSection({
  entitlement,
  billingConfig,
  loading,
}: {
  entitlement: Entitlement | undefined;
  billingConfig: BillingConfig | undefined;
  loading?: boolean;
  /** @deprecated Layout is always full-width on profile. */
  dense?: boolean;
}) {
  const queryClient = useQueryClient();
  const [upgradeProduct, setUpgradeProduct] = useState<BillableProduct | null>(null);

  const earlyAccess = billingConfig && !billingConfig.paywall_enabled;
  const currentTier = entitlement?.account_tier ?? "try";
  const currentMeta = tierOption(currentTier);
  const suggestProduct = useMemo(() => recommendedUpgrade(entitlement), [entitlement]);

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

  const paidTiers = TIER_OPTIONS.filter((o) => o.product);

  return (
    <>
      <section className="space-y-4">
        {/* Current tier — hero */}
        <div className="editorial-card overflow-hidden">
          <div className="relative border-b border-white/[0.06] bg-gradient-to-br from-primary/[0.12] via-transparent to-transparent px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/85">
                  Your plan
                </p>
                {loading && !entitlement ? (
                  <div className="mt-3 space-y-2">
                    <ShimmerSkeleton width={180} height={32} />
                    <ShimmerSkeleton width={260} height={16} />
                  </div>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-3xl ring-1 ring-primary/30">
                        {currentMeta.emoji}
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-serif text-2xl italic text-cream sm:text-3xl">
                          {entitlement?.account_tier_label ?? currentMeta.title}
                        </h2>
                        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                          {entitlement ? currentTierDetail(entitlement) : currentMeta.desc}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {suggestProduct && !loading && (
                <button
                  type="button"
                  onClick={() => setUpgradeProduct(suggestProduct)}
                  className="btn-primary inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-[0_12px_32px_rgba(232,166,83,0.22)]"
                >
                  Upgrade
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            {earlyAccess && (
              <p className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs leading-relaxed text-cream/80">
                Early access — everything is unlocked while we&apos;re in beta. You can still
                buy packs or subscribe below to be ready when billing goes live.
              </p>
            )}
          </div>

          {billingConfig && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-[11px] text-muted-foreground sm:px-6">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                {isStoreCheckout(billingConfig)
                  ? "Purchases happen in the DateRoom app"
                  : `Pay with ${paymentRailLabel(billingConfig.payment_provider)}`}
              </span>
              {billingConfig.dev_checkout_enabled && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                  Dev checkout on
                </span>
              )}
            </div>
          )}
        </div>

        {/* Upgrade grid — always visible */}
        <div className="editorial-card overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3.5 sm:px-6">
            <p className="text-sm font-medium text-cream">Upgrade your plan</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pick a pack or subscription — your current plan is marked below.
            </p>
          </div>

          <ul className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
            {paidTiers.map((option) => {
              const meta = billingProductForTier(option.id, billingConfig?.products);
              const price = formatTierPrice(option.id, meta);
              const unit = tierPricingMeta(option.id).unit;
              const isCurrent = entitlement ? isActiveTier(entitlement, option.id) : false;
              const isSuggested = option.product === suggestProduct;

              return (
                <li
                  key={option.id}
                  className={cn(
                    "flex flex-col rounded-2xl border p-4 transition",
                    isCurrent
                      ? "border-primary/45 bg-primary/[0.08] shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-primary/25 hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl ring-1 ring-primary/20">
                      {option.emoji}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full border border-primary/35 bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
                        Current
                      </span>
                    )}
                    {!isCurrent && isSuggested && (
                      <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-cream/70">
                        Suggested
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-serif text-lg text-cream">{option.title}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary">{price}</p>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {option.desc}
                    {unit ? ` · ${unit}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => option.product && setUpgradeProduct(option.product)}
                    disabled={loading || isCurrent || !option.product}
                    className={cn(
                      "mt-4 w-full rounded-full py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition disabled:cursor-default",
                      isCurrent
                        ? "border border-primary/25 bg-primary/10 text-primary/70"
                        : "border border-primary/35 bg-primary/12 text-primary hover:bg-primary/20 disabled:opacity-40",
                    )}
                  >
                    {isCurrent ? "Your plan" : "Upgrade"}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Free Try tier — reference row */}
          <div className="border-t border-white/[0.06] px-5 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-lg" aria-hidden>
                {TIER_OPTIONS[0].emoji}
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-cream">Try</span>
                <span className="text-muted-foreground"> — free 20-minute session for every account</span>
              </div>
              {currentTier === "try" && (
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Included
                </span>
              )}
            </div>
          </div>
        </div>
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
