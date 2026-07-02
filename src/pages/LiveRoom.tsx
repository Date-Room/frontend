import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AddMoreTimeCheckout } from "@/components/AddMoreTimeCheckout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isTryPackage, getRoomExperience, isActivityEnabled, getRoomPlan, saveRoomPlanFromServer, isSubscriptionPackage, type CuratableActivityId } from "@/lib/roomExperience";
import { isWatchPartyRoom } from "@/lib/watchParty";
import { getRoomExperienceApi, listMyRooms, type Room, type RoomPackage } from "@/lib/rooms";
import { LogOut, Clock, Maximize2, Minimize2, Sparkles, ChevronLeft, Home } from "lucide-react";
import { AmbientSceneStack } from "@/components/AmbientSceneStack";
import type { AmbiancePresetId } from "@/lib/ambiance";
import { ambianceMeta } from "@/lib/ambiance";
import { RoomAmbianceSheet } from "@/components/RoomAmbianceSheet";
import { PageShell } from "@/components/PageShell";
import { RoomSessionProvider, useRoomSession, type RoomIdentity } from "@/context/RoomSessionContext";
import {
  RoomCustomizationProvider,
  roomAccentStyle,
  useRoomCustomization,
} from "@/context/RoomCustomizationContext";
import { RoomVideo } from "@/components/RoomVideo";
import { ChatWithBoundary } from "@/components/Chat";
import { WatchTogether } from "@/components/WatchTogether";
import { VisionBoard } from "@/components/VisionBoard";
import { FridgeNotes } from "@/components/FridgeNotes";
import { Bookshelf } from "@/components/Bookshelf";
import { WelcomeBackGate } from "@/components/WelcomeBackGate";
import { LiveRoomTabBar } from "@/components/LiveRoomTabBar";
import { PermanentRoomHome } from "@/components/PermanentRoomHome";
import type { HomeFeatureId } from "@/components/PermanentRoomFeatureSheet";
import type { PresenceState } from "@/lib/realtime/roomChannel";
import {
  partnerDisplayName,
  partnerLightLabel,
  partnerPresenceEntry,
  presenceSenderId,
} from "@/lib/partnerPresence";
import { ThisOrThat } from "@/components/ThisOrThat";
import { DJ } from "@/components/DJ";
import { QuestionDeck } from "@/components/QuestionDeck";
import { The36 } from "@/components/The36";
import { TwoTruths } from "@/components/TwoTruths";
import { TruthOrDare } from "@/components/TruthOrDare";
import { toast } from "sonner";
import { authClient } from "@/lib/authClient";
import { DATE_NAME } from "@/lib/room";
import { cn } from "@/lib/utils";

function Loading({ label }: { label: string }) {
  return (
    <PageShell className="flex items-center justify-center">
      <div className="text-center relative z-10 animate-fade-in">
        <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
        <p className="font-serif italic text-cream text-xl">{label}</p>
      </div>
    </PageShell>
  );
}

function KickedListener({ onKicked }: { onKicked: () => void }) {
  const session = useRoomSession();
  useEffect(() => {
    const myPid = session.participantId;
    if (!myPid) return;
    const off = session.channel.onBroadcast((e) => {
      if (e.kind !== "kicked") return;
      const kickedPid = e.payload?.participant_id;
      if (typeof kickedPid !== "string") return;
      if (kickedPid !== myPid) return;
      onKicked();
    });
    return () => off();
  }, [session, onKicked]);
  return null;
}

function LiveRoomAmbianceBackdrop({ preset }: { preset: AmbiancePresetId }) {
  return (
    <>
      <AmbientSceneStack ambiance={preset} positionClassName="fixed inset-0 z-[1]" />
      <div
        className="live-room-ambient"
        data-live-ambiance={preset}
        data-photo-backdrop="true"
        aria-hidden
      />
      <div className="live-room-soft-vignette" aria-hidden />
    </>
  );
}

/* ───────────────── Tab definitions ───────────────── */

type ActivityTabId =
  | "vision_board"
  | "fridge_notes"
  | "bookshelf"
  | "questions"
  | "this_or_that"
  | "the_36"
  | "2_truths"
  | "truth_or_dare"
  | "watch"
  | "dj"
  | "chat";

type TabDef = {
  id: ActivityTabId;
  label: string;
  icon: string;
  curatableId: CuratableActivityId | null;
};

