/**
 * SoundCloud — the second music source. The HTML5 Widget API gives the same
 * programmatic control the YouTube IFrame API does (play/pause/seek/volume +
 * events), with no API key, which is what makes synced playback possible.
 * Tracks are addressed by their soundcloud.com URL (that's what the widget
 * loads), not a numeric id.
 */

export type ScWidget = {
  play(): void;
  pause(): void;
  toggle(): void;
  seekTo(ms: number): void;
  setVolume(v: number): void;
  load(url: string, options?: Record<string, unknown> & { callback?: () => void }): void;
  bind(event: string, listener: (data?: unknown) => void): void;
  unbind(event: string): void;
  getDuration(cb: (ms: number) => void): void;
  getPosition(cb: (ms: number) => void): void;
  isPaused(cb: (paused: boolean) => void): void;
};

type ScNamespace = {
  Widget: ((el: HTMLIFrameElement | string) => ScWidget) & {
    Events: {
      READY: string;
      PLAY: string;
      PAUSE: string;
      FINISH: string;
      PLAY_PROGRESS: string;
      ERROR: string;
    };
  };
};

declare global {
  interface Window {
    SC?: ScNamespace;
  }
}

let scApiPromise: Promise<void> | null = null;

/** Load the widget controller script once (https://w.soundcloud.com/player/api.js). */
export function loadScApi(): Promise<void> {
  if (scApiPromise) return scApiPromise;
  scApiPromise = new Promise((res) => {
    if (window.SC?.Widget) return res();
    const t = document.createElement("script");
    t.src = "https://w.soundcloud.com/player/api.js";
    t.onload = () => res();
    document.head.appendChild(t);
  });
  return scApiPromise;
}

/** The embed iframe URL for a track. `visual=false` = the compact player. */
export function scPlayerSrc(trackUrl: string): string {
  const params = new URLSearchParams({
    url: trackUrl,
    auto_play: "false",
    visual: "false",
    show_comments: "false",
    show_user: "false",
    hide_related: "true",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

/** A canonical soundcloud.com track URL, or null. Short share links
 *  (on.soundcloud.com) redirect server-side and the widget can't follow
 *  them from here, so they're rejected with a hint instead. */
export function extractScUrl(raw: string): string | null {
  const input = raw.trim();
  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const u = new URL(withProto);
    if (u.hostname !== "soundcloud.com" && u.hostname !== "www.soundcloud.com") return null;
    // A track is /artist/track (2+ segments); profile-only links won't load.
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length < 2) return null;
    return `https://soundcloud.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

export function isScShortLink(raw: string): boolean {
  return /(^|\/\/)on\.soundcloud\.com\//i.test(raw.trim());
}

export type ScOEmbed = { title: string; author_name: string; thumbnail_url: string | null };

/** Title/artist/artwork via SoundCloud's public oEmbed (no key, CORS-enabled). */
export async function fetchScOEmbed(trackUrl: string): Promise<ScOEmbed | null> {
  try {
    const r = await fetch(
      `https://soundcloud.com/oembed?url=${encodeURIComponent(trackUrl)}&format=json`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    if (!j.title) return null;
    return {
      title: j.title,
      author_name: j.author_name ?? "SoundCloud",
      thumbnail_url: j.thumbnail_url ?? null,
    };
  } catch {
    return null;
  }
}
