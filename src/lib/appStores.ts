/**
 * The native apps — one source of truth for ids, store links and which
 * platform the visitor is on.
 *
 * Product rule (settled 2026-09-14): nobody installs an app because they
 * were sent a date invite, so we never gate or nag the invitee path —
 * "zero downloads" is the promise and the viral mechanic. The app is
 * offered AFTER a date has gone well, to the person who wants the better
 * version of what they just had.
 *
 * Universal links (/.well-known/apple-app-site-association) and Android
 * App Links (/.well-known/assetlinks.json) already send /i/* and /r/*
 * straight into the app for anyone who has it, so these links are for
 * people who don't.
 */

export const IOS_APP_ID = "6772538580";
export const ANDROID_PACKAGE = "io.dateroom.dateroom";

/** Country-neutral on purpose: both stores redirect to the visitor's own
 *  storefront, so a /us/ path would send everyone else the wrong way. */
export const APP_STORE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export type MobilePlatform = "ios" | "android";

/** The visitor's mobile platform, or null on desktop. */
export function mobilePlatform(): MobilePlatform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13+ reports a Mac UA; the touch check separates it from a desktop.
  if (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document) {
    return "ios";
  }
  return null;
}

export function storeUrlFor(platform: MobilePlatform | null): string {
  return platform === "android" ? PLAY_STORE_URL : APP_STORE_URL;
}

export function storeNameFor(platform: MobilePlatform | null): string {
  return platform === "android" ? "Google Play" : "the App Store";
}
