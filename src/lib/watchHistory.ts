const STORAGE_KEY = "dateroom:watch-history";
const MAX_ENTRIES = 30;

export type WatchHistoryEntry = {
  videoId: string;
  url: string;
  addedAt: number;
  /** Human title, filled in once known (from the player or oEmbed). */
  title?: string;
};

export function youtubeWatchUrl(videoId: string): string {
  return `https://youtu.be/${videoId}`;
}

/** Thumbnail for a video id (always available without an API key). */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function loadWatchHistory(): WatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is WatchHistoryEntry =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as WatchHistoryEntry).videoId === "string" &&
          typeof (e as WatchHistoryEntry).url === "string" &&
          typeof (e as WatchHistoryEntry).addedAt === "number",
      )
      .map((e) => ({
        videoId: e.videoId,
        url: e.url,
        addedAt: e.addedAt,
        title: typeof e.title === "string" ? e.title : undefined,
      }))
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function persist(entries: WatchHistoryEntry[]): WatchHistoryEntry[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    void 0;
  }
  return entries;
}

export function addWatchHistory(
  input: string,
  videoId: string,
  title?: string,
): WatchHistoryEntry[] {
  const trimmed = input.trim();
  const url =
    trimmed.startsWith("http") || trimmed.startsWith("youtu")
      ? trimmed
      : youtubeWatchUrl(videoId);
  // Preserve an existing title if we don't have a fresh one.
  const prior = loadWatchHistory().find((e) => e.videoId === videoId);
  const entry: WatchHistoryEntry = {
    videoId,
    url,
    addedAt: Date.now(),
    title: title ?? prior?.title,
  };
  const next = [entry, ...loadWatchHistory().filter((e) => e.videoId !== videoId)].slice(
    0,
    MAX_ENTRIES,
  );
  return persist(next);
}

/** Fill in a title for an existing entry (no-op if the entry is gone). */
export function setWatchHistoryTitle(videoId: string, title: string): WatchHistoryEntry[] {
  const trimmed = title.trim();
  if (!trimmed) return loadWatchHistory();
  const next = loadWatchHistory().map((e) =>
    e.videoId === videoId ? { ...e, title: trimmed } : e,
  );
  return persist(next);
}

/**
 * Best-effort title lookup via YouTube's public oEmbed endpoint (no API key,
 * CORS-enabled). Returns null on any failure.
 */
export async function fetchYoutubeTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        youtubeWatchUrl(videoId),
      )}&format=json`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === "string" && data.title.trim() ? data.title.trim() : null;
  } catch {
    return null;
  }
}
