import { Smartphone } from "lucide-react";
import { STORE_ONLY_MESSAGE } from "@/lib/billing";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appStores";
import { cn } from "@/lib/utils";

/**
 * Shown to store-region users where a checkout would otherwise appear:
 * purchases happen in the native app, so we point at the stores instead of
 * a pay form. The apps shipped on 2026-09 — before that these badges read
 * "Coming soon" and weren't clickable, which left those users told to buy
 * in an app with no way to reach it.
 */
const STORE_BADGES = [
  { top: "Download on the", bot: "App Store", href: APP_STORE_URL },
  { top: "Get it on", bot: "Google Play", href: PLAY_STORE_URL },
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
          <a
            key={b.bot}
            href={b.href}
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring flex flex-1 items-center gap-3 rounded-xl border border-white/[0.10] bg-black/20 px-4 py-3 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/[0.04]"
          >
            <Smartphone className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {b.top}
              </div>
              <div className="text-sm font-medium text-cream">{b.bot}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
