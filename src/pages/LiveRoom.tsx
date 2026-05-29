import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LogOut, LayoutGrid, Clock } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { RoomSessionProvider, type RoomIdentity } from "@/context/RoomSessionContext";
import { RoomVideo } from "@/components/RoomVideo";
import { ActivityTray } from "@/components/ActivityTray";
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

function RoomShell({ expiresAt, isHost }: { expiresAt: string | null; isHost: boolean }) {
  const navigate = useNavigate();
  const [trayOpen, setTrayOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

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
      <header className="relative z-20 flex items-center justify-between gap-2 px-4 sm:px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 rounded-full bg-black/45 backdrop-blur px-3 py-1.5 min-w-0">
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
          className="flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-cream transition shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" /> Leave
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
      <RoomShell expiresAt={expiresAt} isHost={identity.isHost} />
    </RoomSessionProvider>
  );
}
