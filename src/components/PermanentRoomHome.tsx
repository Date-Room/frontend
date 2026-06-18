import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Film, Music, Video } from "lucide-react";
import { useActivitySession } from "@/hooks/useActivitySession";
import { parseFridge, parseFridgeNotes } from "@/lib/roomWalls";
import { timeAgo } from "@/lib/partnerPresence";
import { VisionBoardWallPreview } from "@/components/VisionBoardWallPreview";
import {
  PermanentRoomFeatureSheet,
  type HomeFeatureId,
} from "@/components/PermanentRoomFeatureSheet";
import { cn } from "@/lib/utils";

type ExtraTab = { id: HomeFeatureId; label: string; icon: string };

type Props = {
  partnerStatus: string;
  onCallIn: () => void;
  extraTabs?: ExtraTab[];
};

export function PermanentRoomHome({ partnerStatus, onCallIn, extraTabs = [] }: Props) {
  const { t } = useTranslation();
  const [openFeature, setOpenFeature] = useState<HomeFeatureId | null>(null);
  const { state: notesRaw } = useActivitySession("pinned_note");
  const { state: shelfRaw } = useActivitySession("fridge");

  const latestNote = useMemo(() => parseFridgeNotes(notesRaw).notes[0] ?? null, [notesRaw]);
  const shelfTodo = useMemo(
    () => parseFridge(shelfRaw).items.filter((i) => i.status === "todo"),
    [shelfRaw],
  );

  const widgets = useMemo(
    () =>
      [
        {
          id: "fridge_notes" as const,
          label: t("room.fridge"),
          sub: latestNote ? timeAgo(latestNote.pinned_at) : t("room.fridgeEmpty"),
          body: latestNote ? (
            <div className="perm-fridge-note">
              <span className="perm-fridge-magnet" aria-hidden />
              <p className="line-clamp-4 font-serif text-[11px] leading-snug text-[#2a2018]">
                {latestNote.text}
              </p>
            </div>
          ) : (
            <p className="text-xs text-cream/40">{t("room.fridgeHint")}</p>
          ),
        },
        {
          id: "bookshelf" as const,
          label: t("room.bookshelf"),
          sub:
            shelfTodo.length === 0
              ? t("room.bookshelfEmpty")
              : t("room.bookshelfWaiting", { count: shelfTodo.length }),
          body: (
            <div className="flex h-14 items-end gap-1 px-1">
              <span className="perm-book-spine" style={{ height: "3.5rem" }} />
              <span className="perm-book-spine perm-book-spine-alt" style={{ height: "2.75rem" }} />
              <span className="perm-book-spine" style={{ height: "3rem" }} />
            </div>
          ),
        },
        {
          id: "watch" as const,
          label: t("room.watch"),
          sub: t("room.watchSub"),
          body: (
            <div className="perm-watch-chip">
              <Film className="h-4 w-4 text-cream/70" />
            </div>
          ),
        },
        {
          id: "dj" as const,
          label: t("room.dj"),
          sub: t("room.djSub"),
          body: (
            <div className="perm-dj-disc">
              <Music className="h-5 w-5 text-cream/60" />
            </div>
          ),
        },
      ] satisfies {
        id: HomeFeatureId;
        label: string;
        sub: string;
        body?: React.ReactNode;
      }[],
    [latestNote, shelfTodo, t],
  );

  return (
    <>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-8 pt-2 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div className="perm-status-bar">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber shadow-[0_0_10px_rgba(232,157,77,0.65)]" />
              <p className="truncate text-sm text-cream/80">{partnerStatus}</p>
            </div>
            <button type="button" onClick={onCallIn} className="perm-call-btn shrink-0">
              <Video className="h-4 w-4" />
              {t("common.callThemIn")}
            </button>
          </div>

          <VisionBoardWallPreview onOpen={() => setOpenFeature("vision_board")} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {widgets.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setOpenFeature(w.id)}
                className={cn(
                  "perm-widget group text-left transition",
                  "hover:-translate-y-0.5 hover:border-amber/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.25)]",
                )}
              >
                <div className="mb-3 flex min-h-[4.5rem] items-center justify-center">{w.body}</div>
                <p className="font-medium text-cream">{w.label}</p>
                <p className="mt-0.5 text-[11px] text-cream/45 group-hover:text-cream/60">{w.sub}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wider text-transparent transition group-hover:text-amber/80">
                  {t("common.open")}
                </p>
              </button>
            ))}
          </div>

          {extraTabs.length > 0 && (
            <div className="perm-more-panel">
              <p className="perm-more-label">{t("room.moreToExplore")}</p>
              <div className="flex flex-wrap gap-2">
                {extraTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOpenFeature(tab.id)}
                    className="perm-more-chip"
                  >
                    <span aria-hidden>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <PermanentRoomFeatureSheet feature={openFeature} onClose={() => setOpenFeature(null)} />
    </>
  );
}
