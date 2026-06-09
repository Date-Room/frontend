import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyRooms, type Room } from "@/lib/rooms";
import { LogOut, Clock, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { AmbientSceneStack } from "@/components/AmbientSceneStack";
import type { AmbiancePresetId } from "@/lib/ambiance";
import { ambianceMeta } from "@/lib/ambiance";
import { getRoomExperience, isActivityEnabled, type CuratableActivityId } from "@/lib/roomExperience";
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

const ALL_TABS: TabDef[] = [
  { id: "questions",     label: "Questions",       icon: "💬", curatableId: "questions" },
  { id: "this_or_that",  label: "This or That",    icon: "⚖️", curatableId: "this_or_that" },
  { id: "the_36",        label: "The 36",          icon: "🫶", curatableId: "the_36" },
  { id: "2_truths",      label: "2 Truths",        icon: "🎭", curatableId: "2_truths" },
  { id: "truth_or_dare", label: "Truth or Dare",   icon: "🔥", curatableId: "truth_or_dare" },
  { id: "watch",         label: "Watch",           icon: "📺", curatableId: "watch" },
  { id: "dj",            label: "DJ",              icon: "🎵", curatableId: "dj" },
  { id: "chat",          label: "Chat",            icon: "💭", curatableId: null },
];

/* ───────────────── RoomShell ───────────────── */

function RoomShell({ expiresAt, isHost, roomId }: { expiresAt: string | null; isHost: boolean; roomId: string }) {
  const navigate = useNavigate();
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
  const [trayExpanded, setTrayExpanded] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [ambianceOpen, setAmbianceOpen] = useState(false);
  const [ambianceOverride, setAmbianceOverride] = useState<AmbiancePresetId | null>(null);

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

  // Timer
  const timerModel = useMemo(() => {
    if (isPersistent || !expiresAt) return { display: "∞", caption: "Open evening", lowTime: false, expired: false };
    const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    return {
      display: `${mm}:${ss}`,
      caption: remaining <= 0
        ? "Window ended"
        : remaining <= 180
          ? "Almost time — land the moment"
          : "Time left together",
      lowTime: remaining > 0 && remaining <= 180,
      expired: remaining <= 0,
    };
  }, [isPersistent, expiresAt, now]);

  // Filter tabs by curation
  const curated = useMemo(() => getRoomExperience(roomId), [roomId]);
  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) =>
      t.curatableId === null || isActivityEnabled(t.curatableId, curated),
    ),
    [curated],
  );

  // If current tab was hidden, fall back
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "chat");
    }
  }, [visibleTabs, tab]);

  const shellStyle: React.CSSProperties = {
    ...roomAccentStyle(customization.theme),
    background: customization.backgroundCss,
  };

  return (
    <PageShell
      orbs={false}
      vignette={false}
      className="min-h-0 h-screen flex flex-col overflow-hidden"
      style={shellStyle}
    >
      <LiveRoomAmbianceBackdrop preset={activeAmbiance} />
      <div className="page-grain" aria-hidden />

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
          <span className="w-1.5 h-1.5 rounded-full bg-rosegold animate-pulse-glow shrink-0" />
          <div className="min-w-0">
            <h1 className="font-serif italic text-cream text-lg sm:text-xl tracking-wide truncate">
              {DATE_NAME || "Our Room"}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground/90 truncate">
              <span className="text-muted-foreground/85">{moodLabel} lighting</span>
              <span className="text-muted-foreground/45"> · </span>
              <span className="text-muted-foreground/70">{isPersistent ? "Together" : "Free"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Timer */}
          {isHost && (
            <div className={cn(
              "flex flex-col items-end gap-0.5 text-right",
              timerModel.expired && "text-destructive",
              timerModel.lowTime && "text-amber",
            )}>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                <Clock className="w-3 h-3 shrink-0" />
                <span className={cn(
                  "tabular-nums font-medium",
                  !timerModel.expired && !timerModel.lowTime && "text-cream/90",
                  timerModel.lowTime && "text-amber",
                  timerModel.expired && "text-destructive",
                )}>
                  {timerModel.display}
                </span>
              </div>
              {timerModel.caption && (
                <span className="hidden sm:inline text-[9px] uppercase tracking-[0.14em] text-muted-foreground/75 max-w-[11rem] leading-tight">
                  {timerModel.caption}
                </span>
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
        {/* Video section */}
        <section className={cn(
          "lg:basis-3/5 lg:flex-shrink-0 h-[40vh] lg:h-auto rounded-3xl glass p-3 sm:p-4 relative flex-col",
          trayExpanded ? "hidden lg:flex" : "flex",
        )}>
          <RoomVideo onLeave={() => setShowLeaveConfirm(true)} />
          <button
            type="button"
            aria-label={trayExpanded ? "Expand video area" : "Show activity tray"}
            onClick={() => setTrayExpanded(!trayExpanded)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center lg:hidden z-20 pointer-events-auto"
          >
            {trayExpanded ? (
              <Maximize2 className="w-3.5 h-3.5 text-cream" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5 text-cream" />
            )}
          </button>
        </section>

        {/* Tabbed activity panel */}
        <section className="flex-1 lg:basis-2/5 lg:flex-shrink-0 flex flex-col rounded-3xl glass overflow-hidden min-h-0 lg:min-h-[480px]">
          <div className="sticky top-0 z-20 flex border-b border-border/30 glass-strong overflow-x-auto">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                data-active={tab === t.id}
                className="activity-tab"
              >
                <span className="sm:hidden">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-auto relative">
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

      {/* ── Expired overlay ── */}
      {expired && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="w-full max-w-md mx-4 editorial-card p-8 text-center animate-scale-in">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-4 opacity-90" aria-hidden />
            <h2 className="font-serif italic text-cream text-2xl mb-3">Your window closed</h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              Twenty minutes flies by — upgrade for a longer session next time.
            </p>
            <div className="flex flex-col gap-3">
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

  const slot = params.get("slot") || "a";
  const participantId = params.get("participant_id") || undefined;
  const urlName = params.get("name") || undefined;
  const expiresAt = params.get("expires_at") || null;

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
        navigate(`/auth?redirect=${encodeURIComponent(`/room/${roomId ?? ""}`)}`, { replace: true });
        return;
      }
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, slot, participantId, urlName, navigate]);

  if (!roomId) return <Loading label="Reconnecting…" />;
  if (resolving || !identity) return <Loading label="Opening the door…" />;

  return (
    <RoomSessionProvider roomId={roomId} identity={identity}>
      <RoomCustomizationProvider>
        <RoomShell expiresAt={expiresAt} isHost={identity.isHost} roomId={roomId} />
      </RoomCustomizationProvider>
    </RoomSessionProvider>
  );
}
