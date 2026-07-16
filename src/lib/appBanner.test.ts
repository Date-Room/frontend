import { describe, it, expect, afterEach, vi } from "vitest";
import {
  appStoreAppId,
  clearSmartAppBanner,
  setSmartAppBanner,
} from "@/lib/appBanner";

function bannerMeta(): HTMLMetaElement | null {
  return document.head.querySelector('meta[name="apple-itunes-app"]');
}

afterEach(() => {
  clearSmartAppBanner();
  vi.unstubAllEnvs();
});

describe("iOS Smart App Banner", () => {
  it("does nothing when VITE_APPSTORE_APP_ID is unset", () => {
    vi.stubEnv("VITE_APPSTORE_APP_ID", "");
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

  it("trims whitespace-only env to null", () => {
    vi.stubEnv("VITE_APPSTORE_APP_ID", "   ");
    expect(appStoreAppId()).toBeNull();
  });
});
