import * as React from "react";

/** Tailwind-aligned breakpoints. The hooks below mirror these so the
 *  same JS-side decisions stay in lockstep with the CSS-side `md:` /
 *  `lg:` variants used throughout the app. */
const MOBILE_BREAKPOINT = 768; // md:
const DESKTOP_BREAKPOINT = 1024; // lg:

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/** True at Tailwind's `lg:` breakpoint and above (≥1024px). Use to
 *  decide between mobile-shape vs. desktop-shape patterns that can't
 *  be expressed purely with `lg:` variants — e.g. picking between a
 *  Sheet and a Dialog component. */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isDesktop;
}
