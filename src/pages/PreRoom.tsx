import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Share2,
  Trash2,
  UserPlus,
  ArrowLeft,
  Loader2,
  MoreVertical,
  UserMinus,
  KeyRound,
  Sparkles,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  listMyRooms,
  startRoom,
  getRoomByCode,
  kickParticipant,
  rotateRoomPin,
  updateRoom,
  requestRoomDestroyOtp,
  confirmRoomDestroy,
  type Room,
  type ParticipantInfo,
} from "@/lib/rooms";
import { RoomAmbianceSheet } from "@/components/RoomAmbianceSheet";
import { resolveLobbyMood, type LobbyMood } from "@/lib/ambiance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getInvitedGuestName, saveInvitedGuestName } from "@/lib/invitedGuest";
import { saveRoomPlanFromServer, defaultCuratedForPackage } from "@/lib/roomExperience";
import { getMe } from "@/lib/users";
import { RoomChannel, type PresenceState } from "@/lib/realtime/roomChannel";
import { ShimmerSkeleton } from "@/components/ui/skeleton";

type CopiedKey = "room-id" | "pin" | "link" | null;

/** Tap-to-copy chip — compact 18pt accent value with subtle copy glyph
 * in the corner. Mirrors mobile `_IdPinTile` sizing (was bigger and
 * was visually dominating the invite section). */
function CodeCopyTile({
  label,
  value,
  copied,
  onCopy,
  loading,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      disabled={loading}
      className={cn(
        "group rounded-2xl border border-primary/20 bg-black/25 px-4 py-2 text-left transition",
        "hover:bg-black/35 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        copied && "border-emerald-400/40 bg-emerald-400/5",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        {copied ? (
          <Check className="h-3 w-3 text-emerald-300" aria-hidden />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground/70" aria-hidden />
        )}
      </div>
      {loading ? (
        <ShimmerSkeleton width={86} height={20} className="mt-0.5" />
      ) : (
        <p className="text-lg font-semibold tracking-wider text-primary tabular-nums select-all">
          {value}
        </p>
      )}
    </button>
  );
}

/**
 * Host pre-room — mirrors mobile's pre_room_screen.dart.
 *
 * Drops the previous full-screen loader: the layout renders
 * immediately with skeleton placeholders for code/PIN/title while
 * data lands. Avatar pair at the top shows self + partner (placeholder
 * person-plus when unknown). Status line is presence-driven from the
 * room WebSocket — 'X is in the room' when they're online, 'Waiting
 * for them to arrive' when partner is known but offline, and 'No one
 * in the room yet — share the link above' when no partner is paired.
 *
 * Background uses a dark amber-tinted gradient (never transparent) so
 * the screen always feels warm.
 */
