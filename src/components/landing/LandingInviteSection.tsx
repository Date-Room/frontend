import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSection, LandingSectionHeader } from "@/components/landing/LandingPrimitives";

export function LandingInviteSection({
  eyebrow,
  title,
  p1,
  p2,
}: {
  eyebrow: string;
  title: string;
  p1: string;
  p2: string;
}) {
  return (
    <LandingSection className="lp-invite-section overflow-hidden !py-0">
      <div className="relative min-h-[28rem] md:min-h-[32rem]">
        <img
          src="/lov/phone-code.jpg"
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0608]/95 via-[#0a0608]/75 to-[#0a0608]/40" />
        <div className="relative z-10 grid min-h-[28rem] items-center gap-10 py-20 md:min-h-[32rem] md:grid-cols-2 md:py-28">
          <LandingReveal>
            <LandingSectionHeader eyebrow={eyebrow} title={title} />
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-lpcream/85">{p1}</p>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-lpcream/75">{p2}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Tinder", "Bumble", "Hinge", "IRL"].map((app) => (
                <span
                  key={app}
                  className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lpcream/80"
                >
                  {app}
                </span>
              ))}
            </div>
          </LandingReveal>
          <LandingReveal delayMs={120}>
            <div className="lp-code-card mx-auto w-full max-w-sm rounded-[1.5rem] border border-lppeach/30 bg-black/50 p-6 backdrop-blur-xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-lppeach">Your invite</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-lpmuted">Room ID</p>
                  <p className="mt-1 font-mono text-xl tracking-[0.2em] text-lpcream">5S75JZ</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-lpmuted">PIN</p>
                  <p className="mt-1 font-mono text-xl tracking-[0.2em] text-lppeach">0468</p>
                </div>
              </div>
              <p className="mt-4 break-all text-xs leading-relaxed text-lpmuted">
                dateroom.app/i/5S75JZ/0468
              </p>
            </div>
          </LandingReveal>
        </div>
      </div>
    </LandingSection>
  );
}
