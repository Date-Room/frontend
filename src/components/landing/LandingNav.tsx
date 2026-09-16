import type { ReactNode } from "react";
import { LandingJoinMenu } from "@/components/LandingJoinMenu";
import { LandingLanguageMenu } from "@/components/LandingLanguageMenu";
import { ShimmerButton } from "@/components/landing/ShimmerButton";

function Wordmark() {
  return (
    <a href="#top" className="group flex items-center gap-2.5">
      <img
        src="/dateroom-logo.png"
        alt="DateRoom"
        width={32}
        height={32}
        className="h-8 w-8 rounded-md object-contain transition group-hover:scale-105"
      />
      <span className="lp-serif text-xl italic tracking-tight text-lpcream">DateRoom</span>
    </a>
  );
}

export function LandingNav({
  banner,
  links,
  loginLabel,
  startHref,
}: {
  banner: ReactNode;
  links: { href: string; label: string }[];
  loginLabel: string;
  startHref: string;
}) {
  return (
    <>
      <a
        href="#couples"
        className="block w-full border-b border-lpborder/30 bg-[oklch(0.11_0.012_40)]"
      >
        <div className="mx-auto max-w-7xl px-6 py-2 text-center text-[12px] text-lpmuted">
          {banner}
        </div>
      </a>
      <header className="lp-nav sticky top-0 z-50 border-b border-white/[0.06]">
        <nav className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-6">
          <Wordmark />
          <ul className="hidden items-center gap-7 text-[13px] text-lpmuted lg:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition hover:text-lpcream">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 sm:gap-3">
            <LandingLanguageMenu className="hidden sm:block" iconOnly />
            <LandingJoinMenu className="hidden md:block" />
            <ShimmerButton to={startHref} className="!px-4 !py-2 text-xs sm:!px-5 sm:text-sm">
              {loginLabel}
            </ShimmerButton>
          </div>
        </nav>
      </header>
    </>
  );
}
