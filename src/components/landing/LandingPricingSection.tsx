import { TIER_PRICING } from "@/lib/tierPricing";
import { ShimmerButton } from "@/components/landing/ShimmerButton";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSection, LandingSectionHeader } from "@/components/landing/LandingPrimitives";

type Plan = {
  name: string;
  price: string;
  unit: string;
  desc: string;
  cta: string;
  featured?: boolean;
};

function PlanCard({ plan, startHref }: { plan: Plan; startHref: string }) {
  return (
    <article
      className={`lp-plan-card relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 md:p-7 ${
        plan.featured
          ? "border-lppeach/45 bg-gradient-to-b from-[oklch(0.22_0.03_50)] to-[oklch(0.14_0.012_40)] shadow-[0_24px_60px_-28px_oklch(0.62_0.14_50_/_0.5)]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      {plan.featured && (
        <>
          <span className="lp-beam-border pointer-events-none absolute inset-0 rounded-2xl opacity-60" aria-hidden />
          <span className="absolute right-4 top-4 rounded-full border border-lppeach/35 bg-lppeach/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-lppeach">
            Popular
          </span>
        </>
      )}
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lppeach">{plan.name}</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="lp-display text-4xl text-lpcream md:text-5xl">{plan.price}</span>
        <span className="text-sm text-lpmuted">{plan.unit}</span>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-lpmuted">{plan.desc}</p>
      <ShimmerButton to={startHref} className="mt-6 self-start !px-5 !py-2.5 text-sm">
        {plan.cta}
      </ShimmerButton>
    </article>
  );
}

export function LandingPricingSection({
  eyebrow,
  title,
  packs,
  subs,
  startHref,
}: {
  eyebrow: string;
  title: string;
  packs: Plan[];
  subs: Plan[];
  startHref: string;
}) {
  return (
    <LandingSection id="pricing" dark>
      <LandingReveal>
        <LandingSectionHeader eyebrow={eyebrow} title={title} align="center" />
      </LandingReveal>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {packs.map((p, i) => (
          <LandingReveal key={p.name} delayMs={i * 60}>
            <PlanCard plan={p} startHref={startHref} />
          </LandingReveal>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {subs.map((p, i) => (
          <LandingReveal key={p.name} delayMs={180 + i * 60}>
            <PlanCard plan={{ ...p, featured: true }} startHref={startHref} />
          </LandingReveal>
        ))}
      </div>
    </LandingSection>
  );
}

/** Build plan props from i18n + tier pricing — keeps Landing.tsx thin. */
export function buildLandingPlans(t: (key: string) => string): { packs: Plan[]; subs: Plan[] } {
  return {
    packs: [
      {
        name: t("landing.pricing.tryName"),
        price: TIER_PRICING.try.priceLabel,
        unit: t("landing.pricing.tryUnit"),
        desc: t("landing.pricing.tryDesc"),
        cta: t("landing.pricing.tryCta"),
      },
      {
        name: t("landing.pricing.datePackName"),
        price: TIER_PRICING.date_pack.priceLabel,
        unit: TIER_PRICING.date_pack.unit!,
        desc: t("landing.pricing.datePackDesc"),
        cta: t("landing.pricing.datePackCta"),
      },
      {
        name: t("landing.pricing.longPackName"),
        price: TIER_PRICING.long_pack.priceLabel,
        unit: TIER_PRICING.long_pack.unit!,
        desc: t("landing.pricing.longPackDesc"),
        cta: t("landing.pricing.longPackCta"),
      },
    ],
    subs: [
      {
        name: t("landing.pricing.togetherName"),
        price: TIER_PRICING.together.priceLabel,
        unit: `${TIER_PRICING.together.priceSuffix ?? ""} · ${TIER_PRICING.together.unit}`,
        desc: t("landing.pricing.togetherDesc"),
        cta: t("landing.pricing.togetherCta"),
        featured: true,
      },
      {
        name: t("landing.pricing.crewName"),
        price: TIER_PRICING.crew.priceLabel,
        unit: `${TIER_PRICING.crew.priceSuffix ?? ""} · ${TIER_PRICING.crew.unit}`,
        desc: t("landing.pricing.crewDesc"),
        cta: t("landing.pricing.crewCta"),
        featured: true,
      },
    ],
  };
}
