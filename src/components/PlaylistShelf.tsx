import { useEffect, useState } from "react";
import { ListMusic, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DjTrack } from "@/components/DJ";
import { ApiError } from "@/lib/api";
import {
  deleteMediaCollection,
  fetchMediaLibrary,
  mediaLibraryAvailable,
  upsertMediaCollection,
  type MediaCollection,
  type MediaItem,
} from "@/lib/mediaLibrary";

/**
 * PlaylistShelf — "your shelf follows you". Save the room's current queue to
 * the account, load a saved playlist into any future room. Renders nothing
 * for guests (no account to save to); saving is the paid perk, loading and
 * deleting are never gated.
 */

function toItems(tracks: DjTrack[]): MediaItem[] {
  return tracks
    .filter((t) => t.video_id || (t.source === "soundcloud" && t.sc_url))
    .map((t) =>
      t.source === "soundcloud"
        ? {
            source: "soundcloud" as const,
            media_id: t.sc_url as string,
            title: t.title && t.title !== "Loading…" ? t.title : undefined,
            thumbnail: t.thumb_url,
            added_at: new Date().toISOString(),
          }
        : {
            source: "youtube" as const,
            media_id: t.video_id as string,
            title: t.title && t.title !== "Loading…" ? t.title : undefined,
            added_at: new Date().toISOString(),
          },
    );
}

function toTracks(items: MediaItem[], senderId: string): DjTrack[] {
  return items
    .filter((i) => (i.source === "youtube" || i.source === "soundcloud") && i.media_id)
    .map((i) =>
      i.source === "soundcloud"
        ? {
            id: crypto.randomUUID(),
            title: i.title ?? "Loading…",
            added_by: senderId,
            channel_title: null,
            video_id: null,
            source: "soundcloud" as const,
            sc_url: i.media_id,
            thumb_url: i.thumbnail,
          }
        : {
            id: crypto.randomUUID(),
            title: i.title ?? "Loading…",
            added_by: senderId,
            channel_title: null,
            video_id: i.media_id,
          },
    );
}

export function PlaylistShelf({
  tracks,
  senderId,
  onLoad,
}: {
  tracks: DjTrack[];
  senderId: string;
  onLoad: (tracks: DjTrack[]) => void;
}) {
  const available = mediaLibraryAvailable();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  const [canSave, setCanSave] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !available) return;
    let cancelled = false;
    setLoading(true);
    void fetchMediaLibrary()
      .then((lib) => {
        if (cancelled) return;
        setCollections(lib.collections.filter((c) => c.kind === "music"));
        setCanSave(lib.can_save);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't reach your playlists.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, available]);

  if (!available) return null;

  const savable = tracks.filter((t) => t.video_id);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || savable.length === 0) return;
    setSaving(true);
    try {
      const saved = await upsertMediaCollection("music", trimmed, toItems(tracks));
      setCollections((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)]);
      setName("");
      toast.success(`Saved "${saved.name}" to your playlists.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        toast.error("Saved playlists come with any paid pass or Together plan.");
      } else {
        toast.error("Couldn't save the playlist.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: MediaCollection) => {
    setCollections((prev) => prev.filter((x) => x.id !== c.id));
    try {
      await deleteMediaCollection(c.id);
    } catch {
      setCollections((prev) => [c, ...prev]);
      toast.error("Couldn't delete it.");
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="focus-ring inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-cream"
        >
          <ListMusic className="h-3.5 w-3.5" /> Playlists
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Your playlists
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : collections.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            Nothing saved yet. Name the current list below and it follows your
            account into every room.
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            {collections.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onLoad(toTracks(c.items, senderId));
                    setOpen(false);
                    toast.success(`"${c.name}" queued up.`);
                  }}
                  className="focus-ring min-w-0 flex-1 rounded-md px-1 py-1 text-left transition hover:bg-white/[0.06]"
                >
                  <span className="block truncate text-sm text-cream">{c.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {c.items.length} song{c.items.length === 1 ? "" : "s"} · tap to queue
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(c)}
                  aria-label={`Delete ${c.name}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:text-rose"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        {savable.length > 0 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="flex items-center gap-2 p-2"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Save current list as…"
              maxLength={80}
              className="h-8 bg-secondary/60 text-xs border-white/[0.10]"
            />
            <Button
              type="submit"
              size="sm"
              disabled={saving || !name.trim() || !canSave}
              className="h-8 shrink-0 rounded-full text-xs text-primary-foreground"
              style={{ backgroundColor: "var(--room-accent)" }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </form>
        ) : (
          <p className="px-3 py-2 text-[11px] text-muted-foreground">
            Add some songs first, then save the list here.
          </p>
        )}
        {!canSave && !loading && savable.length > 0 && (
          <p className="px-3 pb-2 text-[11px] text-muted-foreground">
            Saving comes with any paid pass or Together plan.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
