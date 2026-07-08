import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { type ReactNode, type ComponentType } from "react";
import {
  ArrowRight,
  Sparkles,
  Play,
  Music2,
  Zap,
  Camera,
  Flame,
  HelpCircle,
  MoreHorizontal,
  MessageCircleQuestion,
  ShieldCheck,
  Lock,
  PhoneOff,
  KeyRound,
  Mic,
  Video,
  PhoneOff as Hangup,
  Twitter,
  Instagram,
  Mail,
} from "lucide-react";
import { TIER_PRICING } from "@/lib/tierPricing";
import { SeoHead } from "@/components/SeoHead";
import { LANDING_JSON_LD, LANDING_SEO } from "@/lib/seo";
import { LandingLanguageMenu } from "@/components/LandingLanguageMenu";
import { LandingJoinMenu } from "@/components/LandingJoinMenu";

/**
 * Marketing landing — a faithful port of date-room-escape.lovable.app.
 * Structure/copy mirror the Lovable source; styling uses lp-prefixed helpers
 * (.lp-display / .lp-eyebrow / .lp-btn / .lp-link / .lp-glow / .lp-vignette in
 * index.css) and the warm `lp*` palette (tailwind.config). Action CTAs route
 * to /auth; in-page links use section anchors.
 */

const START = "/auth"; // sign-in funnels every room/purchase action

