/**
 * iOS Smart App Banner (`<meta name="apple-itunes-app">`).
 *
 * Rendered only on invite/lobby routes so a guest on mobile Safari gets a
 * one-tap path into the native app, with the current invite URL passed as
 * `app-argument` for the app's deep-link listener. No-ops (and renders
 * nothing) until VITE_APPSTORE_APP_ID is set — the app isn't in the store
 * yet. Android/desktop browsers ignore the tag.
 */

const META_NAME = "apple-itunes-app";

/** The configured App Store id, or null when unset/blank. */
export function appStoreAppId(): string | null {
  const id = import.meta.env.VITE_APPSTORE_APP_ID;
  const trimmed = typeof id === "string" ? id.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
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
