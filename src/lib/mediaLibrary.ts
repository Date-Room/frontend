/**
 * Media library — the account-scoped shelf behind "why do I rebuild my
 * playlist in every room?". Collections live on the backend
 * (/v1/me/media-collections); room activity state stays the live-sync
 * source and dies with the room, this is what survives it.
 *
 * Reading is never gated; saving is the paid perk (`can_save`).
 */
import { api, apiConfigured } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import { loadWatchHistory, type WatchHistoryEntry } from "@/lib/watchHistory";

export type MediaSource = "youtube" | "soundcloud" | "spotify" | "vimeo" | "direct";
export type MediaKind = "watch" | "music";

export type MediaItem = {
  source: MediaSource;
  media_id: string;
  url?: string;
  title?: string;
  thumbnail?: string;
  added_at?: string;
};

export type MediaCollection = {
  id: string;
  kind: MediaKind;
  name: string;
  items: MediaItem[];
  updated_at: string;
};

export type MediaLibrary = { collections: MediaCollection[]; can_save: boolean };

/** The auto-synced watch history collection's reserved name. */
export const WATCH_HISTORY_NAME = "Watch history";

export function mediaLibraryAvailable(): boolean {
  return apiConfigured() && Boolean(authClient.getSession());
}

export function fetchMediaLibrary(): Promise<MediaLibrary> {
  return api.get<MediaLibrary>("/v1/me/media-collections");
}

export function upsertMediaCollection(
  kind: MediaKind,
  name: string,
  items: MediaItem[],
): Promise<MediaCollection> {
  return api.put<MediaCollection>("/v1/me/media-collections", { kind, name, items });
}

export function deleteMediaCollection(id: string): Promise<void> {
  return api.delete<void>(`/v1/me/media-collections/${id}`);
}

/** Merge the device's local watch history with the account copy — newest
 *  first, deduped by video id. Pure, so both directions can use it. */
export function mergeWatchHistory(
  local: WatchHistoryEntry[],
  remote: MediaItem[],
): MediaItem[] {
  const fromLocal: MediaItem[] = local.map((e) => ({
    source: "youtube" as const,
    media_id: e.videoId,
    url: e.url,
    title: e.title,
    added_at: new Date(e.addedAt).toISOString(),
  }));
  const all = [...fromLocal, ...remote.filter((r) => r.source === "youtube")];
  const seen = new Set<string>();
  return all
    .sort((a, b) => (b.added_at ?? "").localeCompare(a.added_at ?? ""))
    .filter((i) => {
      if (!i.media_id || seen.has(i.media_id)) return false;
      seen.add(i.media_id);
      return true;
    })
    .slice(0, 60);
}

/** Push the merged watch history up to the account. Fire-and-forget:
 *  failures (offline, unpaid, guest) leave localStorage as the fallback. */
export async function syncWatchHistoryToAccount(
  remote: MediaItem[] | null,
): Promise<void> {
  if (!mediaLibraryAvailable()) return;
  try {
    const merged = mergeWatchHistory(loadWatchHistory(), remote ?? []);
    if (merged.length === 0) return;
    await upsertMediaCollection("watch", WATCH_HISTORY_NAME, merged);
  } catch {
    /* saving is best-effort — the paid gate or network can say no */
  }
}
