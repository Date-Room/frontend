import { AMBIANCE_PRESETS } from "@/lib/ambiance";
import { LOBBY_PREVIEW_SCENES } from "@/lib/lobbyPreviewScenes";
import { moodSwatchGradient } from "@/lib/moodVisuals";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSection, LandingSectionHeader } from "@/components/landing/LandingPrimitives";

export function LandingMoodsSection({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <LandingSection dark className="overflow-hidden">
      <LandingReveal>
        <LandingSectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} align="center" />
      </LandingReveal>

      <div className="lp-mood-rail mt-12 -mx-6 flex gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4">
        {AMBIANCE_PRESETS.map((mood, i) => {
          const scene = LOBBY_PREVIEW_SCENES[mood.id];
          return (
            <LandingReveal key={mood.id} delayMs={i * 50}>
              <figure className="lp-mood-card group w-[72vw] shrink-0 overflow-hidden rounded-2xl border border-white/10 md:w-auto">
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={scene.src}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    style={{ objectPosition: scene.objectPosition }}
                  />
                  <div
                    className="absolute inset-0 opacity-80"
                    style={{ background: moodSwatchGradient(mood.id) }}
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                    <span className="text-xl" aria-hidden>
                      {mood.emoji}
                    </span>
                    <p className="lp-serif mt-1 text-lg italic text-lpcream">{mood.label}</p>
                    <p className="mt-0.5 text-xs text-lpcream/70">{mood.hint}</p>
                  </figcaption>
                </div>
              </figure>
            </LandingReveal>
          );
        })}
      </div>
    </LandingSection>
  );
}
