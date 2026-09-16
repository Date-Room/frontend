import { Mic, Video, PhoneOff } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSection, LandingSectionHeader } from "@/components/landing/LandingPrimitives";

export function LandingHowSection({
  eyebrow,
  title,
  liveLabel,
  steps,
}: {
  eyebrow: string;
  title: string;
  liveLabel: string;
  steps: Array<{ t: string; d: string }>;
}) {
  return (
    <LandingSection id="how" dark>
      <LandingReveal>
        <LandingSectionHeader eyebrow={eyebrow} title={title} align="center" />
      </LandingReveal>

      <div className="mt-16 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-14">
        <LandingReveal>
          <ol className="lp-timeline space-y-0">
            {steps.map((step, i) => (
              <li key={step.t} className="lp-timeline__item relative flex gap-5 pb-10 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="lp-timeline__dot flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-lppeach/40 bg-lppeach/10 font-serif text-lg italic text-lppeach">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && <span className="lp-timeline__line mt-2 w-px flex-1 bg-gradient-to-b from-lppeach/40 to-transparent" />}
                </div>
                <div className="pt-1.5">
                  <h3 className="lp-display text-2xl text-lpcream md:text-3xl">{step.t}</h3>
                  <p className="mt-2 max-w-md text-base leading-relaxed text-lpmuted">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </LandingReveal>

        <LandingReveal delayMs={120}>
          <div className="lp-room-demo sticky top-24 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[oklch(0.11_0.01_40)] p-4 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.75)] md:p-5">
            <div className="flex items-center justify-between px-1 text-[11px] text-lpmuted">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500/80" />
                <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
              </div>
              <span className="font-mono tracking-[0.28em] text-lpcream/75">DATE ROOM</span>
              <span className="uppercase tracking-[0.18em] text-lppeach">{liveLabel}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <img src="/image copy.png" alt="" className="aspect-[4/3] rounded-xl object-cover" loading="lazy" />
              <img src="/image.png" alt="" className="aspect-[4/3] rounded-xl object-cover" loading="lazy" />
            </div>
            <div className="mt-4 flex justify-center gap-3">
              {[Mic, Video, PhoneOff].map((Icon, i) => (
                <span
                  key={i}
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${i === 2 ? "bg-red-500/25 text-red-200" : "bg-lppeach/20 text-lppeach"}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["Lobby", "Games", "Watch"].map((label) => (
                <span
                  key={label}
                  className="rounded-lg border border-white/8 bg-white/[0.03] py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-lpcream/70"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </LandingReveal>
      </div>
    </LandingSection>
  );
}
