import { Smartphone } from "lucide-react";
import { mobilePlatform, storeNameFor, storeUrlFor } from "@/lib/appStores";
import { cn } from "@/lib/utils";

/**
 * The app pitch, at the only moment it's welcome: after a date that went
 * well. Never on the invite path — nobody installs an app because someone
 * sent them a link, and "zero downloads" is what makes a DateRoom invite
 * work at all.
 *
 * Mobile only (the pitch is a better phone experience; a desktop visitor
 * can't act on it) and it names a real, verifiable benefit rather than
 * claiming the web app is bad.
 */
export function GetTheAppCard({ className }: { className?: string }) {
  const platform = mobilePlatform();
  if (!platform) return null;
  return (
    <a
      href={storeUrlFor(platform)}
      target="_blank"
      rel="noreferrer noopener"
      className={cn("editorial-card hover-lift focus-ring block p-5 text-left", className)}
    >
      <p className="flex items-center gap-2 font-serif text-lg text-cream">
        <Smartphone className="h-4 w-4 text-primary" />
        Better on your phone
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        The app plays video, music and games natively, without the browser getting in the
        way. Same rooms, same six-digit codes.
      </p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-primary">
        Get it on {storeNameFor(platform)}
      </p>
    </a>
  );
}
