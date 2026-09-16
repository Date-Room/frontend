import { describe, expect, it } from "vitest";
import { extractSpotifyTrackUrl } from "./spotify";

describe("extractSpotifyTrackUrl", () => {
  it("accepts track links, intl paths and share query strings", () => {
    expect(extractSpotifyTrackUrl("https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8")).toBe(
      "https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8",
    );
    expect(
      extractSpotifyTrackUrl("https://open.spotify.com/intl-de/track/4PTG3Z6ehGkBFwjybzWkR8?si=abc"),
    ).toBe("https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8");
    expect(extractSpotifyTrackUrl("open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8")).toBe(
      "https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8",
    );
  });

  it("rejects albums, playlists, artists and other hosts", () => {
    expect(extractSpotifyTrackUrl("https://open.spotify.com/album/xyz1234567")).toBeNull();
    expect(extractSpotifyTrackUrl("https://open.spotify.com/playlist/xyz1234567")).toBeNull();
    expect(extractSpotifyTrackUrl("https://spotify.com/track/xyz1234567")).toBeNull();
    expect(extractSpotifyTrackUrl("https://youtube.com/watch?v=x")).toBeNull();
  });
});