const WALL_TABS: TabDef[] = [
  { id: "vision_board", label: "Vision Board", icon: "✨", curatableId: "vision_board" },
  { id: "fridge_notes", label: "Fridge", icon: "🧲", curatableId: null },
  { id: "bookshelf", label: "Bookshelf", icon: "📚", curatableId: "fridge" },
];

const ACTIVITY_TABS: TabDef[] = [
  { id: "questions", label: "Questions", icon: "💬", curatableId: "questions" },
  { id: "this_or_that", label: "This or That", icon: "⚖️", curatableId: "this_or_that" },
  { id: "the_36", label: "The 36", icon: "🫶", curatableId: "the_36" },
  { id: "2_truths", label: "2 Truths", icon: "🎭", curatableId: "2_truths" },
  { id: "truth_or_dare", label: "Truth or Dare", icon: "🔥", curatableId: "truth_or_dare" },
  { id: "watch", label: "Watch", icon: "📺", curatableId: "watch" },
  { id: "dj", label: "DJ", icon: "🎵", curatableId: "dj" },
  { id: "chat", label: "Chat", icon: "💭", curatableId: null },
];

const ALL_TABS: TabDef[] = [...WALL_TABS, ...ACTIVITY_TABS];

/* ───────────────── RoomShell ───────────────── */

