import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "./PageShell";

/**
 * Web-aware scaffold for forms & secondary signed-in screens. On phones it's
 * the familiar full-width column with a sticky header; on desktop (sm+) the
 * content sits in a centered, contained card on the canvas instead of a
 * phone-shaped column glued to the top edge.
 *
 * `maxWidth` controls the card width (default narrow form width). `headerRight`
 * renders an optional action on the far right of the header row.
 */
export function CardPage({
  title,
  onBack,
  headerRight,
  children,
  maxWidth = "sm:max-w-xl",
  bodyClassName,
}: {
  title?: ReactNode;
  onBack?: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  bodyClassName?: string;
}) {
  return (
    <PageShell>
      <div className={cn("relative z-10 mx-auto w-full px-0 sm:px-6 sm:py-12 lg:py-16", maxWidth)}>
        <div className="flex flex-col sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-white/[0.10] sm:bg-card/55 sm:shadow-[0_28px_80px_-20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] sm:backdrop-blur-xl">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-white/[0.06] glass-subtle px-5 sm:px-6 backdrop-blur-xl sm:static sm:border-white/[0.06] sm:bg-transparent sm:backdrop-blur-none">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="focus-ring -ml-1 rounded-full p-1 text-muted-foreground transition hover:text-cream hover:bg-white/[0.04]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            {title && <h1 className="font-serif text-lg text-cream truncate">{title}</h1>}
            {headerRight && <div className="ml-auto">{headerRight}</div>}
          </header>
          <div className={cn("px-5 sm:px-6 pb-12 pt-6", bodyClassName)}>{children}</div>
        </div>
      </div>
    </PageShell>
  );
}
