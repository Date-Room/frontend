import { ShimmerButton } from "@/components/landing/ShimmerButton";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSection } from "@/components/landing/LandingPrimitives";

export function LandingAudiencesSection({
  couples,
  friends,
  startHref,
}: {
  couples: { eyebrow: string; title: string; body: string; cta: string };
  friends: { eyebrow: string; title: string; body: string; cta: string };
  startHref: string;
}) {
  return (
    <LandingSection id="couples" className="!pb-12">
      <div className="grid gap-5 lg:grid-cols-2">
        <LandingReveal>
          <article id="couples" className="lp-audience-card group relative min-h-[22rem] overflow-hidden rounded-[1.75rem] border border-white/10">
            <img
              src="/premium-bg.png"
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0608]/95 via-[#0a0608]/50 to-[#0a0608]/20" />
            <div className="relative z-10 flex h-full flex-col justify-end p-8 md:p-10">
              <p className="lp-eyebrow">{couples.eyebrow}</p>
              <h3 className="lp-display mt-3 text-3xl text-lpcream md:text-4xl">{couples.title}</h3>
              <p className="mt-4 max-w-md text-base leading-relaxed text-lpcream/85">{couples.body}</p>
              <ShimmerButton to={startHref} className="mt-8 self-start">
                {couples.cta}
              </ShimmerButton>
            </div>
          </article>
        </LandingReveal>
        <LandingReveal delayMs={80}>
          <article id="friends" className="lp-audience-card group relative min-h-[22rem] overflow-hidden rounded-[1.75rem] border border-white/10">
            <img
              src="/lov/friends-evening.jpg"
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0608]/95 via-[#0a0608]/50 to-[#0a0608]/20" />
            <div className="relative z-10 flex h-full flex-col justify-end p-8 md:p-10">
              <p className="lp-eyebrow">{friends.eyebrow}</p>
              <h3 className="lp-display mt-3 text-3xl text-lpcream md:text-4xl">{friends.title}</h3>
              <p className="mt-4 max-w-md text-base leading-relaxed text-lpcream/85">{friends.body}</p>
              <ShimmerButton to={startHref} className="mt-8 self-start">
                {friends.cta}
              </ShimmerButton>
            </div>
          </article>
        </LandingReveal>
      </div>
    </LandingSection>
  );
}
