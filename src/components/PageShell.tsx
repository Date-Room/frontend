import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** Soft rose / primary gradient blobs */
  orbs?: boolean;
  /** Film grain overlay */
  grain?: boolean;
  /** Edge darkening */
  vignette?: boolean;
};

/**
 * Shared full-page backdrop: theme background, optional orbs, grain, vignette.
 * Use `grain={false}` / `vignette={false}` when a page paints its own full-bleed art (e.g. lobby hero).
 */
export function PageShell({
  children,
  className,
  orbs = true,
  grain = true,
  vignette = true,
}: PageShellProps) {
  return (
    <div className={cn("min-h-screen relative bg-background text-foreground overflow-x-hidden", className)}>
      {vignette ? <div className="vignette" aria-hidden /> : null}
      {grain ? <div className="page-grain" aria-hidden /> : null}
      {orbs ? (
        <>
          <div
            className="pointer-events-none absolute top-0 right-0 w-[min(520px,90vw)] h-[520px] bg-primary/[0.07] rounded-full blur-[110px] -z-10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 w-[min(420px,85vw)] h-[420px] bg-primary/[0.05] rounded-full blur-[100px] -z-10"
            aria-hidden
          />
        </>
      ) : null}
      {children}
    </div>
  );
}

export function PageStickyHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 glass-subtle backdrop-blur-xl border-b border-white/[0.05]",
        className,
      )}
    >
      {children}
    </header>
  );
}
