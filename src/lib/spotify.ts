/**
 * Spotify links — resolved, not played. Full-track Spotify playback needs the
 * Web Playback SDK plus BOTH listeners holding Premium and OAuth-ing in, so
 * instead a pasted Spotify track link is resolved to the same song on
 * YouTube: oEmbed gives the track title (public, CORS-enabled, no key), the
 * backend link-preview adds the artist when it can, and the backend YouTube
 * search proxy finds the match. Works for everyone, no SDKs, no accounts.
 */
import { api } from "@/lib/api";

/** Canonical track URL for open.spotify.com/track/<id> links (intl paths
 *  and share query strings included), or null. */
export function extractSpotifyTrackUrl(raw: string): string | null {
  const input = raw.trim();
  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const u = new URL(withProto);
    if (u.hostname !== "open.spotify.com") return null;
    const m = u.pathname.match(/^(?:\/intl-[a-z-]+)?\/track\/([A-Za-z0-9]{10,})/);
    if (!m) return null;
    return `https://open.spotify.com/track/${m[1]}`;
  } catch {
    return null;
  }
}

export type SpotifyResolution = {
  video_id: string;
  yt_title: string;
  channel_title: string;
  spotify_title: string;
};

export class SpotifyResolveError extends Error {
  reason: "no-title" | "search-unavailable" | "no-match";
  constructor(reason: "no-title" | "search-unavailable" | "no-match") {
    super(reason);
    this.reason = reason;
  }
}

async function spotifyTitle(trackUrl: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string };
    return typeof j.title === "string" && j.title.trim() ? j.title.trim() : null;
  } catch {
    return null;
  }
}

/** The artist, when the backend's link-preview can read it off the page.
 *  Pure best-effort — a null just means a weaker search query. */
async function spotifyArtist(trackUrl: string): Promise<string | null> {
  try {
    const j = await api.get<{ title: string; author?: string | null }>(
      `/v1/link-preview?url=${encodeURIComponent(trackUrl)}`,
    );
    return j.author?.trim() || null;
  } catch {
    return null;
  }
}

export async function resolveSpotifyToYoutube(trackUrl: string): Promise<SpotifyResolution> {
  const [title, artist] = await Promise.all([
    spotifyTitle(trackUrl),
    spotifyArtist(trackUrl),
  ]);
  if (!title) throw new SpotifyResolveError("no-title");
  const q = artist ? `${title} ${artist}` : `${title} song`;
  let items: { video_id: string; title: string; channel_title: string }[];
  try {
    const res = await api.get<{ items: typeof items }>(
      `/v1/youtube/search?q=${encodeURIComponent(q)}&limit=3`,
    );
    items = res.items;
  } catch {
    throw new SpotifyResolveError("search-unavailable");
  }
  const best = items?.[0];
  if (!best) throw new SpotifyResolveError("no-match");
  return {
    video_id: best.video_id,
    yt_title: best.title,
    channel_title: best.channel_title,
    spotify_title: title,
  };
}
