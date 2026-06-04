import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LogOut, LayoutGrid, Clock } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { RoomSessionProvider, type RoomIdentity } from "@/context/RoomSessionContext";
import { RoomVideo } from "@/components/RoomVideo";
import { ActivityTray } from "@/components/ActivityTray";
import { MediaMiniPlayer } from "@/components/MediaMiniPlayer";
import { authClient } from "@/lib/authClient";
import { DATE_NAME } from "@/lib/room";

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

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const color = remaining <= 30 ? "text-rose" : remaining <= 120 ? "text-amber" : "text-cream/90";
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur px-3 py-1.5">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      <span className={`tabular-nums text-sm font-medium ${color}`}>
        {mm}:{ss}
      </span>
    </div>
  );
}

function RoomShell({ expiresAt, isHost, roomId }: { expiresAt: string | null; isHost: boolean; roomId: string }) {
  const navigate = useNavigate();
  const [trayOpen, setTrayOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  // Which activity is currently in front of the user — drives the
  // media-mini-player visibility (hides when its activity is open).
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  // When the mini-player asks the tray to open a specific activity,
  // we set this and the tray clears it via onExternalOpenHandled.
  const [externalOpen, setExternalOpen] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const expired = expiresAt
    ? now >= new Date(expiresAt).getTime()
    : false;

  return (
    <PageShell
      orbs={false}
      vignette={false}
      grain={false}
      className="h-screen flex overflow-hidden bg-[#0a0508]"
    >
      {/* Left column: video + chrome (full width on mobile, flex-1 beside the panel on desktop) */}
      <div className="flex-1 min-w-0 flex flex-col relative">
      {/* Header chrome over the video */}
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 sm:px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 rounded-full bg-black/45 backdrop-blur px-3 py-1.5 min-w-0 ring-1 ring-white/[0.08]">
          <span className="w-1.5 h-1.5 rounded-full bg-rosegold animate-pulse-glow shrink-0" />
          <h1 className="font-serif italic text-cream text-sm tracking-wide truncate">
            {DATE_NAME || "Our Room"}
          </h1>
        </div>
        {/* Timer is a host-side tool — the guest doesn't get to plan
            around the room's lifespan. Hide it from non-hosts. */}
        {expiresAt && isHost && <Countdown expiresAt={expiresAt} />}
        <button
          onClick={() => setShowLeaveConfirm(true)}
          aria-label="Leave the room"
          className="focus-ring flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur px-2.5 sm:px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-cream transition shrink-0 ring-1 ring-white/[0.08]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </header>

      {/* Full-bleed partner video; LiveKit's own mic/cam controls sit at its base */}
      <main className="flex-1 min-h-0 relative">
        <RoomVideo />
      </main>

      {/* Activities launcher — mobile only; desktop shows the docked panel */}
      <div className="lg:hidden relative z-20 flex justify-center py-3 shrink-0">
        <button
          type="button"
          onClick={() => setTrayOpen(true)}
          className="flex items-center gap-2 rounded-full bg-amber text-primary-foreground px-6 py-3 text-sm font-medium shadow-[0_8px_28px_rgba(212,130,106,0.35)] hover:bg-amber/90 transition"
        >
          <LayoutGrid className="w-4 h-4" /> Activities
        </button>
      </div>
      </div>

      <ActivityTray
        open={trayOpen}
        onClose={() => setTrayOpen(false)}
        onLeave={() => navigate("/home")}
        onActiveActivityChange={setActiveActivityId}
        externalOpenActivityId={externalOpen}
        onExternalOpenHandled={() => setExternalOpen(null)}
      />

      {/* Persistent media mini-player — visible when DJ has a track or
          Watch has a video AND that activity isn't already open. Tap
          opens the activity in the tray (mobile) / docked panel (desktop). */}
      <MediaMiniPlayer
        currentActivityId={activeActivityId}
        onOpenActivity={(id) => {
          setExternalOpen(id);
          // On mobile the tray is hidden by default — pop it up too.
          setTrayOpen(true);
        }}
        // Mobile clears the Activities pill (~72px tall including padding);
        // sit just above it so it doesn't visually collide. Desktop's
        // docked panel never overlaps so 12px is fine there too.
        bottomOffsetPx={80}
      />

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm mx-4 rounded-3xl p-6 glass-strong grain text-center card-shadow">
            <h2 className="font-serif text-xl text-cream mb-2">Leave the room?</h2>
            <p className="text-sm text-muted-foreground mb-6">Your date night will end for you.</p>
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

      {expired && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md mx-4 editorial-card grain p-8 text-center animate-scale-in">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-rosegold/15 ring-1 ring-rosegold/35">
              <Clock className="h-6 w-6 text-rosegold" aria-hidden />
            </div>
            <h2 className="font-serif italic text-cream text-2xl mb-2">The evening's over</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              The room has ended. Your recap stays viewable for the next 24 hours — after that it's gone.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate(`/room/${roomId}/recap`)}
                className="btn-primary focus-ring w-full py-3.5 rounded-full font-semibold"
              >
                View recap
              </button>
              <button
                type="button"
                onClick={() => navigate("/home")}
                className="focus-ring text-muted-foreground hover:text-cream py-2 text-sm transition"
              >
                Back to our rooms
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
      <RoomShell expiresAt={expiresAt} isHost={identity.isHost} roomId={roomId} />
    </RoomSessionProvider>
  );
}
