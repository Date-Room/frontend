import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Premium CTA with Originkit-style shimmer sweep on hover. */
export function ShimmerButton({
  to,
  href,
  children,
  className,
  variant = "primary",
}: {
  to?: string;
  href?: string;
  children: ReactNode;
  className?: string;
  variant?: "primary" | "ghost";
}) {
  const cls = cn(
    "lp-shimmer-btn group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold transition",
    variant === "primary"
      ? "bg-lppeach text-lpbg shadow-[0_16px_48px_-12px_oklch(0.72_0.12_55_/_0.55)]"
      : "border border-white/15 bg-white/[0.04] text-lpcream backdrop-blur-md hover:bg-white/[0.08]",
    className,
  );
  const inner = (
    <>
      {variant === "primary" && <span className="lp-shimmer-btn__shine" aria-hidden />}
      <span className="relative z-[1]">{children}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <a href={href ?? "#"} className={cls}>
      {inner}
    </a>
  );
}
