import { describe, expect, it } from "vitest";
import { directVideoTitle, extractDirectVideoUrl } from "./directVideo";

describe("extractDirectVideoUrl", () => {
  it("accepts common video file links, with query strings", () => {
    expect(extractDirectVideoUrl("https://cdn.x.com/clip.mp4")).toBe("https://cdn.x.com/clip.mp4");
    expect(extractDirectVideoUrl("https://x.com/a/b/movie.webm?token=1")).toBe(
      "https://x.com/a/b/movie.webm?token=1",
    );
    expect(extractDirectVideoUrl("https://x.com/v.MOV")).toBe("https://x.com/v.MOV");
  });

  it("rejects pages, protocols we don't fetch, and junk", () => {
    expect(extractDirectVideoUrl("https://x.com/watch?v=abc")).toBeNull();
    expect(extractDirectVideoUrl("ftp://x.com/a.mp4")).toBeNull();
    expect(extractDirectVideoUrl("clip.mp4")).toBeNull();
    expect(extractDirectVideoUrl("https://x.com/notavideo.pdf")).toBeNull();
  });
});

describe("directVideoTitle", () => {
  it("de-slugs the file name", () => {
    expect(directVideoTitle("https://x.com/our-trip_to-diani%202024.mp4?t=1")).toBe(
      "our trip to diani 2024",
    );
    expect(directVideoTitle("https://x.com/")).toBe("A video of yours");
  });
});
