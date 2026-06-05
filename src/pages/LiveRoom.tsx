import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  LogOut,
  LayoutGrid,
  Clock,
  MessageCircle,
  Headphones,
  Play,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { RoomSessionProvider, useRoomSession, type RoomIdentity } from "@/context/RoomSessionContext";
import {
  RoomCustomizationProvider,
  roomAccentStyle,
  useRoomCustomization,
} from "@/context/RoomCustomizationContext";
import { RoomVideo } from "@/components/RoomVideo";
import { ActivityTray } from "@/components/ActivityTray";
import { MediaMiniPlayer } from "@/components/MediaMiniPlayer";
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

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  // Warn-amber follows the room accent; the rose < 30s state stays as
  // a fixed danger colour (the customised theme shouldn't suppress an
  // imminent-end warning).
  const colorClass = remaining <= 30 ? "text-rose" : "text-cream/90";
  const colorStyle =
    remaining > 30 && remaining <= 120 ? { color: "var(--room-accent)" } : undefined;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur px-3 py-1.5">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      <span className={`tabular-nums text-sm font-medium ${colorClass}`} style={colorStyle}>
        {mm}:{ss}
      </span>
    </div>
  );
}

/** Listens for 'kicked' broadcasts on the room channel. If the kicked
 *  participant_id matches our own, we navigate home with a toast.
 *  Mirrors mobile's broadcast listener in live_room_notifier.dart +
 *  pre_room_screen.dart. */
function KickedListener({ onKicked }: { onKicked: () => void }) {
  const session = useRoomSession();
  useEffect(() => {
    const myPid = session.participantId;
    // Signed-in members don't have a participant_id surfaced here, so
    // they can't be addressed by the kick broadcast (the host should
    // use the destroy-room path instead). Guests do.
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

/** Desktop bottom-left presence strip — small Snapchat-style row of
 *  self + partner avatars, halo when they're in the room. Reads the
 *  room channel's presence (we don't have a separate `is_in_call`
 *  signal on web — being in the room and rendering the LiveKit context
 *  is the practical equivalent). Hidden on mobile (lg-) where the
 *  partner already takes the full-bleed video area. */
function DesktopPresenceStrip() {
  const session = useRoomSession();
  // De-dupe presence by sender_id/user_id so a quick re-track during
  // reconnects doesn't render two avatars for the same person.
  const people = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string; photo: string | null; isSelf: boolean }[] = [];
    for (const p of session.presence) {
      const id =
        (typeof p.sender_id === "string" && p.sender_id) ||
        (typeof p.user_id === "string" && p.user_id) ||
        "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name =
        (typeof p.name === "string" && p.name) ||
        (typeof p.display_name === "string" && p.display_name) ||
        (id === session.senderId ? "You" : "Guest");
      const photo =
        (typeof p.photo_url === "string" && p.photo_url) || null;
      out.push({ id, name, photo, isSelf: id === session.senderId });
    }
    // Self always renders even if our own presence hasn't echoed back
    // yet (race on connect). Synthesise a row from the session identity.
    if (!out.some((p) => p.isSelf)) {
      out.unshift({
        id: session.senderId,
        name: session.displayName || "You",
        photo: session.photoUrl ?? null,
        isSelf: true,
      });
    }
    // Self left, partner right.
    out.sort((a, b) => (a.isSelf === b.isSelf ? 0 : a.isSelf ? -1 : 1));
    return out;
  }, [session.presence, session.senderId, session.displayName, session.photoUrl]);

  return (
    <div className="hidden lg:flex absolute left-4 bottom-4 z-30 items-center gap-2 rounded-full bg-black/45 backdrop-blur px-2 py-1.5 ring-1 ring-white/[0.08]">
      {people.map((p) => (
        <PresenceAvatar key={p.id} name={p.name} photo={p.photo} present />
      ))}
    </div>
  );
}

function PresenceAvatar({
  name,
  photo,
  present,
}: {
  name: string;
  photo: string | null;
  present: boolean;
}) {
  const initial = name?.trim()[0]?.toUpperCase() || "?";
  return (
    <div
      className={cn(
        "relative h-9 w-9 overflow-hidden rounded-full transition ring-2",
        present ? "ring-[var(--room-accent)]/85" : "ring-white/15",
      )}
      style={
        present
          ? { boxShadow: "0 0 18px var(--room-accent-soft)" }
          : undefined
      }
      title={name}
    >
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[var(--room-accent-soft)] font-serif text-sm text-cream">
          {initial}
        </div>
      )}
    </div>
  );
}

/** Desktop quick-launch chips — small row of one-tap activity launchers
 *  in the bottom-right of the video. Mirrors mobile's Main-page wrap
 *  grid in spirit: lets the user jump straight into a favourite
 *  activity without going through the category list. Mobile keeps its
 *  Main grid and Activities pill. */
