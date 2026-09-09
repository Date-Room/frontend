import { describe, expect, it } from "vitest";
import { extractScUrl, isScShortLink, scPlayerSrc } from "./soundcloud";

describe("extractScUrl", () => {
  it("accepts track URLs in their common forms", () => {
    expect(extractScUrl("https://soundcloud.com/artist/track")).toBe(
      "https://soundcloud.com/artist/track",
    );
    expect(extractScUrl("soundcloud.com/artist/track/")).toBe(
      "https://soundcloud.com/artist/track",
    );
    expect(extractScUrl("https://www.soundcloud.com/a/b?in=playlist")).toBe(
      "https://soundcloud.com/a/b",
    );
  });

  it("rejects profiles, other hosts, and junk", () => {
    expect(extractScUrl("https://soundcloud.com/artist")).toBeNull();
    expect(extractScUrl("https://youtube.com/watch?v=x")).toBeNull();
    expect(extractScUrl("not a url at all")).toBeNull();
  });

  it("flags share short-links so the UI can explain them", () => {
    expect(isScShortLink("https://on.soundcloud.com/abc123")).toBe(true);
    expect(isScShortLink("https://soundcloud.com/a/b")).toBe(false);
  });
});

describe("scPlayerSrc", () => {
  it("builds a compact, non-autoplaying widget URL", () => {
    const src = scPlayerSrc("https://soundcloud.com/a/b");
    expect(src.startsWith("https://w.soundcloud.com/player/?")).toBe(true);
    expect(src).toContain("auto_play=false");
    expect(src).toContain("visual=false");
    expect(src).toContain(encodeURIComponent("https://soundcloud.com/a/b"));
  });
});
