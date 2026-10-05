import type { LucideIcon } from "lucide-react";
import {
  MessageCircleQuestion,
  Play,
  Music2,
  Zap,
  Camera,
  Flame,
  HelpCircle,
  MoreHorizontal,
} from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSection, LandingSectionHeader } from "@/components/landing/LandingPrimitives";

const BENTO_LAYOUT: { span: string; icon: LucideIcon; image: string }[] = [
  { span: "lg:col-span-2 lg:row-span-2", icon: Zap, image: "/lobby-cards/play-a-game.webp" },
  { span: "lg:col-span-1", icon: Play, image: "/lobby-cards/watch-together.webp" },
  { span: "lg:col-span-1", icon: Music2, image: "/lobby-cards/listen-together.webp" },
  { span: "lg:col-span-1", icon: MessageCircleQuestion, image: "/lobby-cards/just-talk.webp" },
  { span: "lg:col-span-1", icon: HelpCircle, image: "/dock-tiles/the-36.webp" },
  { span: "lg:col-span-1", icon: Flame, image: "/dock-tiles/truth-or-dare.webp" },
  { span: "lg:col-span-1", icon: Camera, image: "/lobby-cards/photo-booth.webp" },
  { span: "lg:col-span-2", icon: MoreHorizontal, image: "/lobby-cards/vision-board.webp" },
];

export function LandingBentoSection({
  eyebrow,
  title,
  subtitle,
  cards,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: Array<{ t: string; d: string }>;
}) {
  return (
    <LandingSection id="inside">
      <LandingReveal>
        <LandingSectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </LandingReveal>

      <div className="lp-bento mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(140px,auto)]">
        {cards.map((card, i) => {
          const layout = BENTO_LAYOUT[i] ?? BENTO_LAYOUT[0];
          const Icon = layout.icon;
          return (
            <LandingReveal key={card.t} delayMs={i * 40}>
              <article
                className={`lp-bento__card group relative flex h-full min-h-[160px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] p-5 ${layout.span}`}
              >
                <img
                  src={layout.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-35 transition duration-700 group-hover:scale-105 group-hover:opacity-55"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0608]/95 via-[#0a0608]/55 to-[#0a0608]/25" />
                <div className="relative z-10 mt-auto">
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-lppeach/30 bg-lppeach/10">
                    <Icon className="h-5 w-5 text-lppeach" />
                  </span>
                  <h3 className="lp-display text-xl text-lpcream md:text-2xl">{card.t}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-lpcream/75">{card.d}</p>
                </div>
              </article>
            </LandingReveal>
          );
        })}
      </div>
    </LandingSection>
  );
}