export default function PreRoom() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<CopiedKey>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [destroyStep, setDestroyStep] = useState<"request" | "code">("request");
  const [destroyCode, setDestroyCode] = useState("");
  const [destroyBusy, setDestroyBusy] = useState(false);

  const [cameraEnabled, setCameraEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("dr_pre_camera_enabled");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [micEnabled, setMicEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("dr_pre_mic_enabled");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("dr_pre_camera_enabled", String(cameraEnabled));
    } catch {}
  }, [cameraEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem("dr_pre_mic_enabled", String(micEnabled));
    } catch {}
  }, [micEnabled]);

  // Keep streamRef in sync so the cleanup branch always sees the live track.
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Unmount cleanup — stop any lingering camera tracks regardless of state.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (cameraEnabled) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((s) => {
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = s;
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.warn("Camera access denied or unavailable", err);
            setCameraEnabled(false);
          }
        });
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    return () => {
      cancelled = true;
    };
  }, [cameraEnabled]);

  // Server-authoritative list of my rooms — gets us the canonical
  // code/pin/state/expiry without a per-page-load /by-code call.
  const { data: rooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 5_000,
  });
  const room: Room | undefined = rooms?.find((r) => r.id === id);

  // Persist the name the host typed in the create wizard (navigation
  // state on first landing, localStorage on return visits).
  useEffect(() => {
    if (!room?.id) return;
    const fromNav = (location.state as { guestName?: string } | null)?.guestName;
    if (typeof fromNav === "string" && fromNav.trim()) {
      saveInvitedGuestName(room.id, fromNav);
    }
  }, [room?.id, location.state]);

  const invitedGuestName = room?.id ? getInvitedGuestName(room.id) : null;

  // InviteCard fetch via the room code once we know it — gives us
  // partner attribution (the /v1/rooms list endpoint doesn't return
  // participants). Drives the avatar pair + 'Room with X' header.
  const { data: card } = useQuery({
    queryKey: ["invite-card", room?.code],
    queryFn: () => (room ? getRoomByCode(room.code) : Promise.reject("no room")),
    enabled: !!room?.code,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // My profile (display name + photo for the avatar pair).
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Pick the partner participant — anyone whose user_id isn't me. The
  // host's view sometimes won't have the partner in `participants`
  // until they actually join; the row only carries `host_display_name`
  // until then, which is us. Falls back to null (placeholder shown).
  const partner: { name: string; photo: string | null; participantId: string | null } | null = useMemo(() => {
    if (!card) return null;
    for (const p of card.participants as ParticipantInfo[]) {
      if (!p.user_id) continue;
      if (me?.id && p.user_id === me.id) continue;
      return { name: p.display_name, photo: p.photo_url, participantId: p.participant_id };
    }
    return null;
  }, [card, me]);

  // ── Presence — drives the 'X is in the room' status line ────────
  // Open a room channel as soon as we know the room id. We never join
  // the room here (no /join call) — just the websocket presence track
  // so the host sees the partner arrive in real-time.
  const channelRef = useRef<RoomChannel | null>(null);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  useEffect(() => {
    if (!room?.id) return;
    const ch = new RoomChannel(room.id);
    channelRef.current = ch;
    const off = ch.onPresence((p) => setPresence(p));
    void ch.open().then(() => {
      if (me) {
        void ch.track({
          user_id: me.id,
          sender_id: me.id,
          display_name: me.display_name ?? "Host",
          photo_url: me.photo_url ?? null,
          is_host: true,
          slot: "a",
          last_seen: new Date().toISOString(),
        });
      }
    }).catch(() => { /* soft-fail */ });
    return () => {
      off();
      void ch.dispose();
      channelRef.current = null;
    };
  }, [room?.id, me]);

  /** True when someone other than us is currently in the room. */
  const partnerPresent = useMemo(() => {
    if (!me) return false;
    return presence.some((p) => {
      const uid = (p.user_id ?? p.sender_id) as string | undefined;
      return uid && uid !== me.id;
    });
  }, [presence, me]);

  const presencePartnerName = useMemo(() => {
    if (!me) return null;
    for (const p of presence) {
      const uid = (p.user_id ?? p.sender_id) as string | undefined;
      if (!uid || uid === me.id) continue;
      const name = (p.display_name ?? p.name) as string | undefined;
      if (name && name.trim()) return name;
    }
    return null;
  }, [presence, me]);

  // Source the kickable partner from the InviteCard's authoritative
  // participants list (every participant has a participant_id, signed-in
  // or anonymous). Previously we only saw guests because the presence
  // payload only carried participant_id for guests — signed-in partners
  // joined via session, so the host's Remove menu hid for them.
  //
  // Falls back to scanning presence for the rare case where the
  // InviteCard hasn't yet refetched after the partner joined; the
  // presence-derived path stays as a safety net for guests.
  const kickableGuest = useMemo<{ participantId: string; name: string } | null>(() => {
    if (!me) return null;
    if (card) {
      for (const p of card.participants as ParticipantInfo[]) {
        if (p.user_id && p.user_id === me.id) continue; // skip self
        return { participantId: p.participant_id, name: p.display_name || "Guest" };
      }
    }
    // No InviteCard partner yet — fall back to a guest presence row.
    for (const p of presence) {
      const uid = (p.user_id ?? p.sender_id) as string | undefined;
      if (!uid || uid === me.id) continue;
      const pid = typeof p.participant_id === "string" ? p.participant_id : null;
      if (!pid) continue;
      const name = (p.display_name ?? p.name) as string | undefined;
      return { participantId: pid, name: name ?? "Guest" };
    }
    return null;
  }, [card, presence, me]);

  async function onKickPartner() {
    if (!room || !kickableGuest) return;
    if (!window.confirm(`Remove ${kickableGuest.name} from the room?`)) return;
    try {
      await kickParticipant(room.id, kickableGuest.participantId);
      // Broadcast on the room channel so the kicked partner's client
      // navigates home (LiveRoom listens for 'kicked' on the channel).
      try {
        await channelRef.current?.broadcast("kicked", {
          participant_id: kickableGuest.participantId,
        });
      } catch { /* soft-fail — backend kick still freed the seat */ }
      // Backend's kick also wipes the recap-bearing tables for the
      // room. Invalidate the local caches so any reopen shows the
      // fresh state.
      void queryClient.invalidateQueries({ queryKey: ["recap", room.id] });
      void queryClient.invalidateQueries({ queryKey: ["invite-card", room.code] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      toast.success(`${kickableGuest.name} removed.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove that participant.");
    }
  }

  async function onRotatePin() {
    if (!room) return;
    if (!window.confirm("Rotate the PIN? The current invite link will stop working.")) return;
    try {
      await rotateRoomPin(room.id);
      // Invalidate the rooms list so the new PIN lands in the UI
      // immediately. The InviteCard query (keyed by code) is unaffected.
      await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      toast.success("PIN rotated. Re-share the new link.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rotate the PIN.");
    }
  }

  // Effective partner attribution: prefer the InviteCard, fall back
  // to whatever the live presence is announcing (covers the case
  // where the partner is in but the card hasn't refetched yet).
  const effectivePartnerName = partner?.name ?? presencePartnerName ?? invitedGuestName;
  const effectivePartnerPhoto = partner?.photo ?? null;

  // Status line — presence-driven, exactly like mobile.
  const statusLine = (() => {
    if (partnerPresent) {
      const name = (effectivePartnerName ?? "").trim();
      return name ? `${name} is in the room` : "Your partner is in the room";
    }
    if (effectivePartnerName && effectivePartnerName.trim()) {
      return "Waiting for them to arrive";
    }
    return "No one in the room yet — share the link above";
  })();

  const headerTitle = effectivePartnerName?.trim()
    ? `Room with ${effectivePartnerName.trim()}`
    : "Our room";

  // Share URL: `/i/CODE/PIN#k=<recap-invite>`.
  const inviteUrl = room
    ? `${window.location.origin}/i/${room.code}/${room.pin}${
        room.recap_invite_token ? `#k=${room.recap_invite_token}` : ""
      }`
    : "";
  const live = room ? room.state === "live" || room.state === "active" : false;

  async function copyValue(value: string, key: Exclude<CopiedKey, null>) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Couldn't copy — long-press to select.");
    }
  }

  async function share() {
    if (!room) return;
    const msg = `${
      room.greeting_headline ? `${room.greeting_headline}\n\n` : ""
    }Join me on DateRoom: ${inviteUrl}\n\nRoom ID: ${room.code}   PIN: ${room.pin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "DateRoom invite", text: msg });
        return;
      } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(msg).then(
      () => toast.success("Invite copied."),
      () => toast.error("Couldn't share."),
    );
  }

  async function start() {
    if (!room) return;
    setStarting(true);
    try {
      if (!live) await startRoom(room.id);
      // Persistent rooms have no hard cutoff — never forward an
      // expires_at on the URL even if the cached Room still carries a
      // stale session-era stamp. The LiveRoom screen keys "expired"
      // off this param; leaking it makes a live perm room read as ended.
      const exp =
        room.persistence === "persistent" || !room.expires_at
          ? ""
          : `&expires_at=${encodeURIComponent(room.expires_at)}`;
      saveRoomPlanFromServer(room.id, {
        package: room.package,
        curated_activity_ids:
          room.curated_activity_ids ?? defaultCuratedForPackage(room.package),
      });
      navigate(`/room/${room.id}?slot=a${exp}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the session.");
      setStarting(false);
    }
  }

  const currentMood: LobbyMood = resolveLobbyMood(room?.background_id ?? undefined);

  async function onPickTheme(id: LobbyMood) {
    if (!room) return;
    try {
      await updateRoom(room.id, { background_id: id });
      await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      toast.success("Theme updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the theme.");
    }
  }

  async function sendDestroyCode() {
    if (!room) return;
    setDestroyBusy(true);
    try {
      await requestRoomDestroyOtp(room.id);
      setDestroyStep("code");
      toast.success("Confirmation code sent to your email.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setDestroyBusy(false);
    }
  }

  async function confirmDestroy() {
    if (!room || destroyCode.trim().length < 4) return;
    setDestroyBusy(true);
    try {
      await confirmRoomDestroy(room.id, destroyCode.trim());
      toast.success("Room destroyed.");
      navigate("/home");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not destroy the room.");
    } finally {
      setDestroyBusy(false);
    }
  }

  // Fatal-only short-circuit: rooms list resolved, this id isn't in it.
  if (rooms && !room) {
    return (
      <PreRoomShell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
          <p className="font-serif text-xl italic text-cream">Room not found</p>
          <button
            type="button"
            className="auth-mode-switch"
            onClick={() => navigate("/home")}
          >
            Back to home
          </button>
        </div>
      </PreRoomShell>
    );
  }

  return (
    <PreRoomShell>
      {/* Top bar — back + (host) destroy. */}
      <header className="mx-auto flex max-w-4xl items-center px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/home")}
          aria-label="Back"
          className="focus-ring -ml-1 rounded-full p-2 text-muted-foreground transition hover:text-cream hover:bg-white/[0.04]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="ml-2 flex min-w-0 flex-1 flex-col">
          <p className="truncate font-serif text-lg italic text-cream">
            {room?.greeting_headline?.trim() || (room ? room.code : "")}
          </p>
          {(effectivePartnerName?.trim() ?? "") && (
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Room with {effectivePartnerName}
            </p>
          )}
        </div>
        {/* Host actions menu — mirrors mobile's PreRoom kebab. Shows
            Remove partner (when a kickable guest is in the room),
            Rotate PIN, and Destroy room (persistent only). Hidden
            entirely when none of the actions apply. */}
        {room && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Room actions"
                className="focus-ring rounded-full p-2 text-muted-foreground transition hover:text-cream hover:bg-white/[0.04]"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              {kickableGuest && (
                <DropdownMenuItem
                  onClick={() => void onKickPartner()}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <UserMinus className="h-4 w-4" /> Remove {kickableGuest.name}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => void onRotatePin()} className="gap-2">
                <KeyRound className="h-4 w-4" /> Rotate PIN
              </DropdownMenuItem>
              {room.persistence === "persistent" && (
                <DropdownMenuItem onClick={() => setThemeOpen(true)} className="gap-2">
                  <Sparkles className="h-4 w-4" /> Change theme
                </DropdownMenuItem>
              )}
              {room.persistence === "persistent" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setDestroyStep("request");
                      setDestroyCode("");
                      setDestroyOpen(true);
                    }}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Destroy room
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <main className="mx-auto mt-6 w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-start">
          
          {/* Left: Preflight Cam/Mic Check */}
          <div className="md:col-span-7 space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-[24px] border border-white/10 bg-black/45 shadow-2xl flex items-center justify-center">
              {cameraEnabled ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground text-center">
                  <div className="h-16 w-16 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center">
                    <VideoOff className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium">Camera is turned off</p>
                </div>
              )}
              
              {/* Mic/Cam status indicators overlay */}
              <div className="absolute bottom-4 left-4 flex gap-1.5 pointer-events-none">
                <div className={cn(
                  "p-1.5 rounded-lg backdrop-blur-md border border-white/10 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1",
                  micEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                )}>
                  {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  <span>{micEnabled ? "Mic On" : "Muted"}</span>
                </div>
              </div>
            </div>

            {/* Video & Audio Preflight controls */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                {/* Microphone Toggle */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMicEnabled(!micEnabled)}
                    aria-label={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-200 focus-ring shadow-lg",
                      micEnabled
                        ? "bg-white/[0.06] border-white/15 text-cream hover:bg-white/[0.12]"
                        : "bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25"
                    )}
                  >
                    {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </button>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                    {micEnabled ? "Mute" : "Unmute"}
                  </span>
                </div>

                {/* Camera Toggle */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCameraEnabled(!cameraEnabled)}
                    aria-label={cameraEnabled ? "Turn off camera" : "Turn on camera"}
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-200 focus-ring shadow-lg",
                      cameraEnabled
                        ? "bg-white/[0.06] border-white/15 text-cream hover:bg-white/[0.12]"
                        : "bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25"
                    )}
                  >
                    {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </button>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                    {cameraEnabled ? "Stop Video" : "Start Video"}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground text-center max-w-sm mt-1">
                Choose your settings here. They will carry over automatically when you start the date.
              </p>
            </div>
          </div>

          {/* Right: Meeting Details & Actions */}
          <div className="md:col-span-5 space-y-6">
            
            {/* Header info */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col items-center gap-4 text-center backdrop-blur-md shadow-lg">
              <AvatarPair
                selfPhoto={me?.photo_url ?? null}
                selfName={me?.display_name ?? null}
                partnerPhoto={effectivePartnerPhoto}
                partnerName={effectivePartnerName}
              />
              
              {!card ? (
                <div className="flex flex-col items-center gap-2">
                  <ShimmerSkeleton width={140} height={18} />
                  <ShimmerSkeleton width={200} height={12} />
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-base font-semibold text-cream tracking-wide">{headerTitle}</p>
                  <p className={cn(
                    "text-xs font-medium tracking-wide transition-colors duration-200",
                    partnerPresent ? "text-primary animate-pulse" : "text-muted-foreground/85"
                  )}>
                    {statusLine}
                  </p>
                </div>
              )}
            </div>

            {/* Meeting Access Card */}
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 space-y-4 backdrop-blur-md shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-white/5 pb-2 relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/90">
                  Meeting Details
                </span>
                <span className="text-[9px] uppercase font-semibold text-primary/80 bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                  Info
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 relative z-10">
                <CodeCopyTile
                  label="Meeting ID"
                  value={room?.code ?? ""}
                  copied={copiedKey === "room-id"}
                  loading={!room}
                  onCopy={() => room && void copyValue(room.code, "room-id")}
                />
                <CodeCopyTile
                  label="Passcode (PIN)"
                  value={room?.pin ?? ""}
                  copied={copiedKey === "pin"}
                  loading={!room}
                  onCopy={() => room && void copyValue(room.pin, "pin")}
                />
              </div>

              <div className="flex flex-col gap-2 pt-1 relative z-10">
                <button
                  type="button"
                  onClick={() => room && void copyValue(inviteUrl, "link")}
                  disabled={!room}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.02] py-2.5 text-xs text-cream transition hover:bg-white/5 disabled:opacity-50 font-medium",
                    copiedKey === "link" && "border-emerald-500/40 text-emerald-300 bg-emerald-500/5",
                  )}
                >
                  {copiedKey === "link" ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden /> Link copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden /> Copy Invite Link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={share}
                  disabled={!room}
                  className="flex items-center justify-center gap-2 rounded-full bg-amber py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-amber/90 disabled:opacity-50 shadow-md"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden /> Invite Partner...
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={start}
                disabled={!room || starting}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-sm tracking-wide shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {live ? "Rejoin Room" : "Enter Room"}
              </button>
            </div>

          </div>

        </div>
      </main>

      <RoomAmbianceSheet
        open={themeOpen}
        onOpenChange={setThemeOpen}
        current={currentMood}
        onPick={(id) => void onPickTheme(id)}
      />

      <Dialog open={destroyOpen} onOpenChange={(o) => !destroyBusy && setDestroyOpen(o)}>
        <DialogContent className="border-white/10 bg-card/95 text-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-semibold">Destroy this room?</DialogTitle>
          </DialogHeader>
          {destroyStep === "request" ? (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                This permanently deletes the room and everything in it — vision board, notes,
                captures, recap. It can&apos;t be undone. To confirm, we&apos;ll email a code to
                your address.
              </p>
              <button
                type="button"
                onClick={() => void sendDestroyCode()}
                disabled={destroyBusy}
                className="w-full rounded-[1.15rem] bg-destructive py-3.5 text-sm font-semibold text-cream transition hover:bg-destructive/80 disabled:opacity-50"
              >
                {destroyBusy ? "Sending…" : "Email me a code"}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Enter the 6-digit code we emailed you to permanently destroy this room.
              </p>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={destroyCode}
                onChange={(e) => setDestroyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-lg tracking-[0.4em] tabular-nums"
              />
              <button
                type="button"
                onClick={() => void confirmDestroy()}
                disabled={destroyBusy || destroyCode.trim().length < 6}
                className="w-full rounded-[1.15rem] bg-destructive py-3.5 text-sm font-semibold text-cream transition hover:bg-destructive/80 disabled:opacity-50"
              >
                {destroyBusy ? "Destroying…" : "Destroy room permanently"}
              </button>
              <button
                type="button"
                onClick={() => void sendDestroyCode()}
                disabled={destroyBusy}
                className="w-full text-center text-xs text-muted-foreground transition hover:text-cream disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PreRoomShell>
  );
}

/** Outer shell — dark amber-tinted gradient backdrop, never transparent.
 *  Keeps the screen warm even while the InviteCard is still loading. */
function PreRoomShell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell className="overflow-hidden">
      {/* Amber-tinted radial wash sits above the page background so we
          never get a flat dark screen during hydration. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[5]"
        style={{
          background:
            "radial-gradient(ellipse 130% 95% at 50% 118%, rgba(155, 95, 50, 0.45) 0%, transparent 58%), radial-gradient(circle at 18% 18%, rgba(245, 166, 35, 0.18) 0%, transparent 42%), radial-gradient(circle at 85% 12%, rgba(212, 130, 106, 0.16) 0%, transparent 40%)",
        }}
      />
      <div className="relative z-10 mx-auto min-h-screen w-full py-6 sm:py-10">
        {children}
      </div>
    </PageShell>
  );
}

/* ─────────────────────────── Avatar pair ─────────────────────────── */

function AvatarPair({
  selfPhoto,
  selfName,
  partnerPhoto,
  partnerName,
}: {
  selfPhoto: string | null;
  selfName: string | null;
  partnerPhoto: string | null;
  partnerName: string | null;
}) {
  const partnerEmpty = !partnerName && !partnerPhoto;
  return (
    <div className="flex items-center gap-3">
      <Avatar64 photo={selfPhoto} name={selfName} />
      <Avatar64 photo={partnerPhoto} name={partnerName} awaiting={partnerEmpty} />
    </div>
  );
}

function Avatar64({
  photo,
  name,
  awaiting,
}: {
  photo: string | null;
  name: string | null;
  awaiting?: boolean;
}) {
  const initial = name?.trim() ? name.trim()[0]?.toUpperCase() : null;
  const placeholder = (
    <div
      className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full border-2",
        awaiting ? "border-border bg-secondary" : "border-primary/40 bg-primary/12",
      )}
    >
      {awaiting ? (
        <UserPlus className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      ) : initial ? (
        <span className="text-2xl font-semibold text-primary">{initial}</span>
      ) : (
        <UserPlus className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      )}
    </div>
  );
  if (!photo) return placeholder;
  return (
    <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-primary/40">
      <UserAvatarImg
        src={photo}
        fallback={placeholder}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
