const STORAGE_KEY = "dateroom:watch-history";
const MAX_ENTRIES = 30;

export type WatchHistoryEntry = {
  videoId: string;
  url: string;
  addedAt: number;
};

export function youtubeWatchUrl(videoId: string): string {
  return `https://youtu.be/${videoId}`;
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
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function addWatchHistory(input: string, videoId: string): WatchHistoryEntry[] {
  const trimmed = input.trim();
  const url =
    trimmed.startsWith("http") || trimmed.startsWith("youtu")
      ? trimmed
      : youtubeWatchUrl(videoId);
  const entry: WatchHistoryEntry = { videoId, url, addedAt: Date.now() };
  const next = [entry, ...loadWatchHistory().filter((e) => e.videoId !== videoId)].slice(
    0,
    MAX_ENTRIES,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    void 0;
  }
  return next;
}
