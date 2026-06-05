import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  LayoutGrid,
  Clock,
  MessageCircle,
  Headphones,
  Play,
  Gamepad2,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { RoomSessionProvider, useRoomSession, type RoomIdentity } from "@/context/RoomSessionContext";
import {
  RoomCustomizationProvider,
  roomAccentStyle,
  useRoomCustomization,
} from "@/context/RoomCustomizationContext";
import { ChromeVisibilityContext } from "@/context/ChromeVisibilityContext";
import { RoomVideo } from "@/components/RoomVideo";
import { ActivityTray } from "@/components/ActivityTray";
import { CustomizeSheet } from "@/components/CustomizeSheet";
import { MediaMiniPlayer } from "@/components/MediaMiniPlayer";
import { UserAvatarImg } from "@/components/UserAvatarImg";
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
    <ChromePill>
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      <span className={`tabular-nums text-sm font-medium ${colorClass}`} style={colorStyle}>
        {mm}:{ss}
      </span>
    </ChromePill>
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

/** Shared chrome pill — translucent rounded capsule used by the
 *  header (room name, countdown, leave). Keeps spacing/border/blur
 *  identical so the top edge reads as a row of floating pills, not
 *  a header bar. */
function ChromePill({
  children,
  className,
  asButton,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  asButton?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-xl",
    "border border-white/[0.08]",
    className,
  );
  const style = {
    background:
      "linear-gradient(180deg, rgba(20,16,12,0.55), rgba(20,16,12,0.72))",
    boxShadow:
      "0 14px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
  } as React.CSSProperties;
  if (asButton) {
    return (
      <button {...rest} className={cn(cls, "focus-ring transition hover:bg-white/[0.04]")} style={style}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
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
    <div className="hidden lg:flex items-center gap-2">
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
        "relative h-10 w-10 overflow-hidden rounded-full transition",
        present ? "ring-2 ring-offset-0" : "ring-1 ring-white/15",
      )}
      style={
        present
          ? {
              boxShadow:
                "0 0 24px var(--room-accent-soft), 0 6px 18px rgba(0,0,0,0.45)",
              // Tailwind's `ring-[var(--room-accent)]/85` doesn't compose
              // colour-mix inside `ring` cleanly, so set the colour
              // directly with `--tw-ring-color`.
              ["--tw-ring-color" as string]:
                "color-mix(in srgb, var(--room-accent) 75%, transparent)",
            }
          : undefined
      }
      title={name}
    >
      <UserAvatarImg
        src={photo}
        alt=""
        className="h-full w-full object-cover"
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-[var(--room-accent-soft)] font-serif text-sm text-cream">
            {initial}
          </div>
        }
      />
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
    <div
      className="hidden lg:flex items-center gap-1.5 rounded-full px-2 py-1.5 backdrop-blur-xl border border-white/[0.08]"
      style={{
        background:
          "linear-gradient(180deg, rgba(20,16,12,0.55), rgba(20,16,12,0.72))",
        boxShadow:
          "0 14px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
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

/** Two slow-drifting ambient blooms behind the stage. Sit between the
 *  customised background and the stage frame so the video reads on top
 *  of a deep, lived-in scene rather than a flat wash. Desktop-only —
 *  on mobile they'd compete with the full-bleed video for attention. */
function AmbientBlooms() {
  return (
    <div
      className="pointer-events-none absolute inset-0 hidden lg:block overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute -left-[18%] -top-[20%] h-[60%] w-[60%] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, var(--room-accent-soft) 0%, transparent 70%)",
          opacity: 0.55,
          animation: "drift-bloom-a 32s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-[14%] -bottom-[18%] h-[55%] w-[55%] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--room-accent) 38%, transparent) 0%, transparent 70%)",
          opacity: 0.4,
          animation: "drift-bloom-b 38s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/** Tracks mouse-still for FaceTime-style chrome auto-hide. Always-on
 *  on touch devices (no `mousemove` to detect stillness). */
function useAutoHideChrome(idleMs: number = 3000): {
  visible: boolean;
  /** Mount on the LiveRoom root so all movement bumps it. */
  bind: { onMouseMove: () => void; onMouseLeave: () => void };
  /** Imperative force-show — call from controls that take focus. */
  show: () => void;
} {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);
  const touchOnlyRef = useRef(false);
  // Detect touch-only devices and keep chrome up.
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    touchOnlyRef.current = mq.matches;
    const onChange = () => {
      touchOnlyRef.current = mq.matches;
      if (mq.matches) setVisible(true);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  const arm = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    if (touchOnlyRef.current) {
      setVisible(true);
      return;
    }
    timerRef.current = window.setTimeout(() => setVisible(false), idleMs);
  }, [idleMs]);
  useEffect(() => {
    arm();
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [arm]);
  const show = useCallback(() => {
    setVisible(true);
    arm();
  }, [arm]);
  return {
    visible,
    bind: {
      onMouseMove: show,
      onMouseLeave: () => setVisible(true),
    },
    show,
  };
}

function RoomShell({ expiresAt, isHost, roomId }: { expiresAt: string | null; isHost: boolean; roomId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customization = useRoomCustomization();
  const session = useRoomSession();
  const [trayOpen, setTrayOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // Mirror mobile's docstring on `customize_sheet.dart`: host always;
  // signed-in non-host gets parity for persistent rooms (server enforces
  // the precise rule). Anonymous guests have no auth token and the PATCH
  // would 403 — keep the affordance hidden entirely so they never see a
  // "please sign in to continue" dead-end.
  const canCustomize = isHost || session.canPersist;
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
  const { visible: chromeVisible, bind: autoHideBind } = useAutoHideChrome(3000);
  // Force chrome up whenever the tray opens / a confirm modal shows —
  // otherwise tapping a control could trigger a hide while focus is on
  // the modal.
  const forceChromeOn = trayOpen || showLeaveConfirm || expired;
  const effectiveChromeVisible = chromeVisible || forceChromeOn;

  // Apply the chosen background gradient to the room shell. Defaults
  // to the warm-dark DateRoom gradient when the host hasn't picked one
  // (NEVER transparent — mirrors mobile's _defaultRoomGradient).
  const shellStyle: React.CSSProperties = {
    ...roomAccentStyle(customization.theme),
    background: customization.backgroundCss,
  };

  return (
    <ChromeVisibilityContext.Provider value={effectiveChromeVisible}>
      <PageShell
        orbs={false}
        vignette={false}
        className="h-screen flex overflow-hidden"
        style={shellStyle}
      >
      {/* Listen for the host's 'kicked' broadcast. If our participant_id
          is the one being kicked, navigate home with a toast. */}
      <KickedListener
        onKicked={() => {
          toast.message("You were removed from this room");
          // The host's kick wiped this room's recap-bearing rows
          // server-side. Invalidate our own recap cache so any later
          // visit (e.g. through Home) refetches and shows the
          // post-kick state, not a stale snapshot.
          void queryClient.invalidateQueries({ queryKey: ["recap", roomId] });
          void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
          navigate("/home");
        }}
      />
      {/* Left column: cinematic stage + chrome (full width on mobile,
          flex-1 beside the docked panel on desktop). The mouse-move
          listener feeds the auto-hide; pointermove fires for both
          mouse and trackpad. */}
      <div
        className="flex-1 min-w-0 flex flex-col relative cursor-default"
        onMouseMove={autoHideBind.onMouseMove}
        onMouseLeave={autoHideBind.onMouseLeave}
      >
        {/* Ambient blooms — desktop scene depth behind the stage. */}
        <AmbientBlooms />

      {/* Header chrome — floating pills, no divider, fades out with
          auto-hide. `pointer-events-none` keeps the strip from blocking
          double-tap-to-react on the stage; child pills opt back in. */}
      <header
        className={cn(
          "pointer-events-none relative z-30 flex items-center justify-between gap-2 px-4 sm:px-8 pt-4 shrink-0 transition-all duration-300",
          effectiveChromeVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-2 min-w-0">
          <ChromePill className="min-w-0">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-glow shrink-0"
              style={{ backgroundColor: "var(--room-accent)" }}
            />
            <h1 className="font-serif italic text-cream text-sm tracking-wide truncate">
              {DATE_NAME || "Our Room"}
            </h1>
          </ChromePill>
          {/* Timer is a host-side tool — the guest doesn't get to plan
              around the room's lifespan. Hide it from non-hosts. */}
          {expiresAt && isHost && (
            <div className="pointer-events-auto">
              <Countdown expiresAt={expiresAt} />
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Customize — mirrors mobile's palette icon in the main-room
              header. Hidden for anonymous guests (no auth token, the
              PATCH would 403 anyway). Session rooms: server further
              restricts to host; persistent rooms: host or any signed-in
              participant. */}
          {canCustomize && (
            <ChromePill
              asButton
              onClick={() => setCustomizeOpen(true)}
              aria-label="Customize the room"
              className="text-muted-foreground hover:text-cream"
            >
              <Palette className="w-3.5 h-3.5" />
            </ChromePill>
          )}
          <ChromePill
            asButton
            onClick={() => setShowLeaveConfirm(true)}
            aria-label="Leave the room"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-cream"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </ChromePill>
        </div>
      </header>

      {/* Cinematic stage — partner video floats inside a rounded card on
          desktop (with an outer glow), full-bleed on mobile. The video
          and all in-stage overlays (PIP, reactions, controls) live
          inside RoomVideo. z-10 keeps the stage above the AmbientBlooms
          backdrop. */}
      <main className="flex-1 min-h-0 relative z-10 px-0 pt-4 pb-0 lg:px-8 lg:pt-6">
        <div className="relative h-full w-full overflow-hidden lg:rounded-[28px]" style={{
          boxShadow: "0 40px 100px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), 0 0 60px var(--room-accent-soft)",
        }}>
          <RoomVideo />
        </div>

        {/* Desktop bottom-edge floating row — presence on the left, the
            quick-launch chips on the right. Lives outside the video's
            rounded mask so the avatars get their full halo bloom. Fades
            with chrome. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-8 bottom-7 z-30 hidden lg:flex items-end justify-between transition-all duration-300",
            effectiveChromeVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2",
          )}
        >
          <div className="pointer-events-auto">
            <DesktopPresenceStrip />
          </div>
          <div className="pointer-events-auto">
            <DesktopQuickLaunch
              onLaunch={(id) => {
                // The tray's `externalOpenActivityId` channel already exists
                // for the mini-player; quick-launch is the same gesture
                // ("open this activity") from a different surface.
                setExternalOpen(id);
              }}
            />
          </div>
        </div>
      </main>

      {/* Activities launcher — mobile only; desktop shows the docked panel */}
      <div
        className={cn(
          "lg:hidden relative z-20 flex justify-center py-3 shrink-0 transition-all duration-300",
          effectiveChromeVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3",
        )}
      >
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
        permissions, which `<RoomVideo>` prompts for). The floating
        glass control island inside `<RoomVideo>` exposes mute/unmute
        + camera + photo + reactions, and `<DesktopPresenceStrip>`
        shows the partner's halo when they arrive — together those
        cover the "Join them" affordance without a dedicated CTA pill.
      */}
      <ActivityTray
        open={trayOpen}
        onClose={() => setTrayOpen(false)}
        onLeave={() => navigate("/home")}
        onActiveActivityChange={setActiveActivityId}
        externalOpenActivityId={externalOpen}
        onExternalOpenHandled={() => setExternalOpen(null)}
      />

      {/* Customize sheet — same component PreRoom uses. Mounted only
          when the caller is allowed (host always; signed-in non-host
          for persistent rooms). After each save we broadcast on the
          room channel so the partner's open tab refetches the InviteCard
          and re-themes without a hard reload. */}
      {canCustomize && (
        <CustomizeSheet
          roomId={roomId}
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
          initialThemeId={customization.themeId}
          initialBackgroundId={customization.backgroundId}
          onBroadcast={() => {
            void session.channel.broadcast("customize", {});
            void queryClient.invalidateQueries({ queryKey: ["invite-card"] });
            void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
          }}
        />
      )}

      {/* Persistent media mini-player — visible when DJ has a track or
          Watch has a video AND that activity isn't already open. Tap
          opens the activity in the tray (mobile) / docked panel (desktop).
          Hidden when chrome auto-hides so the scene goes completely
          quiet on mouse-still. */}
      <div
        className={cn(
          "transition-opacity duration-300",
          effectiveChromeVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <MediaMiniPlayer
          currentActivityId={activeActivityId}
          onOpenActivity={(id) => {
            setExternalOpen(id);
            // On mobile the tray is hidden by default — pop it up too.
            setTrayOpen(true);
          }}
          // Sit above the bottom control island (~88px tall including
          // padding) so the two don't overlap. Mobile clears the
          // Activities pill (~72px tall) and the chrome — same value
          // works for both.
          bottomOffsetPx={96}
        />
      </div>

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm mx-4 rounded-3xl p-6 glass-strong text-center card-shadow">
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
          <div className="w-full max-w-md mx-4 editorial-card p-8 text-center animate-scale-in">
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
    </ChromeVisibilityContext.Provider>
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
