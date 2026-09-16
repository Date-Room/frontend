/**
 * iOS Smart App Banner (`<meta name="apple-itunes-app">`).
 *
 * Rendered only on invite/lobby routes so a guest on mobile Safari gets a
 * one-tap path into the native app, with the current invite URL passed as
 * `app-argument` for the app's deep-link listener. Android/desktop browsers
 * ignore the tag.
 *
 * Apple's own banner is the one install prompt we allow near the invite
 * path: it's a dismissible strip rather than a gate, and for anyone who
 * already has the app it reads "Open" instead of "Get". Everything louder
 * waits until after a date (see lib/appStores).
 */

import { IOS_APP_ID } from "@/lib/appStores";

const META_NAME = "apple-itunes-app";

/** The App Store id. Defaults to the shipped app so the banner works with
 *  no deploy config; VITE_APPSTORE_APP_ID still overrides (staging builds,
 *  or killing the banner by setting it blank... which is why "none" is
 *  honoured explicitly rather than falling through to the default). */
export function appStoreAppId(): string | null {
  const raw = import.meta.env.VITE_APPSTORE_APP_ID;
  const configured = typeof raw === "string" ? raw.trim() : "";
  if (configured.toLowerCase() === "none") return null;
  return configured.length > 0 ? configured : IOS_APP_ID;
}

/**
 * Install/update the banner meta tag for `inviteUrl`. Returns true if a tag
 * was set, false when no app id is configured (nothing rendered).
 */
export function setSmartAppBanner(inviteUrl: string): boolean {
  const appId = appStoreAppId();
  if (!appId) return false;
  let meta = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${META_NAME}"]`,
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = META_NAME;
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", `app-id=${appId}, app-argument=${inviteUrl}`);
  return true;
}

/** Remove the banner meta tag if present. */
export function clearSmartAppBanner(): void {
  document.head.querySelector(`meta[name="${META_NAME}"]`)?.remove();
}
