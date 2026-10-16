import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { type ReactNode } from "react";
import { ShieldCheck, Smartphone, Play } from "lucide-react";
import { TIER_PRICING } from "@/lib/tierPricing";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appStores";
import { SeoHead } from "@/components/SeoHead";
import { LANDING_JSON_LD, LANDING_SEO } from "@/lib/seo";
import { LandingLanguageMenu } from "@/components/LandingLanguageMenu";
import { LandingJoinMenu } from "@/components/LandingJoinMenu";

/**
 * Marketing landing, v2 (Oct 2026): "Every room is a date."
 *
 * Three equal kinds of date (first date, date night, a night in with your
 * people) drawn as invitations, with the real room shown in the hero. Art
 * comes from the in-room tiles (public/dock-tiles) so the page shows the
 * product, not stock photography. Copy lives under `landing2` in en.json;
 * other locales fall back to English until translated.
 *
 * Facts the copy must keep true: every room has a 6-character code AND a
 * 4-digit PIN; no end-to-end encryption; no ads; the apps are live; Chaperon
 * is live (Protect free once, Coach in beta); Squad is a request-access beta.
 */

const START = "/auth"; // sign-in funnels every room/purchase action
const JOIN = "/join";
const SQUAD = "/squad";

const TRAY = ["questions", "the-36", "this-or-that", "watch", "dj", "guacamole"];
const TRAY_NAMES = ["The Deck", "The 36", "This or That", "Watch", "DJ", "Guacamole"];
const PROGRAMME = ["questions", "the-36", "this-or-that", "truth-or-dare", "2-truths", "rank-it", "pick-a-door", "guacamole", "most-likely", "imposter"];
const INVITE_ART = ["the-36", "fridge-notes", "most-likely"];
const INVITE_TILT = ["md:-rotate-2", "md:rotate-1", "md:-rotate-1"];
const INVITE_CTA = [START, START, SQUAD];

const tile = (id: string) => `/dock-tiles/${id}.webp`;

type InviteCard = {
  to: string; what: string; when: string; bring: string; note: string;
  admit: string; terms: string; code: string; pin: string; cta: string; alt: string;
};
type Tile = { name: string; line: string };
type Step = { n: string; t: string; d: string };
type Plan = { group: string; name: string; unit: string; cta: string; price?: string };

function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`lp-eyebrow ${className}`}>{children}</p>;
}

function Wordmark() {
  return (
    <a href="#top" className="flex items-center gap-2.5">
      <img src="/dateroom-logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-md object-contain" />
      <span className="lp-serif text-2xl italic tracking-tight text-lpcream">DateRoom</span>
    </a>
  );
}

function ReceivedLink({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Link to={JOIN} className={`text-[15px] text-lpcream ${className}`}>
      {t("landing2.hero.received")}{" "}
      <span className="text-lppeach underline decoration-lppeach/50 underline-offset-4">{t("landing2.hero.enterCode")}</span>
    </Link>
  );
}

