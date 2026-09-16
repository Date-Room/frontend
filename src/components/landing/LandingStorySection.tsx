import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSection, LandingSectionHeader } from "@/components/landing/LandingPrimitives";

export function LandingStorySection({
  eyebrow,
  title,
  p1,
  p2,
  quote,
  stats,
}: {
  eyebrow: string;
  title: string;
  p1: string;
  p2: string;
  quote: string;
  stats: Array<{ n: string; l: string }>;
}) {
  return (
    <LandingSection>
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <LandingReveal>
          <LandingSectionHeader eyebrow={eyebrow} title={title} />
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-lpmuted">{p1}</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-lpmuted">{p2}</p>
          <blockquote className="lp-quote mt-10 border-l-2 border-lppeach/50 pl-5">
            <p className="lp-serif text-2xl italic leading-snug text-lppeachsoft md:text-3xl">{quote}</p>
          </blockquote>
        </LandingReveal>
        <LandingReveal delayMs={100}>
          <div className="lp-story-visual relative">
            <div className="lp-beam-border absolute -inset-px rounded-[2rem] opacity-50" aria-hidden />
            <img
              src="/hero-virtual-date-rose-petals.png"
              alt="Virtual date with rose petals on the table"
              width={900}
              height={900}
              loading="lazy"
              className="relative aspect-[4/5] w-full rounded-[2rem] object-cover shadow-[0_40px_100px_-40px_rgba(0,0,0,0.8)]"
            />
            <div className="lp-story-stat absolute bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
              <div className="grid grid-cols-3 gap-3 text-center">
                {stats.map((s) => (
                  <div key={s.l}>
                    <p className="lp-display text-2xl text-lpcream md:text-3xl">{s.n}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-lpmuted">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </LandingReveal>
      </div>
    </LandingSection>
  );
}
