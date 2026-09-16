import { LandingReveal } from "@/components/landing/LandingReveal";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LandingSectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <LandingReveal
      className={cn(
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl",
        className,
      )}
    >
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 className="lp-display mt-4 text-4xl text-lpcream md:text-5xl lg:text-6xl">{title}</h2>
      {subtitle ? (
        <p className="mt-5 text-base leading-relaxed text-lpmuted md:text-lg">{subtitle}</p>
      ) : null}
    </LandingReveal>
  );
}
