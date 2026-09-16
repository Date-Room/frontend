import { describe, it, expect, afterEach, vi } from "vitest";
import {
  appStoreAppId,
  clearSmartAppBanner,
  setSmartAppBanner,
} from "@/lib/appBanner";
import { IOS_APP_ID } from "@/lib/appStores";

function bannerMeta(): HTMLMetaElement | null {
  return document.head.querySelector('meta[name="apple-itunes-app"]');
}

afterEach(() => {
  clearSmartAppBanner();
  vi.unstubAllEnvs();
});

describe("iOS Smart App Banner", () => {
  it("falls back to the shipped app id when the env var is unset", () => {
    // The apps shipped 2026-09, so the banner works with no deploy config.
    vi.stubEnv("VITE_APPSTORE_APP_ID", "");
    expect(appStoreAppId()).toBe(IOS_APP_ID);
    expect(setSmartAppBanner("https://dateroom.io/i/ABC/1234")).toBe(true);
    expect(bannerMeta()!.getAttribute("content")).toContain(`app-id=${IOS_APP_ID}`);
  });

  it('can still be switched off with VITE_APPSTORE_APP_ID="none"', () => {
    vi.stubEnv("VITE_APPSTORE_APP_ID", "none");
    expect(appStoreAppId()).toBeNull();
    expect(setSmartAppBanner("https://dateroom.io/i/ABC/1234")).toBe(false);
    expect(bannerMeta()).toBeNull();
  });

  it("sets the meta tag with app id + full invite URL when configured", () => {
    vi.stubEnv("VITE_APPSTORE_APP_ID", "6499999999");
    const url = "https://dateroom.io/i/ABC123/4567";
    expect(setSmartAppBanner(url)).toBe(true);
    const meta = bannerMeta();
    expect(meta).not.toBeNull();
    expect(meta!.getAttribute("content")).toBe(
      `app-id=6499999999, app-argument=${url}`,
    );
  });

  it("updates the existing tag instead of duplicating it", () => {
    vi.stubEnv("VITE_APPSTORE_APP_ID", "6499999999");
    setSmartAppBanner("https://dateroom.io/i/ONE/1111");
    setSmartAppBanner("https://dateroom.io/i/TWO/2222");
    const metas = document.head.querySelectorAll('meta[name="apple-itunes-app"]');
    expect(metas.length).toBe(1);
    expect(metas[0].getAttribute("content")).toContain("i/TWO/2222");
  });

  it("clears the tag", () => {
    vi.stubEnv("VITE_APPSTORE_APP_ID", "6499999999");
    setSmartAppBanner("https://dateroom.io/i/ABC/1234");
    expect(bannerMeta()).not.toBeNull();
    clearSmartAppBanner();
    expect(bannerMeta()).toBeNull();
  });

  it("trims whitespace-only env back to the default", () => {
    vi.stubEnv("VITE_APPSTORE_APP_ID", "   ");
    expect(appStoreAppId()).toBe(IOS_APP_ID);
  });
});
