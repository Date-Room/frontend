import { Link } from "react-router-dom";
import type { ComponentType } from "react";
import { Sparkles, Twitter, Instagram, Mail } from "lucide-react";
import { LandingLanguageMenu } from "@/components/LandingLanguageMenu";
import { ShimmerButton } from "@/components/landing/ShimmerButton";
import { LandingParticleCanvas } from "@/components/landing/LandingParticleCanvas";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function LandingClosingSection({
  badgesTagline,
  badgesComingSoon,
  finalTitle,
  finalSubtitle,
  finalCreate,
  finalJoin,
  finalPricing,
  footer,
  startHref,
}: {
  badgesTagline: string;
  badgesComingSoon: string;
  finalTitle: string;
  finalSubtitle: string;
  finalCreate: string;
  finalJoin: string;
  finalPricing: string;
  footer: {
    mission: string;
    tagline: string;
    copyright: string;
    productTitle: string;
    productLinks: string[];
    companyTitle: string;
    companyLinks: string[];
    companyHrefs: (string | undefined)[];
    connectTitle: string;
    connectLinks: string[];
  };
  startHref: string;
}) {
  return (
    <>
      <section className="border-t border-lpborder/30 px-6 py-16 text-center">
        <LandingReveal>
          <p className="lp-serif text-2xl italic text-lpcream md:text-3xl">{badgesTagline}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {["App Store", "Google Play"].map((store) => (
              <div
                key={store}
                className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 opacity-75"
              >
                <Sparkles className="h-5 w-5 text-lpmuted" />
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-lpmuted">{badgesComingSoon}</p>
                  <p className="lp-serif text-lg italic text-lpcream">{store}</p>
                </div>
              </div>
            ))}
          </div>
        </LandingReveal>
      </section>

      <section id="cta" className="lp-final-cta relative overflow-hidden">
        <img
          src="/lov/final-door.jpg"
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#0a0608]/70" />
        <LandingParticleCanvas className="z-[2] opacity-50 mix-blend-screen" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-32 text-center md:py-40">
          <LandingReveal>
            <h2 className="lp-display text-5xl text-lpcream md:text-6xl lg:text-7xl">{finalTitle}</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-lpcream/85">{finalSubtitle}</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <ShimmerButton to={startHref}>{finalCreate}</ShimmerButton>
              <Link to="/join" className="lp-link">
                {finalJoin}
              </Link>
              <a href="#pricing" className="lp-link">
                {finalPricing}
              </a>
            </div>
          </LandingReveal>
        </div>
      </section>

      <footer className="border-t border-lpborder/30 bg-[oklch(0.11_0.012_40)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <a href="#top" className="lp-serif text-2xl italic text-lpcream">
              DateRoom
            </a>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-lpmuted">{footer.mission}</p>
            <p className="lp-serif mt-4 italic text-lppeachsoft">{footer.tagline}</p>
          </div>
          <FooterCol
            title={footer.productTitle}
            links={footer.productLinks}
            hrefs={["#inside", "#pricing", "#how"]}
          />
          <FooterCol
            title={footer.companyTitle}
            links={footer.companyLinks}
            hrefs={footer.companyHrefs}
          />
          <FooterCol
            title={footer.connectTitle}
            links={footer.connectLinks}
            icons={[Twitter, Instagram, Mail]}
          />
        </div>
        <div className="border-t border-lpborder/30">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 text-xs text-lpmuted">
            <span>{footer.copyright}</span>
            <LandingLanguageMenu align="up" />
          </div>
        </div>
      </footer>
    </>
  );
}

function FooterCol({
  title,
  links,
  icons,
  hrefs,
}: {
  title: string;
  links: string[];
  icons?: Array<ComponentType<{ className?: string }>>;
  hrefs?: Array<string | undefined>;
}) {
  return (
    <div>
      <p className="lp-eyebrow !text-lpmuted">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm text-lpcream/85">
        {links.map((l, i) => {
          const Icon = icons?.[i];
          const href = hrefs?.[i];
          const inner = (
            <>
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {l}
            </>
          );
          return (
            <li key={l}>
              {href?.startsWith("/") ? (
                <Link to={href} className="inline-flex items-center gap-2 transition hover:text-lppeach">
                  {inner}
                </Link>
              ) : (
                <a href={href ?? "#"} className="inline-flex items-center gap-2 transition hover:text-lppeach">
                  {inner}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
