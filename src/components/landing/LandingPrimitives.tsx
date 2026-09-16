import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LandingEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("lp-eyebrow", className)}>{children}</p>;
}

export function LandingSectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && <LandingEyebrow>{eyebrow}</LandingEyebrow>}
      <h2 className="lp-display mt-4 whitespace-pre-line text-4xl text-lpcream md:text-5xl lg:text-6xl">
        {title}
      </h2>
      {subtitle && (
        <p className={cn("mt-5 text-lg leading-relaxed text-lpmuted", align === "center" && "mx-auto")}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function LandingSection({
  id,
  children,
  className,
  dark,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "lp-section relative px-6 py-20 md:py-28",
        dark && "lp-section--dark border-y border-lpborder/30",
        className,
      )}
    >
      <div className="relative z-10 mx-auto max-w-7xl">{children}</div>
    </section>
  );
}