function DesktopQuickLaunch({ onLaunch }: { onLaunch: (id: string) => void }) {
  const chips: { id: string; label: string; Icon: LucideIcon }[] = [
    { id: "chat", label: "Chat", Icon: MessageCircle },
    { id: "dj", label: "Music", Icon: Headphones },
    { id: "watch", label: "Watch", Icon: Play },
    { id: "this_or_that", label: "This or That", Icon: Gamepad2 },
  ];
  return (
    <div className="hidden lg:flex absolute right-4 bottom-4 z-30 items-center gap-1.5 rounded-full bg-black/45 backdrop-blur px-2 py-1.5 ring-1 ring-white/[0.08]">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onLaunch(c.id)}
          title={c.label}
          aria-label={`Open ${c.label}`}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-cream/80 transition hover:bg-white/10 hover:text-cream"
        >
          <c.Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function RoomShell({ expiresAt, isHost, roomId }: { expiresAt: string | null; isHost: boolean; roomId: string }) {
  const navigate = useNavigate();
  const customization = useRoomCustomization();
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

  // Apply the chosen background gradient to the room shell. Defaults
  // to the warm-dark DateRoom gradient when the host hasn't picked one
  // (NEVER transparent — mirrors mobile's _defaultRoomGradient).
  const shellStyle: React.CSSProperties = {
    ...roomAccentStyle(customization.theme),
    background: customization.backgroundCss,
  };

  return (
    <PageShell
      orbs={false}
      vignette={false}
      grain={false}
      className="h-screen flex overflow-hidden"
      style={shellStyle}
    >
      {/* Listen for the host's 'kicked' broadcast. If our participant_id
          is the one being kicked, navigate home with a toast. */}
      <KickedListener
        onKicked={() => {
          toast.message("You were removed from this room");
          navigate("/home");
        }}
      />
      {/* Left column: video + chrome (full width on mobile, flex-1 beside the panel on desktop) */}
      <div className="flex-1 min-w-0 flex flex-col relative">
      {/* Header chrome over the video */}
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 sm:px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 rounded-full bg-black/45 backdrop-blur px-3 py-1.5 min-w-0 ring-1 ring-white/[0.08]">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse-glow shrink-0"
            style={{ backgroundColor: "var(--room-accent)" }}
          />
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
        {/* Desktop overlays — surface the Main-page concepts (presence,
            quick-launch) directly on the canvas instead of burying them
            behind the Activities pill. Both are lg-only; mobile keeps
            the existing single-action layout with the centered call-bar
            and the Activities pill below. */}
        <DesktopPresenceStrip />
        <DesktopQuickLaunch
          onLaunch={(id) => {
            // The tray's `externalOpenActivityId` channel already exists
            // for the mini-player; quick-launch is the same gesture
            // ("open this activity") from a different surface.
            setExternalOpen(id);
          }}
        />
      </main>

      {/* Activities launcher — mobile only; desktop shows the docked panel */}
      <div className="lg:hidden relative z-20 flex justify-center py-3 shrink-0">
        <button
          type="button"
          onClick={() => setTrayOpen(true)}
          className="flex items-center gap-2 rounded-full text-primary-foreground px-6 py-3 text-sm font-medium transition hover:opacity-90"
          style={{
            backgroundColor: "var(--room-accent)",
            boxShadow: "0 8px 28px var(--room-accent-soft)",
          }}
        >
          <LayoutGrid className="w-4 h-4" /> Activities
        </button>
      </div>
      </div>

      {/*
        Talk CTA (desktop) — mobile has a big `_StartCallCard` that
        gates the user into the call. Web doesn't have an equivalent
        gate: LiveKit auto-connects the moment we enter the room and
        the mic/cam are already publishable (subject to browser
        permissions, which `<RoomVideo>` prompts for). The bottom call
        bar inside `<RoomVideo>` already exposes mute/unmute toggles
        and `<DesktopPresenceStrip>` shows the partner's halo when
        they arrive — together those cover the "Join them" affordance
        without a dedicated CTA pill. If we add a manual `connect={false}`
        join step later (e.g. for cellular bandwidth gating), wire the
        pill above the panel header here.
      */}
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
            <div
              className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--room-accent-soft)",
                boxShadow: "inset 0 0 0 1px var(--room-accent)",
              }}
            >
              <Clock className="h-6 w-6" style={{ color: "var(--room-accent)" }} aria-hidden />
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
      <RoomCustomizationProvider>
        <RoomShell expiresAt={expiresAt} isHost={identity.isHost} roomId={roomId} />
      </RoomCustomizationProvider>
    </RoomSessionProvider>
  );
}
