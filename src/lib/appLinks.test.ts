import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Universal links only reach the app for paths listed here. The mobile
 * deep-link listener resolves `/squad/room/<id>` and `/rooms/<id>/pre`
 * perfectly well — but iOS never hands those links over unless this file
 * claims them, so a squad link shared from web opened Safari instead of
 * the app. Shipping the in-app route without the path was half a feature.
 */
const aasa = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "public/.well-known/apple-app-site-association"),
    "utf8",
  ),
) as { applinks: { details: { appID: string; paths: string[] }[] } };

describe("apple-app-site-association", () => {
  const paths = aasa.applinks.details[0].paths;

  it("claims every link shape the app can route", () => {
    // Each of these resolves to an in-app route in deep_link_listener.dart.
    expect(paths).toContain("/i/*");
    expect(paths).toContain("/squad/room/*");
    expect(paths).toContain("/rooms/*");
  });

  it("still claims the auth callback, which breaks sign-in if dropped", () => {
    expect(paths).toContain("/auth/callback");
    expect(paths).toContain("/auth/callback/*");
  });

  it("is a single app and a real team-prefixed bundle id", () => {
    expect(aasa.applinks.details).toHaveLength(1);
    expect(aasa.applinks.details[0].appID).toMatch(/^[A-Z0-9]{10}\.[a-z.]+$/);
  });
});
