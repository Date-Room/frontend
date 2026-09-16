import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { LandingParticleCanvas } from "@/components/landing/LandingParticleCanvas";
import { ShimmerButton } from "@/components/landing/ShimmerButton";

type LandingHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  tagline: string;
  createLabel: string;
  seeHowLabel: string;
  gotCodeLabel: string;
  joinLabel: string;
  startHref: string;
};

export function LandingHero({
  eyebrow,
  title,
  subtitle,
  tagline,
  createLabel,
  seeHowLabel,
  gotCodeLabel,
  joinLabel,
  startHref,
}: LandingHeroProps) {
  return (
    <section className="lp-hero relative min-h-[min(100dvh,920px)] overflow-hidden">
      <img
        src="/lov/hero-candlelit.jpg"
        alt=""
        aria-hidden
        width={1920}
        height={1280}
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-45 animate-ken-burns motion-reduce:animate-none motion-reduce:scale-100 motion-reduce:opacity-35"
      />
      <div className="lp-hero__mesh pointer-events-none absolute inset-0" aria-hidden />
      <LandingParticleCanvas className="z-[2] opacity-90 mix-blend-screen" />
      <div className="lp-hero__vignette pointer-events-none absolute inset-0 z-[3]" aria-hidden />

      <div className="relative z-10 mx-auto grid min-h-[min(100dvh,920px)] max-w-7xl items-center gap-10 px-6 py-24 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div className="lp-hero__copy max-w-xl">
          <p className="lp-eyebrow lp-hero__stagger lp-hero__stagger-1">{eyebrow}</p>
          <h1 className="lp-display lp-hero__stagger lp-hero__stagger-2 mt-5 whitespace-pre-line text-5xl text-lpcream md:text-6xl lg:text-7xl xl:text-[4.5rem]">
            {title}
          </h1>
          <p className="lp-hero__stagger lp-hero__stagger-3 mt-6 max-w-lg text-lg leading-relaxed text-lpcream/88 md:text-xl">
            {subtitle}
          </p>
          <p className="lp-serif lp-hero__stagger lp-hero__stagger-4 mt-4 text-xl italic text-lppeachsoft md:text-2xl">
            {tagline}
          </p>
          <div className="lp-hero__stagger lp-hero__stagger-5 mt-9 flex flex-wrap items-center gap-4">
            <ShimmerButton to={startHref}>{createLabel}</ShimmerButton>
            <a href="#how" className="lp-link inline-flex items-center gap-1.5">
              {seeHowLabel}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
          </div>
          <p className="lp-hero__stagger lp-hero__stagger-6 mt-5 text-[15px] text-lpmuted">
            {gotCodeLabel}{" "}
            <Link to="/join" className="lp-link">
              {joinLabel}
            </Link>
          </p>
        </div>

        <div className="lp-hero__visual lp-hero__stagger lp-hero__stagger-4 relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="lp-hero__orb lp-hero__orb--a" aria-hidden />
          <div className="lp-hero__orb lp-hero__orb--b" aria-hidden />
          <div className="lp-glass lp-hero__device relative overflow-hidden rounded-[1.75rem] border border-white/12 p-3 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.75)]">
            <div className="lp-beam-border pointer-events-none absolute inset-0 rounded-[1.75rem]" aria-hidden />
            <div className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/40">
              <img
                src="/image.png"
                alt="Two people on a video date in DateRoom"
                width={640}
                height={426}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-4 pt-16">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
                    Live room
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.28em] text-lpcream/70">5S75JZ</span>
                </div>
                <p className="lp-serif mt-2 text-lg italic text-lpcream">Your private room is ready</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 px-2 pb-1">
              {["Questions", "Watch", "Music"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-lpcream/75"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="lp-hero__float-badge absolute -left-2 top-8 hidden rounded-2xl border border-lppeach/30 bg-black/50 px-3 py-2 backdrop-blur-md sm:flex sm:items-center sm:gap-2">
            <Sparkles className="h-4 w-4 text-lppeach" aria-hidden />
            <span className="text-xs text-lpcream/90">No phone numbers</span>
          </div>
        </div>
      </div>
    </section>
  );
}
