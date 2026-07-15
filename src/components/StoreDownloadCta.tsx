import { Smartphone } from "lucide-react";
import { STORE_ONLY_MESSAGE } from "@/lib/billing";
import { cn } from "@/lib/utils";

/**
 * Shown to store-region users where a checkout would otherwise appear:
 * purchases happen in the native app, so we surface the (coming-soon) app
 * badges instead of a pay form. Server-priced amounts are shown by the
 * caller alongside this.
 */
const STORE_BADGES = [
  { top: "Coming soon on", bot: "App Store" },
  { top: "Coming soon on", bot: "Google Play" },
];

export function StoreDownloadCta({
  className,
  note,
}: {
  className?: string;
  note?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {note ?? STORE_ONLY_MESSAGE}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {STORE_BADGES.map((b) => (
          <div
            key={b.bot}
            className="flex flex-1 cursor-not-allowed items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 opacity-80"
          >
            <Smartphone className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {b.top}
              </div>
              <div className="text-sm font-medium text-cream">{b.bot}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