function RoomShell({
  expiresAt,
  onExpiresAtChange,
  isHost,
  roomId,
  roomPackage,
  curatedActivityIds,
}: {
  expiresAt: string | null;
  onExpiresAtChange: (expiresAt: string) => void;
  isHost: boolean;
  roomId: string;
  roomPackage: RoomPackage | null;
  curatedActivityIds: CuratableActivityId[];
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const customization = useRoomCustomization();
  const session = useRoomSession();

  const { data: rooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 5_000,
    enabled: session.canPersist,
  });
  const room: Room | undefined = rooms?.find((r) => r.id === roomId);
  const isPersistent = room?.persistence === "persistent";

  const [tab, setTab] = useState<ActivityTabId>("questions");
  const wallRoom = isSubscriptionPackage(roomPackage);
  const isPermanentRoom = isPersistent || wallRoom;

  const [liveMode, setLiveMode] = useState(() => searchParams.get("live") === "1");
  const userPrefersAtHomeRef = useRef(false);

  const partnerStatus = useMemo(
    () => partnerLightLabel(partnerPresenceEntry(session.presence, session.senderId)),
    [session.presence, session.senderId, i18n.language],
  );

  const enterLiveMode = useCallback(
    (nextTab?: ActivityTabId) => {
      userPrefersAtHomeRef.current = false;
      if (nextTab) setTab(nextTab);
      setLiveMode(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("live", "1");
        return next;
      }, { replace: true });
      void session.channel.track({
        sender_id: session.senderId,
        user_id: session.senderId,
        slot: session.slot,
        name: session.displayName,
        display_name: session.displayName,
        photo_url: session.photoUrl ?? null,
        is_host: session.isHost,
        is_ready: true,
        is_typing: false,
        is_in_call: true,
        last_seen: new Date().toISOString(),
        participant_id: session.participantId ?? null,
      });
      void session.channel.broadcast("call_started", {
        from: session.senderId,
        at: new Date().toISOString(),
      });
    },
    [session, setSearchParams],
  );

  const exitLiveMode = useCallback(() => {
    userPrefersAtHomeRef.current = true;
    setLiveMode(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("live");
      return next;
    }, { replace: true });
    void session.channel.track({
      sender_id: session.senderId,
      user_id: session.senderId,
      slot: session.slot,
      name: session.displayName,
      display_name: session.displayName,
      photo_url: session.photoUrl ?? null,
      is_host: session.isHost,
      is_ready: true,
      is_typing: false,
      is_in_call: false,
      last_seen: new Date().toISOString(),
      participant_id: session.participantId ?? null,
    });
  }, [session, setSearchParams]);

  useEffect(() => {
    if (!isPermanentRoom || liveMode || userPrefersAtHomeRef.current) return;
    // Don't yank the user out of a focused activity when the partner joins.
    if (tab === "watch") return;
    const partner = partnerPresenceEntry(session.presence, session.senderId);
    if (partner?.is_in_call === true) setLiveMode(true);
  }, [isPermanentRoom, liveMode, session.presence, session.senderId, tab]);

  useEffect(() => {
    if (!isPermanentRoom) return;
    return session.channel.onBroadcast((e) => {
      if (e.kind !== "call_started") return;
      if (e.payload.from === session.senderId) return;
      if (userPrefersAtHomeRef.current) return;
      if (tab === "watch") return;
      setLiveMode(true);
    });
  }, [isPermanentRoom, session.channel, session.senderId, tab]);

  const showAtHome = isPermanentRoom && !liveMode;

  const partnerJoinBaselineRef = useRef<{ hadPartner: boolean; partnerInCall: boolean } | null>(
    null,
  );
  const knownOthersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const partner = partnerPresenceEntry(session.presence, session.senderId);
    const hadPartner = Boolean(partner);
    const partnerInCall = partner?.is_in_call === true;
    const onWatch = tab === "watch";

    const others = new Set(
      session.presence
        .map((p) => presenceSenderId(p))
        .filter((id) => id && id !== session.senderId),
    );
    if (knownOthersRef.current.size === 0) {
      knownOthersRef.current = others;
    } else if (onWatch && isWatchPartyRoom(session.maxParticipants)) {
      for (const id of others) {
        if (!knownOthersRef.current.has(id)) {
          const entry = session.presence.find((p) => presenceSenderId(p) === id);
          const name = partnerDisplayName(entry);
          toast(t("room.partnerJoinedWatch", { name }), {
            description: t("room.partnerJoinedWatchDesc"),
            duration: 4000,
            position: "top-center",
            className: "perm-partner-join-toast",
          });
        }
      }
    }
    knownOthersRef.current = others;

    if (partnerJoinBaselineRef.current === null) {
      partnerJoinBaselineRef.current = { hadPartner, partnerInCall };
      return;
    }

    const prev = partnerJoinBaselineRef.current;
    const name = partnerDisplayName(partner);

    if (!prev.hadPartner && hadPartner) {
      toast(t(onWatch ? "room.partnerJoinedWatch" : "room.partnerJoinedRoom", { name }), {
        description: t(onWatch ? "room.partnerJoinedWatchDesc" : "room.partnerJoinedRoomDesc"),
        duration: onWatch ? 4000 : 5000,
        position: "top-center",
        className: "perm-partner-join-toast",
      });
    } else if (prev.hadPartner && hadPartner && !prev.partnerInCall && partnerInCall) {
      toast(t(onWatch ? "room.partnerJoinedWatch" : "room.partnerJoinedCall", { name }), {
        description: t(onWatch ? "room.partnerJoinedWatchDesc" : "room.partnerJoinedCallDesc"),
        duration: onWatch ? 4000 : 5000,
        position: "top-center",
        className: "perm-partner-join-toast",
      });
    }

    partnerJoinBaselineRef.current = { hadPartner, partnerInCall };
  }, [session.presence, session.senderId, session.maxParticipants, tab, t]);

  useEffect(() => {
    if (wallRoom) {
      setTab((current) => (current === "questions" ? "vision_board" : current));
    }
  }, [wallRoom]);
  const [trayExpanded, setTrayExpanded] = useState(false);
  const [videoMinimized, setVideoMinimized] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [ambianceOpen, setAmbianceOpen] = useState(false);
  const [ambianceOverride, setAmbianceOverride] = useState<AmbiancePresetId | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const expired = !isPersistent && expiresAt
    ? now >= new Date(expiresAt).getTime()
    : false;

  const activeAmbiance = ambianceOverride ?? customization.ambiancePreset;
  const moodLabel = ambianceMeta(activeAmbiance).label;

  const planLabel = useMemo(() => {
    if (isPersistent) return "Together";
    if (roomPackage && isTryPackage(roomPackage)) return "Try";
    if (roomPackage === "date_pack") return "Date Pack";
    if (roomPackage === "long_pack") return "Long Pack";
    return "Try";
  }, [isPersistent, roomPackage]);

  // Timer — critical warning at 5 minutes for session rooms.
  const timerModel = useMemo(() => {
    if (isPersistent || !expiresAt) {
      return {
        display: "∞",
        caption: "Open evening",
        criticalTime: false,
        expired: false,
      };
    }
    const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    const criticalTime = remaining > 0 && remaining <= 300;
    return {
      display: `${mm}:${ss}`,
      caption: remaining <= 0
        ? "Window ended"
        : criticalTime
          ? "5 minutes left — add more time"
          : "Time left together",
      criticalTime,
      expired: remaining <= 0,
    };
  }, [isPersistent, expiresAt, now]);

  // Filter tabs by curation
  const curated = useMemo(
    () =>
      curatedActivityIds.length
        ? curatedActivityIds
        : getRoomExperience(roomId),
    [curatedActivityIds, roomId],
  );
  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => {
      if (t.id === "fridge_notes") return wallRoom;
      if (t.id === "bookshelf" || t.curatableId === "vision_board" || t.curatableId === "fridge") {
        if (!wallRoom) return false;
        if (t.curatableId === null) return true;
        return isActivityEnabled(t.curatableId, curated, roomPackage);
      }
      return t.curatableId === null || isActivityEnabled(t.curatableId, curated, roomPackage);
    }),
    [curated, roomPackage, wallRoom],
  );

  const tabBarDividerBefore = useMemo(() => {
    if (!wallRoom) return null;
    const wallIds = new Set(WALL_TABS.map((t) => t.id));
    return visibleTabs.find((t) => !wallIds.has(t.id))?.id ?? null;
  }, [visibleTabs, wallRoom]);

  // If current tab was hidden, fall back
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "chat");
    }
  }, [visibleTabs, tab]);

  const watching = tab === "watch";
  const videoInPip = videoMinimized || (trayExpanded && watching);

  useEffect(() => {
    if (!watching) setVideoMinimized(false);
  }, [watching]);

  function toggleVideoPanel() {
    if (watching) {
      setVideoMinimized((v) => !v);
      setTrayExpanded(false);
      return;
    }
    setTrayExpanded((v) => !v);
  }

  const shellStyle: React.CSSProperties = {
    ...roomAccentStyle(customization.theme),
    background: customization.backgroundCss,
  };

  if (showAtHome) {
    return (
      <PageShell
        orbs={false}
        vignette={false}
        className="min-h-0 h-screen flex flex-col overflow-hidden"
        style={shellStyle}
      >
        <LiveRoomAmbianceBackdrop preset={activeAmbiance} />
        <div className="page-grain" aria-hidden />

        <WelcomeBackGate enabled={wallRoom} />

        <KickedListener
          onKicked={() => {
            toast.message(t("errors.removedFromRoom"));
            void queryClient.invalidateQueries({ queryKey: ["recap", roomId] });
            void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
            navigate("/home");
          }}
        />

        <header className="relative z-30 flex shrink-0 items-center justify-between px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl italic text-cream sm:text-3xl">{t("common.ourRoom")}</h1>
          </div>
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition hover:text-cream"
          >
            {t("common.leave")}
          </button>
        </header>

        <PermanentRoomHome
          partnerStatus={partnerStatus}
          onCallIn={() => enterLiveMode("vision_board")}
          extraTabs={visibleTabs
            .filter(
              (t) =>
                !["vision_board", "fridge_notes", "bookshelf", "watch", "dj"].includes(t.id),
            )
            .map((t) => ({ id: t.id as HomeFeatureId, label: t.label, icon: t.icon }))}
        />

        {showLeaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in pointer-events-auto">
            <div className="w-full max-w-sm mx-4 editorial-card p-8 text-center animate-scale-in">
              <h2 className="font-serif italic text-cream text-xl mb-3">{t("room.leaveConfirmTitle")}</h2>
              <p className="text-sm text-muted-foreground mb-6">{t("room.leaveConfirmBody")}</p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="btn-primary w-full py-3 rounded-full"
                  onClick={() => navigate("/home")}
                >
                  {t("common.leave")}
                </button>
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-cream transition py-2"
                  onClick={() => setShowLeaveConfirm(false)}
                >
                  {t("room.stay")}
                </button>
              </div>
            </div>
          </div>
        )}

        <RoomAmbianceSheet
          open={ambianceOpen}
          onOpenChange={setAmbianceOpen}
          current={activeAmbiance}
          onPick={(id) => setAmbianceOverride(id)}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      orbs={false}
      vignette={false}
      className="min-h-0 h-screen flex flex-col overflow-hidden"
      style={shellStyle}
    >
      <LiveRoomAmbianceBackdrop preset={activeAmbiance} />
      <div className="page-grain" aria-hidden />

      <WelcomeBackGate enabled={wallRoom} />

      <KickedListener
        onKicked={() => {
          toast.message("You were removed from this room");
          void queryClient.invalidateQueries({ queryKey: ["recap", roomId] });
          void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
          navigate("/home");
        }}
      />

      {/* ── Header — metadata strip ── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 glass-subtle z-30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {isPermanentRoom && (
            <button
              type="button"
              onClick={exitLiveMode}
              className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:border-amber/30 hover:bg-white/[0.08] hover:text-cream"
              aria-label={t("room.backToHome")}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <Home className="h-3.5 w-3.5 text-amber" />
              <span className="hidden sm:inline">{t("room.backToHome")}</span>
            </button>
          )}
          <span className="w-1.5 h-1.5 rounded-full bg-rosegold animate-pulse-glow shrink-0" />
          <div className="min-w-0">
            <h1 className="font-serif italic text-cream text-lg sm:text-xl tracking-wide truncate">
              {DATE_NAME || "Our Room"}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground/90 truncate">
              <span className="text-muted-foreground/85">{moodLabel} lighting</span>
              <span className="text-muted-foreground/45"> · </span>
              <span className="text-muted-foreground/70">{planLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!isPersistent && expiresAt && (
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-center",
                  timerModel.expired && "text-destructive",
                )}
              >
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
                  <Clock
                    className={cn(
                      "w-3 h-3 shrink-0",
                      timerModel.criticalTime ? "text-rose-400" : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "tabular-nums",
                      timerModel.criticalTime
                        ? "font-bold text-rose-400 animate-timer-critical-blink"
                        : "font-medium text-cream/90",
                      timerModel.expired && "font-bold text-destructive",
                    )}
                  >
                    {timerModel.display}
                  </span>
                </div>
                {timerModel.caption && !timerModel.criticalTime && (
                  <span
                    className={cn(
                      "hidden sm:inline text-[9px] uppercase tracking-[0.14em] whitespace-nowrap leading-tight",
                      "text-muted-foreground/75",
                    )}
                  >
                    {timerModel.caption}
                  </span>
                )}
              </div>
              {timerModel.criticalTime && (
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  className="shrink-0 self-center rounded-full border border-rose-400/45 bg-rose-500/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300 whitespace-nowrap transition hover:bg-rose-500/25 hover:border-rose-400/60"
                >
                  Add More Time
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setAmbianceOpen(true)}
            aria-label="Set room lighting mood"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-cream hover:bg-secondary/70 transition border border-border/25 hover:border-rosegold/30"
          >
            <Sparkles className="w-3.5 h-3.5 text-rosegold shrink-0" />
            <span className="hidden sm:inline">Light</span>
          </button>
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-cream transition flex items-center gap-1.5 px-1"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave
          </button>
        </div>
      </header>

      {/* ── Main — 60/40 split: video | tabs ── */}
      <main className={cn(
        "flex-1 flex flex-col lg:flex-row gap-3 lg:gap-4 p-3 sm:p-4 min-h-0 z-10",
        expired && "opacity-60 pointer-events-none",
      )}>
        {/* Video section — inline split or floating PiP while watching */}
        <section className={cn(
          "flex flex-col relative",
          videoInPip
            ? "fixed bottom-4 left-4 z-30 w-[min(300px,38vw)] h-[min(240px,30vh)] rounded-2xl glass p-2 shadow-2xl pointer-events-auto"
            : cn(
                "lg:basis-3/5 lg:flex-shrink-0 h-[40vh] lg:h-auto rounded-3xl glass p-3 sm:p-4",
                trayExpanded && !watching ? "hidden lg:flex" : "flex",
              ),
        )}>
          <RoomVideo
            compact={videoInPip}
            onLeave={() => setShowLeaveConfirm(true)}
          />
          {watching && !videoInPip && (
            <button
              type="button"
              aria-label={t("room.minimizeVideo")}
              onClick={() => setVideoMinimized(true)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary/70 border border-border/40 hidden lg:flex items-center justify-center z-20 pointer-events-auto hover:bg-secondary transition"
            >
              <Minimize2 className="w-3.5 h-3.5 text-cream" />
            </button>
          )}
          {videoInPip && (
            <button
              type="button"
              aria-label={t("room.restoreVideo")}
              onClick={() => {
                setVideoMinimized(false);
                setTrayExpanded(false);
              }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-secondary/80 border border-border/40 flex items-center justify-center z-20 pointer-events-auto hover:bg-secondary transition"
            >
              <Maximize2 className="w-3 h-3 text-cream" />
            </button>
          )}
          {!watching && (
            <button
              type="button"
              aria-label={trayExpanded ? t("room.restoreVideo") : t("room.showActivities")}
              onClick={toggleVideoPanel}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center lg:hidden z-20 pointer-events-auto"
            >
              {trayExpanded ? (
                <Maximize2 className="w-3.5 h-3.5 text-cream" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5 text-cream" />
              )}
            </button>
          )}
          {watching && (
            <button
              type="button"
              aria-label={videoInPip ? t("room.restoreVideo") : t("room.minimizeVideo")}
              onClick={toggleVideoPanel}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary/70 border border-border/40 flex items-center justify-center lg:hidden z-20 pointer-events-auto hover:bg-secondary transition"
            >
              {videoInPip ? (
                <Maximize2 className="w-3.5 h-3.5 text-cream" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5 text-cream" />
              )}
            </button>
          )}
        </section>

        {/* Tabbed activity panel */}
        <section className={cn(
          "flex-1 flex flex-col rounded-3xl glass overflow-hidden min-h-0",
          videoInPip ? "w-full" : "lg:basis-2/5 lg:flex-shrink-0 lg:min-h-[480px]",
        )}>
          <LiveRoomTabBar
            tabs={visibleTabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
            activeId={tab}
            onChange={(id) => setTab(id as ActivityTabId)}
            dividerBeforeId={tabBarDividerBefore}
          />
          <div className="flex-1 min-h-0 overflow-auto relative">
            <div className={tab === "vision_board" ? "h-full" : "hidden"}>
              <VisionBoard />
            </div>
            <div className={tab === "fridge_notes" ? "h-full" : "hidden"}>
              <FridgeNotes active={tab === "fridge_notes"} />
            </div>
            <div className={tab === "bookshelf" ? "h-full" : "hidden"}>
              <Bookshelf />
            </div>
            <div className={tab === "questions" ? "h-full" : "hidden"}>
              <QuestionDeck />
            </div>
            <div className={tab === "this_or_that" ? "h-full" : "hidden"}>
              <ThisOrThat />
            </div>
            <div className={tab === "the_36" ? "h-full" : "hidden"}>
              <The36 />
            </div>
            <div className={tab === "2_truths" ? "h-full" : "hidden"}>
              <TwoTruths />
            </div>
            <div className={tab === "truth_or_dare" ? "h-full" : "hidden"}>
              <TruthOrDare />
            </div>
            <div className={tab === "watch" ? "h-full" : "hidden"}>
              <WatchTogether />
            </div>
            <div className={tab === "dj" ? "h-full" : "hidden"}>
              <DJ watchActive={tab === "watch"} />
            </div>
            <div className={tab === "chat" ? "h-full" : "hidden"}>
              <ChatWithBoundary />
            </div>
          </div>
        </section>
      </main>

      {/* ── Leave confirm modal ── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in pointer-events-auto">
          <div className="w-full max-w-sm mx-4 rounded-3xl p-6 glass-strong text-center card-shadow">
            <h2 className="font-serif text-xl text-cream mb-2">Leave the room?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your date night will end. You&apos;ll both see a recap.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 btn-secondary py-3">
                Stay
              </button>
              <button
                onClick={() => navigate("/home")}
                className="flex-1 px-6 py-3 rounded-full bg-destructive text-cream text-sm font-medium hover:bg-destructive/80 transition"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <RoomAmbianceSheet
        open={ambianceOpen}
        onOpenChange={setAmbianceOpen}
        current={activeAmbiance}
        onPick={(id) => setAmbianceOverride(id)}
      />

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-card/95 text-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif italic text-xl">Add more time</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Keep the evening going — add 15 minutes, 30 minutes, or a full hour.
          </p>
          <AddMoreTimeCheckout
            roomId={roomId}
            participantId={session.participantId}
            canPay={session.canPersist}
            onTimeAdded={(next) => {
              onExpiresAtChange(next);
              setUpgradeOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Expired overlay ── */}
      {expired && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="w-full max-w-md mx-4 editorial-card p-8 text-center animate-scale-in">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-4 opacity-90" aria-hidden />
            <h2 className="font-serif italic text-cream text-2xl mb-3">Your window closed</h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              Time&apos;s up — add more minutes to keep the date going.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="btn-primary w-full py-3 rounded-full"
                onClick={() => setUpgradeOpen(true)}
              >
                Add more time
              </button>
              <button
                type="button"
                className="btn-primary w-full py-3 rounded-full"
                onClick={() => navigate(`/room/${roomId}/recap`)}
              >
                View recap
              </button>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-cream transition py-2"
                onClick={() => navigate("/home")}
              >
                Back to rooms
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default function LiveRoom() {
  const { id: roomId } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<RoomIdentity | null>(null);
  const [resolving, setResolving] = useState(true);
  const [roomPackage, setRoomPackage] = useState<RoomPackage | null>(null);
  const [curatedActivityIds, setCuratedActivityIds] = useState<CuratableActivityId[]>([]);
  const [maxParticipants, setMaxParticipants] = useState(2);

  const slot = params.get("slot") || "a";
  const participantId = params.get("participant_id") || undefined;
  const urlName = params.get("name") || undefined;
  const urlExpiresAt = params.get("expires_at") || null;
  const timePurchased = params.get("time_purchased") === "1";
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(urlExpiresAt);

  useEffect(() => {
    setSessionExpiresAt(urlExpiresAt);
  }, [urlExpiresAt]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = authClient.getSession();
      if (cancelled) return;

      if (session) {
        const u = session.user;
        const name = urlName || u.display_name || u.email?.split("@")[0] || "You";
        // Signed-in users authorise LiveKit + durable writes via their token,
        // so no participant_id is needed; the host is slot "a".
        setIdentity({
          senderId: u.id,
          slot,
          participantId: undefined,
          isHost: !participantId,
          canPersist: true,
          displayName: name,
          photoUrl: u.photo_url ?? null,
        });
      } else if (participantId) {
        // Anonymous guest from the lobby join.
        setIdentity({
          senderId: `guest-${participantId}`,
          slot,
          participantId,
          isHost: false,
          canPersist: false,
          displayName: urlName || "Guest",
          photoUrl: null,
        });
      } else {
        navigate(`/auth?next=${encodeURIComponent(`/room/${roomId ?? ""}`)}`, { replace: true });
        return;
      }
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, slot, participantId, urlName, navigate]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const cached = getRoomPlan(roomId);
    if (cached) {
      setRoomPackage(cached.package);
      setCuratedActivityIds(cached.curatedActivityIds);
      if (cached.maxParticipants) {
        setMaxParticipants(cached.maxParticipants);
      }
    }

    void (async () => {
      try {
        const exp = await getRoomExperienceApi(roomId, participantId);
        if (cancelled) return;
        const plan = saveRoomPlanFromServer(roomId, exp);
        setRoomPackage(plan.package);
        setCuratedActivityIds(plan.curatedActivityIds);
        if (plan.maxParticipants) {
          setMaxParticipants(plan.maxParticipants);
        }
        if (exp.expires_at) {
          setSessionExpiresAt(exp.expires_at);
        }
      } catch {
        /* fall back to cached plan or empty until host data loads */
      }
    })();

    const poll = window.setInterval(() => {
      void getRoomExperienceApi(roomId, participantId)
        .then((exp) => {
          if (cancelled) return;
          if (exp.expires_at) {
            setSessionExpiresAt(exp.expires_at);
          }
        })
        .catch(() => undefined);
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [roomId, participantId]);

  useEffect(() => {
    if (!roomId || !timePurchased) return;
    let cancelled = false;
    void (async () => {
      try {
        const exp = await getRoomExperienceApi(roomId, participantId);
        if (cancelled) return;
        if (exp.expires_at) {
          setSessionExpiresAt(exp.expires_at);
          toast.success("Extra time added — enjoy your date.");
        }
      } catch {
        /* webhook may still be processing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, participantId, timePurchased]);

  if (!roomId) return <Loading label="Reconnecting…" />;
  if (resolving || !identity) return <Loading label="Opening the door…" />;

  return (
    <RoomSessionProvider
      roomId={roomId}
      identity={identity}
      roomPackage={roomPackage}
      curatedActivityIds={curatedActivityIds}
      maxParticipants={maxParticipants}
    >
      <RoomCustomizationProvider>
        <RoomShell
          expiresAt={sessionExpiresAt}
          onExpiresAtChange={setSessionExpiresAt}
          isHost={identity.isHost}
          roomId={roomId}
          roomPackage={roomPackage}
          curatedActivityIds={curatedActivityIds}
        />
      </RoomCustomizationProvider>
    </RoomSessionProvider>
  );
}