/** The room as it looks mid-date: faces, a deck card between them, the tray. */
function RoomPreview() {
  const { t } = useTranslation();
  return (
    <figure className="m-0">
      <div className="rounded-[22px] border border-lpborder bg-lpcard p-3 shadow-[0_40px_80px_rgba(0,0,0,0.5)] sm:p-4">
        <div className="flex items-center gap-2.5 px-1 pb-3 text-[13px]">
          <span className="h-2 w-2 rounded-full bg-[#7fd18b]" aria-hidden />
          <span className="text-[#d8cbbd]">{t("landing2.hero.roomWith")}</span>
          <span className="text-[#b3a89f]">· {t("landing2.hero.roomLeft")}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#4a3a31] bg-[#2a1f1a] px-2.5 py-1 text-lppeachsoft">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t("landing2.hero.chaperonOn")}
          </span>
        </div>
        <div className="flex gap-2.5 sm:gap-3">
          <img src="/lov/room-face-a.jpg" alt="" width={640} height={427} className="hidden aspect-[3/4] w-[34%] rounded-2xl object-cover sm:block" />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 rounded-2xl bg-[radial-gradient(circle_at_50%_30%,#3a2a20,#211813)] p-5 sm:p-6">
            <Eyebrow className="!text-[11px]">{t("landing2.hero.deckLabel")}</Eyebrow>
            <p className="lp-serif text-xl italic leading-snug text-lpcream sm:text-[26px]">{t("landing2.hero.deckQuestion")}</p>
            <div className="flex gap-2 text-[13px]">
              <span className="rounded-full bg-lpcream px-3 py-1.5 font-semibold text-[#1a0f0a]">{t("landing2.hero.next")}</span>
              <span className="rounded-full border border-[#5a4b42] px-3 py-1.5 text-[#d8cbbd]">{t("landing2.hero.skip")}</span>
            </div>
          </div>
          <img src="/lov/room-face-b.jpg" alt="" width={540} height={360} className="hidden aspect-[3/4] w-[26%] self-end rounded-2xl object-cover sm:block" />
        </div>
        <div className="mt-3 grid grid-cols-6 gap-2 sm:gap-2.5">
          {TRAY.map((id, i) => (
            <div key={id} className="min-w-0 text-center">
              <img src={tile(id)} alt="" width={512} height={512} loading="lazy" className="aspect-square w-full rounded-[10px] border border-lpborder object-cover" />
              <div className="mt-1 truncate text-[11px] text-[#b3a89f]">{TRAY_NAMES[i]}</div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[13px] text-[#b3a89f]">{t("landing2.hero.caption")}</figcaption>
    </figure>
  );
}

function Invitation({ card, art, tilt }: { card: InviteCard; art: string; tilt: string }) {
  const { t } = useTranslation();
  return (
    <article className={`w-full overflow-hidden rounded-[10px] bg-lpcream text-[#2a1d15] shadow-[0_30px_60px_rgba(0,0,0,0.55)] ${tilt}`}>
      <img src={tile(art)} alt={card.alt} width={512} height={512} loading="lazy" className="h-40 w-full object-cover md:h-48" />
      <div className="px-6 pb-5 pt-6 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-[#6e5646]">{t("landing2.invites.to")}</div>
        <div className="lp-serif mt-1 text-2xl italic">{card.to}</div>
        <div className="mt-3 text-sm text-[#5a4636]">{t("landing2.invites.invited")}</div>
        <div className="lp-serif text-[34px] font-medium italic leading-tight">{card.what}</div>
        <div className="mx-auto my-4 h-px w-12 bg-[#b89c86]" aria-hidden />
        <div className="text-[15px] text-[#3b2c22]">{card.when}</div>
        <div className="mt-4 text-xs uppercase tracking-[0.3em] text-[#6e5646]">{t("landing2.invites.bring")}</div>
        <div className="mt-1 text-[15px] text-[#3b2c22]">{card.bring}</div>
        <div className="lp-serif mt-3 text-base italic text-[#7a4a2a]">{card.note}</div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-[#c9b3a0] px-6 py-4 text-left">
        <div className="text-xs uppercase leading-relaxed tracking-[0.16em] text-[#5a4636]">
          {card.admit}
          <br />
          {card.terms}
        </div>
        <div className="text-right font-mono text-[#2a1d15]">
          <div className="text-lg tracking-[0.12em]">{card.code}</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#6e5646]">{t("landing2.invites.pin")} {card.pin}</div>
        </div>
      </div>
    </article>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const invites = t("landing2.invites.cards", { returnObjects: true }) as InviteCard[];
  const tiles = t("landing2.programme.tiles", { returnObjects: true }) as Tile[];
  const steps = t("landing2.how.steps", { returnObjects: true }) as Step[];
  const plans = t("landing2.pricing.plans", { returnObjects: true }) as Plan[];
  const planPrices = [
    TIER_PRICING.try.priceLabel,
    TIER_PRICING.date_pack.priceLabel,
    TIER_PRICING.long_pack.priceLabel,
    TIER_PRICING.together.priceLabel,
    plans[4]?.price ?? "",
  ];
  const planLinks = [START, START, START, START, SQUAD];

  return (
    <div id="top" className="lp min-h-screen overflow-x-hidden bg-lpbg text-lpcream">
      <SeoHead
        title={LANDING_SEO.title}
        description={LANDING_SEO.description}
        canonical={LANDING_SEO.canonical}
        ogImage={LANDING_SEO.ogImage}
        ogImageAlt={LANDING_SEO.ogImageAlt}
        themeColor={LANDING_SEO.themeColor}
        jsonLd={LANDING_JSON_LD}
      />

      <header className="sticky top-0 z-40 border-b border-lpborder/40 bg-lpbg/80 backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Wordmark />
          <ul className="hidden flex-1 items-center gap-7 text-sm text-[#d8cbbd] lg:flex">
            <li><a href="#dates" className="transition hover:text-lpcream">{t("landing2.nav.dates")}</a></li>
            <li><a href="#programme" className="transition hover:text-lpcream">{t("landing2.nav.inside")}</a></li>
            <li><a href="#chaperon" className="transition hover:text-lpcream">{t("landing2.nav.chaperon")}</a></li>
            <li><a href="#pricing" className="transition hover:text-lpcream">{t("landing2.nav.pricing")}</a></li>
          </ul>
          <div className="ml-auto flex items-center gap-3">
            <LandingLanguageMenu className="hidden sm:block" iconOnly />
            <LandingJoinMenu className="hidden md:block" />
            <Link to={START} className="px-2 py-3 text-sm text-[#d8cbbd] transition hover:text-lpcream">{t("landing2.nav.login")}</Link>
            <Link to={START} className="lp-btn hidden !px-5 !py-2.5 text-sm sm:inline-flex">{t("landing2.nav.write")}</Link>
          </div>
        </nav>
      </header>

      {/* Hero: the promise, and the real room beside it */}
      <section className="mx-auto flex max-w-7xl flex-wrap items-center gap-12 px-4 pb-20 pt-12 sm:px-6 md:pt-20 lg:flex-nowrap lg:gap-14">
        <div className="min-w-0 basis-full lg:basis-[44%]">
          <Eyebrow>{t("landing2.hero.eyebrow")}</Eyebrow>
          <h1 className="lp-display mt-5 whitespace-pre-line text-[54px] text-lpcream md:text-7xl lg:text-[84px]">
            {t("landing2.hero.title")}
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[#e4d8ca] md:text-xl">{t("landing2.hero.subtitle")}</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link to={START} className="lp-btn">{t("landing2.hero.write")}</Link>
            <ReceivedLink className="py-2 text-center sm:text-left" />
          </div>
          <p className="mt-6 text-sm text-[#b3a89f]">{t("landing2.hero.fine")}</p>
        </div>
        <div className="min-w-0 basis-full lg:basis-[56%]">
          <RoomPreview />
        </div>
      </section>

      {/* Three kinds of date, as invitations */}
      <section id="dates" className="scroll-mt-16 border-y border-lpborder bg-[#170f0c]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 md:py-28">
          <Eyebrow>{t("landing2.invites.eyebrow")}</Eyebrow>
          <h2 className="lp-display mt-4 text-5xl text-lpcream md:text-6xl">{t("landing2.invites.title")}</h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] text-[#e4d8ca] md:text-lg">{t("landing2.invites.subtitle")}</p>
          <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
            {invites.map((card, i) => (
              <div key={card.to} className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-5">
                <Invitation card={card} art={INVITE_ART[i]} tilt={INVITE_TILT[i]} />
                <Link to={INVITE_CTA[i]} className="py-2 text-[15px] font-semibold text-lppeach hover:text-lppeachsoft">{card.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you do inside */}
      <section id="programme" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-20 sm:px-6 md:py-28">
        <div className="text-center">
          <Eyebrow>{t("landing2.programme.eyebrow")}</Eyebrow>
          <h2 className="lp-serif mt-4 text-4xl text-lpcream md:text-[54px] md:leading-tight">
            {t("landing2.programme.title")} <span className="italic">{t("landing2.programme.titleItalic")}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] text-[#e4d8ca] md:text-lg">{t("landing2.programme.subtitle")}</p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-5">
          {tiles.map((tl, i) => (
            <figure key={tl.name} className="m-0">
              <img src={tile(PROGRAMME[i])} alt="" width={512} height={512} loading="lazy" className="aspect-square w-full rounded-2xl border border-lpborder object-cover" />
              <figcaption className="mt-3">
                <div className="lp-serif text-lg italic text-lpcream md:text-xl">{tl.name}</div>
                <div className="mt-0.5 text-[13px] text-[#b3a89f] md:text-sm">{tl.line}</div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="lp-serif mx-auto mt-10 max-w-2xl text-center text-lg italic text-[#e4d8ca] md:text-xl">{t("landing2.programme.also")}</p>
      </section>

      {/* Chaperon */}
      <section id="chaperon" className="scroll-mt-16 border-y border-lpborder bg-[#170f0c]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-12 px-4 py-20 sm:px-6 md:py-28 lg:flex-nowrap">
          <div className="min-w-0 basis-full lg:basis-1/2">
            <Eyebrow>{t("landing2.chaperon.eyebrow")}</Eyebrow>
            <h2 className="lp-display mt-4 text-4xl text-lpcream md:text-[54px]">{t("landing2.chaperon.title")}</h2>
            <p className="mt-6 text-[17px] leading-relaxed text-[#e4d8ca] md:text-lg">{t("landing2.chaperon.body")}</p>
            <dl className="mt-7 space-y-4">
              <div className="flex items-baseline gap-4">
                <dt className="shrink-0 rounded-md bg-lppeach px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-[#1a0f0a]">{t("landing2.chaperon.protect")}</dt>
                <dd className="m-0 text-[#e4d8ca]">{t("landing2.chaperon.protectBody")}</dd>
              </div>
              <div className="flex items-baseline gap-4">
                <dt className="shrink-0 rounded-md border border-[#5a4b42] px-2.5 py-0.5 text-xs uppercase tracking-[0.16em] text-lppeachsoft">{t("landing2.chaperon.coach")}</dt>
                <dd className="m-0 text-[#e4d8ca]">{t("landing2.chaperon.coachBody")}</dd>
              </div>
            </dl>
            <p className="mt-8 text-[15px] text-[#b3a89f]">{t("landing2.chaperon.also")}</p>
          </div>
          <div className="flex min-w-0 basis-full flex-col gap-3.5 lg:basis-1/2">
            <div className="rounded-[18px] border border-lpborder bg-lpcard p-6">
              <div className="flex items-center gap-2 text-[13px] text-lppeachsoft">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {t("landing2.chaperon.noteLabel")}
                <span className="ml-auto rounded-full border border-[#4a3a31] px-2 py-0.5 text-[11px] text-[#b3a89f]">{t("landing2.chaperon.example")}</span>
              </div>
              <p className="mt-3 text-lg leading-relaxed text-lpcream">{t("landing2.chaperon.noteBody")}</p>
            </div>
            <div className="rounded-[18px] border border-lpborder bg-lpcard p-5 sm:ml-12">
              <div className="text-[13px] text-[#b3a89f]">{t("landing2.chaperon.seesLabel")}</div>
              <p className="mt-2 text-base text-[#e4d8ca]">{t("landing2.chaperon.seesBody")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
        <h2 className="lp-serif text-3xl text-lpcream md:text-[44px] md:leading-tight">
          {t("landing2.how.title")} <span className="italic">{t("landing2.how.titleItalic")}</span>
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-[#5a4b42] pt-5">
              <div className="lp-serif text-xl italic text-lppeach">{s.n}</div>
              <div className="mt-1.5 text-xl text-lpcream">{s.t}</div>
              <p className="mt-2 text-base text-[#b3a89f]">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 border-t border-lpborder bg-[#170f0c]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="lp-serif text-4xl text-lpcream md:text-[54px] md:leading-tight">
              {t("landing2.pricing.title")} <span className="italic">{t("landing2.pricing.titleItalic")}</span>
            </h2>
            <p className="max-w-md text-sm text-[#b3a89f]">{t("landing2.pricing.note")}</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
            {plans.map((p, i) => (
              <Link
                key={p.name}
                to={planLinks[i]}
                className={`flex items-center gap-4 rounded-2xl border bg-lpcard p-5 transition hover:border-[#7a5a45] lg:flex-col lg:items-start lg:gap-2.5 lg:p-6 ${i === 3 ? "border-[#7a5a45]" : "border-lpborder"}`}
              >
                <span className="min-w-0 flex-1 lg:flex-none">
                  <span className="block text-[11px] uppercase tracking-[0.18em] text-[#b3a89f]">{p.group}</span>
                  <span className="block text-lg text-lpcream">{p.name}</span>
                  <span className="block text-sm text-[#b3a89f] lg:hidden">{p.unit}</span>
                </span>
                <span className="lp-serif text-3xl text-lpcream lg:text-[44px] lg:leading-none">{planPrices[i]}</span>
                <span className="hidden flex-1 text-sm text-[#b3a89f] lg:block">{p.unit}</span>
                <span className="hidden text-[15px] font-semibold text-lppeach lg:block">{p.cta}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="bg-[radial-gradient(ellipse_at_50%_0%,#3a2418_0%,#120c09_70%)]">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 md:py-32">
          <h2 className="lp-display text-5xl text-lpcream md:text-7xl">{t("landing2.final.title")}</h2>
          <p className="mt-5 text-[17px] text-[#e4d8ca] md:text-lg">{t("landing2.final.subtitle")}</p>
          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
            <Link to={START} className="lp-btn">{t("landing2.hero.write")}</Link>
            <ReceivedLink className="py-2" />
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl border border-[#5a4b42] px-4 py-2.5 text-left text-lpcream transition hover:border-lppeach">
              <Smartphone className="h-5 w-5" aria-hidden />
              <span className="leading-tight"><span className="block text-[11px] text-[#b3a89f]">{t("landing2.final.appStoreTop")}</span>App Store</span>
            </a>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl border border-[#5a4b42] px-4 py-2.5 text-left text-lpcream transition hover:border-lppeach">
              <Play className="h-5 w-5" aria-hidden />
              <span className="leading-tight"><span className="block text-[11px] text-[#b3a89f]">{t("landing2.final.googleTop")}</span>Google Play</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-lpborder">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-12 text-[15px] sm:px-6 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="lp-serif text-2xl italic text-lpcream">DateRoom</div>
            <p className="mt-2 text-[#b3a89f]">{t("landing2.footer.tagline")}</p>
          </div>
          <ul className="space-y-2">
            <li><a href="#dates" className="text-[#d8cbbd] hover:text-lpcream">{t("landing2.footer.dates")}</a></li>
            <li><a href="#pricing" className="text-[#d8cbbd] hover:text-lpcream">{t("landing2.footer.pricing")}</a></li>
            <li><Link to="/support" className="text-[#d8cbbd] hover:text-lpcream">{t("landing2.footer.help")}</Link></li>
          </ul>
          <ul className="space-y-2">
            <li><Link to="/child-safety" className="text-[#d8cbbd] hover:text-lpcream">{t("landing2.footer.safety")}</Link></li>
            <li><Link to="/privacy" className="text-[#d8cbbd] hover:text-lpcream">{t("landing2.footer.privacy")}</Link></li>
            <li><Link to="/terms" className="text-[#d8cbbd] hover:text-lpcream">{t("landing2.footer.terms")}</Link></li>
          </ul>
          <ul className="space-y-2">
            <li><a href="mailto:support@dateroom.io" className="text-[#d8cbbd] hover:text-lpcream">{t("landing2.footer.contact")}</a></li>
            <li><LandingLanguageMenu align="up" /></li>
          </ul>
        </div>
        <div className="border-t border-lpborder/60">
          <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-[#b3a89f] sm:px-6">
            {t("landing2.footer.copyright", { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </div>
  );
}