function Wordmark({ size = "text-xl" }: { size?: string }) {
  return (
    <a href="#top" className="group flex items-center gap-2.5">
      <img src="/dateroom-logo.png" alt="DateRoom" width={32} height={32} className="h-8 w-8 rounded-md object-contain" />
      <span className={`lp-serif italic ${size} tracking-tight text-lpcream`}>DateRoom</span>
    </a>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="lp-eyebrow">{children}</p>;
}

export default function Landing() {
  const { t } = useTranslation();
  const steps = t("landing.how.steps", { returnObjects: true }) as Array<{ t: string; d: string }>;
  const insideCards = t("landing.inside.cards", { returnObjects: true }) as Array<{ t: string; d: string }>;
  const trust = t("landing.trust", { returnObjects: true }) as string[];
  return (
    <div id="top" className="lp min-h-screen bg-lpbg text-lpcream">
      <SeoHead
        title={LANDING_SEO.title}
        description={LANDING_SEO.description}
        canonical={LANDING_SEO.canonical}
        ogImage={LANDING_SEO.ogImage}
        ogImageAlt={LANDING_SEO.ogImageAlt}
        themeColor={LANDING_SEO.themeColor}
        jsonLd={LANDING_JSON_LD}
      />
      {/* Banner */}
      <a href="#couples" className="block w-full border-b border-lpborder/40 bg-[oklch(0.13_0.01_40)]">
        <div className="mx-auto max-w-7xl px-6 py-2.5 text-center text-[13px] text-lpmuted">
          {t("landing.banner")}{" "}
          <ArrowRight className="ml-1 -mt-0.5 inline h-3.5 w-3.5 text-lppeach" />
        </div>
      </a>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-lpborder/40 bg-lpbg/75 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6">
          <Wordmark />
          <ul className="hidden items-center gap-8 text-sm text-lpmuted md:flex">
            <li><a href="#how" className="transition hover:text-lpcream">{t("landing.nav.how")}</a></li>
            <li><a href="#inside" className="transition hover:text-lpcream">{t("landing.nav.inside")}</a></li>
            <li><a href="#pricing" className="transition hover:text-lpcream">{t("landing.nav.pricing")}</a></li>
          </ul>
          <div className="flex items-center gap-3">
            <LandingLanguageMenu className="hidden sm:block" iconOnly />
            <LandingJoinMenu className="hidden sm:block" />
            <Link to={START} className="lp-btn !px-5 !py-2.5 text-sm">{t("landing.nav.login")}</Link>
          </div>
        </nav>
      </header>

      {/* Section 1 — Hero */}
      <section className="lp-vignette relative overflow-hidden">
        <img src="/lov/hero-candlelit.jpg" alt="Candlelit dinner table with a tablet showing a video date" width={1920} height={1280} className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-32 pt-28 md:pb-38 md:pt-30">
          <div className="max-w-2xl text-left">
            <Eyebrow>{t("landing.hero.eyebrow")}</Eyebrow>
            <h1 className="lp-display mt-6 whitespace-pre-line text-5xl text-lpcream md:text-7xl lg:text-8xl">
              {t("landing.hero.title")}
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-lpcream/85 md:text-xl">
              {t("landing.hero.subtitle")}
            </p>
            <p className="lp-serif mt-5 text-xl italic text-lppeachsoft md:text-2xl">{t("landing.hero.tagline")}</p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link to={START} className="lp-btn">{t("landing.hero.create")}</Link>
              <a href="#how" className="lp-link">{t("landing.hero.seeHow")}</a>
            </div>
            <p className="mt-6 text-[15px] text-lpmuted">
              {t("landing.hero.gotCode")}{" "}
              <Link to="/join" className="lp-link">{t("landing.hero.join")}</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Section 2 — Why this exists */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-7">
        <div>
          <Eyebrow>{t("landing.why.eyebrow")}</Eyebrow>
          <h2 className="lp-display mt-5 whitespace-pre-line text-4xl text-lpcream md:text-6xl">
            {t("landing.why.title")}
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-lpmuted">
            {t("landing.why.p1")}
          </p>
          <p className="mt-5 text-lg leading-relaxed text-lpmuted">
            {t("landing.why.p2")}
          </p>
        </div>
        <div className="relative">
          <img
            src="/hero-virtual-date-rose-petals.png"
            alt="Virtual date with rose petals"
            width={800}
            height={800}
            loading="lazy"
            className="lp-glow aspect-square w-half rounded-2xl object-cover"
          />
        </div>
      </section>

      {/* Section 3 — How it works */}
      <section id="how" className="border-t border-lpborder/40 bg-[oklch(0.14_0.012_40)]">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>{t("landing.how.eyebrow")}</Eyebrow>
            <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">{t("landing.how.title")}</h2>
          </div>

          {/* Room mockup */}
          <div className="lp-glow mx-auto mt-16 max-w-4xl rounded-3xl border border-lpborder bg-[oklch(0.12_0.01_40)] p-5 md:p-7">
            <div className="flex items-center justify-between text-xs text-lpmuted">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.55_0.18_25)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.14_75)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.70_0.14_140)]" />
              </div>
              <div className="font-mono tracking-[0.3em] text-lpcream/80">DATE ROOM</div>
              <div className="text-[11px] uppercase tracking-widest text-lppeach">{t("landing.how.live")}</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <img src="/image copy.png" alt="Man and woman on a virtual date" width={640} height={426} className="object-cover rounded-2xl max-w-xs md:max-w-sm" />
              <img src="/image.png" alt="Man and woman on a virtual date" width={640} height={426} className="object-cover rounded-2xl max-w-xs md:max-w-sm" />
            </div>

            <div className="mt-6 flex justify-center gap-4">
              {[Mic, Video, Hangup].map((Icon, i) => (
                <button
                  key={i}
                  type="button"
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${i === 2 ? "bg-[oklch(0.55_0.18_25)] text-lpcream" : "bg-lppeach text-lpbg"}`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-20 grid gap-10 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={i}>
                <div className="lp-serif text-3xl italic text-lppeach">{`0${i + 1}`}</div>
                <h3 className="lp-display mt-3 text-2xl text-lpcream">{s.t}</h3>
                <p className="mt-3 leading-relaxed text-lpmuted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — Inside the room */}
      <section id="inside" className="mx-auto max-w-7xl px-6 py-28 md:py-36">
        <div className="max-w-3xl">
          <Eyebrow>{t("landing.inside.eyebrow")}</Eyebrow>
          <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">
            {t("landing.inside.title")}
          </h2>
          <p className="mt-6 text-lg text-lpmuted">{t("landing.inside.subtitle")}</p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[MessageCircleQuestion, Play, Music2, Zap, Camera, Flame, HelpCircle, MoreHorizontal].map((Icon, i) => {
            const card = { Icon, t: insideCards[i]?.t ?? "", d: insideCards[i]?.d ?? "" };
            const bgImages = [
              '/hero-virtual-date-rose-petals.png',
              '/image.png',
              '/lobby-mood-candlelit.png',
              '/lov/hero-candlelit.jpg',
              '/lov/friends-evening.jpg',
              '/lov/phone-code.jpg',
              '/premium-bg.png',
              '/lov/final-door.jpg',
            ];
            return (
              <article
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-lpborder p-6 transition-all duration-500 ease-in-out hover:scale-[1.03] hover:border-lppeach/40 hover:shadow-lg hover:shadow-lppeach/10"
                style={{
                  backgroundImage: `url(${bgImages[i % bgImages.length]})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Dark overlay — hides background image until hover */}
                <div
                  className="absolute inset-0 bg-lpcard opacity-[0.95] transition-opacity duration-500 ease-out group-hover:opacity-0"
                />
                {/* Gradient accent overlay */}
                <div
                  className="absolute inset-0 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-40"
                  style={{
                    background:
                      'linear-gradient(180deg, transparent 30%, oklch(0.12 0.02 40 / 0.85) 100%)',
                  }}
                />
                <div className="relative z-10">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-lppeach/30 bg-lppeach/15 transition-colors duration-500 group-hover:border-lppeach/60 group-hover:bg-lppeach/25">
                    <card.Icon className="h-5 w-5 text-lppeach" />
                  </div>
                  <h3 className="lp-display mt-8 text-2xl text-lpcream">{card.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-lpmuted transition-colors duration-500 group-hover:text-lpcream/90">{card.d}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Section 5 — One room. Every app. */}
      <section className="lp-vignette relative overflow-hidden border-y border-lpborder/40">
        <img src="/lov/phone-code.jpg" alt="A phone showing a 6-digit code by candlelight" width={1280} height={1280} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-28 md:py-40">
          <div className="max-w-2xl">
            <Eyebrow>{t("landing.oneRoom.eyebrow")}</Eyebrow>
            <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">{t("landing.oneRoom.title")}</h2>
            <p className="mt-8 text-lg leading-relaxed text-lpcream/85">
              {t("landing.oneRoom.p1")}
            </p>
            <p className="mt-5 text-lg leading-relaxed text-lpcream/85">
              {t("landing.oneRoom.p2")}
            </p>
            <div className="mt-10 flex gap-3 text-xs uppercase tracking-[0.25em] text-lpmuted">
              <span className="rounded-full border border-lpborder/60 px-3 py-1.5">Tinder</span>
              <span className="rounded-full border border-lpborder/60 px-3 py-1.5">Bumble</span>
              <span className="rounded-full border border-lpborder/60 px-3 py-1.5">Hinge</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6 — For couples */}
      <section id="couples" className="relative overflow-hidden">
        <img src="/premium-bg.png" alt="Warm morning light through curtains onto a rumpled bed" width={1920} height={1080} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, oklch(0.18 0.02 50 / 0.92) 0%, oklch(0.18 0.02 50 / 0.55) 60%, transparent 100%)" }} />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-28 md:py-40">
          <div className="max-w-xl">
            <Eyebrow>{t("landing.couples.eyebrow")}</Eyebrow>
            <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">{t("landing.couples.title")}</h2>
            <p className="mt-8 text-lg leading-relaxed text-lpcream/85">
              {t("landing.couples.body")}
            </p>
            <Link to={START} className="lp-btn mt-10">{t("landing.couples.cta")}</Link>
          </div>
        </div>
      </section>

      {/* Section 7 — For friends */}
      <section id="friends" className="relative overflow-hidden">
        <img src="/lov/friends-evening.jpg" alt="Cozy living room with a laptop showing a group video call" width={1920} height={1080} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(270deg, oklch(0.18 0.02 50 / 0.92) 0%, oklch(0.18 0.02 50 / 0.55) 60%, transparent 100%)" }} />
        <div className="relative z-10 mx-auto flex max-w-7xl justify-end px-6 py-28 md:py-40">
          <div className="max-w-xl">
            <Eyebrow>{t("landing.friends.eyebrow")}</Eyebrow>
            <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">{t("landing.friends.title")}</h2>
            <p className="mt-8 text-lg leading-relaxed text-lpcream/85">
              {t("landing.friends.body")}
            </p>
            <Link to={START} className="lp-btn mt-10">{t("landing.friends.cta")}</Link>
          </div>
        </div>
      </section>

      {/* Section 8 — Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{t("landing.pricing.eyebrow")}</Eyebrow>
          <h2 className="lp-display mt-5 text-4xl text-lpcream md:text-6xl">{t("landing.pricing.title")}</h2>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {[
            { name: t("landing.pricing.tryName"), price: TIER_PRICING.try.priceLabel, unit: t("landing.pricing.tryUnit"), desc: t("landing.pricing.tryDesc"), cta: t("landing.pricing.tryCta") },
            { name: t("landing.pricing.datePackName"), price: TIER_PRICING.date_pack.priceLabel, unit: TIER_PRICING.date_pack.unit!, desc: t("landing.pricing.datePackDesc"), cta: t("landing.pricing.datePackCta") },
            { name: t("landing.pricing.longPackName"), price: TIER_PRICING.long_pack.priceLabel, unit: TIER_PRICING.long_pack.unit!, desc: t("landing.pricing.longPackDesc"), cta: t("landing.pricing.longPackCta") },
          ].map((p) => (
            <PricingCard key={p.name} {...p} />
          ))}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <PricingCard
            name={t("landing.pricing.togetherName")}
            price={TIER_PRICING.together.priceLabel}
            unit={`${TIER_PRICING.together.priceSuffix ?? ""} · ${TIER_PRICING.together.unit}`}
            desc={t("landing.pricing.togetherDesc")}
            cta={t("landing.pricing.togetherCta")}
            featured
          />
          <PricingCard
            name={t("landing.pricing.crewName")}
            price={TIER_PRICING.crew.priceLabel}
            unit={`${TIER_PRICING.crew.priceSuffix ?? ""} · ${TIER_PRICING.crew.unit}`}
            desc={t("landing.pricing.crewDesc")}
            cta={t("landing.pricing.crewCta")}
            featured
          />
        </div>
      </section>

      {/* Section 9 — App badges */}
      <section className="mx-auto max-w-7xl px-6 pb-20 text-center">
        <p className="lp-serif text-2xl italic text-lpcream">{t("landing.badges.tagline")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {[
            { top: t("landing.badges.comingSoon"), bot: "App Store" },
            { top: t("landing.badges.comingSoon"), bot: "Google Play" },
          ].map((b) => (
            <div key={b.bot} className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-lpborder bg-lpcard/60 px-6 py-3 text-left opacity-70">
              <Sparkles className="h-6 w-6 text-lpmuted" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-lpmuted">{b.top}</div>
                <div className="lp-serif text-lg italic text-lpcream">{b.bot}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 10 — Trust strip */}
      <section className="border-y border-lpborder/40 bg-[oklch(0.14_0.012_40)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-8 text-sm text-lpcream/85">
          {[ShieldCheck, PhoneOff, KeyRound, Lock].map((Icon, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 text-lppeach" />
              <span>{trust[i]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 11 — Final CTA */}
      <section id="cta" className="lp-vignette relative overflow-hidden">
        <img src="/lov/final-door.jpg" alt="An open door with warm light spilling into a dark room" width={1920} height={1080} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-36 text-center md:py-48">
          <h2 className="lp-display text-5xl text-lpcream md:text-7xl">{t("landing.finalCta.title")}</h2>
          <p className="mt-8 text-lg text-lpcream/85">{t("landing.finalCta.subtitle")}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            <Link to={START} className="lp-btn">{t("landing.finalCta.create")}</Link>
            <Link to="/join" className="lp-link">{t("landing.finalCta.join")}</Link>
            <a href="#pricing" className="lp-link">{t("landing.finalCta.pricing")}</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-lpborder/40 bg-[oklch(0.13_0.01_40)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark size="text-2xl" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-lpmuted">
              {t("landing.footer.mission")}
            </p>
            <p className="lp-serif mt-5 italic text-lppeachsoft">{t("landing.footer.tagline")}</p>
          </div>

          <FooterCol
            title={t("landing.footer.product")}
            links={[t("landing.footer.productFeatures"), t("landing.footer.productPricing"), t("landing.footer.productHow")]}
          />
          <FooterCol
            title={t("landing.footer.company")}
            links={[t("landing.footer.companyAbout"), t("landing.footer.companyPrivacy"), t("landing.footer.companyTerms")]}
            hrefs={[undefined, "/privacy", "/terms"]}
          />
          <FooterCol
            title={t("landing.footer.connect")}
            links={["Twitter", "Instagram", t("landing.footer.connectContact")]}
            icons={[Twitter, Instagram, Mail]}
          />
        </div>
        <div className="border-t border-lpborder/40">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-lpmuted">
            <span>{t("landing.footer.copyright", { year: new Date().getFullYear() })}</span>
            <LandingLanguageMenu align="up" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function PricingCard({ name, price, unit, desc, cta, featured }: { name: string; price: string; unit: string; desc: string; cta: string; featured?: boolean }) {
  return (
    <div className={`relative flex flex-col rounded-2xl border p-7 ${featured ? "border-lppeach/40 bg-gradient-to-b from-[oklch(0.22_0.03_50)] to-lpcard" : "border-lpborder bg-lpcard"}`}>
      <div className="text-sm uppercase tracking-widest text-lppeach">{name}</div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="lp-display text-5xl text-lpcream">{price}</span>
        <span className="text-sm text-lpmuted">{unit}</span>
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-lpmuted">{desc}</p>
      <Link to={START} className="lp-btn mt-8 self-start text-sm">{cta}</Link>
    </div>
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
  /** Optional per-link hrefs. Internal SPA paths starting with "/" are routed
   *  via <Link>; anything else falls back to a placeholder anchor. */
  hrefs?: Array<string | undefined>;
}) {
  return (
    <div>
      <div className="lp-eyebrow !text-lpmuted">{title}</div>
      <ul className="mt-5 space-y-3 text-sm text-lpcream/85">
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
              {href && href.startsWith("/") ? (
                <Link
                  to={href}
                  className="inline-flex items-center gap-2 transition hover:text-lppeach"
                >
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
