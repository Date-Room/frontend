import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  Share2,
  Trash2,
  UserPlus,
  ArrowLeft,
  Loader2,
  MoreVertical,
  UserMinus,
  KeyRound,
  Sparkles,
  RefreshCw,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ShieldCheck,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { RoomLifecycleBanner } from "@/components/RoomLifecycleBanner";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { downloadBlob, isResting, restingReason, roomCapabilities } from "@/lib/roomLifecycle";
import {
  listMyRooms,
  startRoom,
  getRoomByCode,
  getRoomExperienceApi,
  kickParticipant,
  rotateRoomPin,
  updateRoom,
  exportRoom,
  renewRoom,
  requestRoomDestroyOtp,
  confirmRoomDestroy,
  type Room,
  type ParticipantInfo,
} from "@/lib/rooms";
import { ChaperonSetupSheet } from "@/components/ChaperonSetupSheet";
import { RoomAmbianceSheet } from "@/components/RoomAmbianceSheet";
import { RoomThemeChip } from "@/components/RoomThemeChip";
import { AmbientSceneStack } from "@/components/AmbientSceneStack";
import { PLAIN_MOOD, resolveLobbyMood, type LobbyMood } from "@/lib/ambiance";
import { ambianceAccentStyle } from "@/lib/roomAmbiance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  deviceLabel,
  groupDevices,
  loadDevicePreference,
  saveDevicePreference,
} from "@/lib/devices";
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
  hero,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  loading?: boolean;
  hero?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      disabled={loading}
      className={cn(
        "group rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        hero
          ? "border-primary/25 bg-black/35 px-5 py-4 hover:border-primary/45 hover:bg-black/45"
          : "border-primary/20 bg-black/25 px-4 py-2 hover:bg-black/35 hover:border-primary/40",
        copied && "border-emerald-400/40 bg-emerald-400/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "font-semibold uppercase tracking-[0.18em] text-muted-foreground",
            hero ? "text-[11px]" : "text-[10px]",
          )}
        >
          {label}
        </p>
        {copied ? (
          <Check className={cn("text-emerald-300", hero ? "h-4 w-4" : "h-3 w-3")} aria-hidden />
        ) : (
          <Copy className={cn("text-muted-foreground/70", hero ? "h-4 w-4" : "h-3 w-3")} aria-hidden />
        )}
      </div>
      {loading ? (
        <ShimmerSkeleton width={hero ? 120 : 86} height={hero ? 28 : 20} className="mt-1" />
      ) : (
        <p
          className={cn(
            "font-semibold tracking-[0.2em] text-primary tabular-nums select-all",
            hero ? "mt-1 text-2xl sm:text-3xl" : "text-lg",
          )}
        >
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
  const [moodPreview, setMoodPreview] = useState<LobbyMood | null>(null);
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

  // Device picker — remembered preference per kind ("" = system default).
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState(() => loadDevicePreference("audioinput") ?? "");
  const [selectedCam, setSelectedCam] = useState(() => loadDevicePreference("videoinput") ?? "");
  const groupedDevices = useMemo(() => groupDevices(devices), [devices]);

  // Re-enumerate once the preview grant lands (labels appear) and on hot-plug.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          if (!cancelled) setDevices(list);
        })
        .catch(() => {});
    };
    refresh();
    navigator.mediaDevices.addEventListener?.("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
    };
  }, [stream]);

  function pickMic(id: string) {
    setSelectedMic(id);
    saveDevicePreference("audioinput", id || null);
  }
  function pickCam(id: string) {
    // Persist + swap the live preview to the chosen camera (via effect dep).
    setSelectedCam(id);
    saveDevicePreference("videoinput", id || null);
  }

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
        .getUserMedia({
          video: selectedCam ? { deviceId: { ideal: selectedCam } } : true,
          audio: false,
        })
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
  }, [cameraEnabled, selectedCam]);

  // Server-authoritative list of my rooms — gets us the canonical
  // code/pin/state/expiry without a per-page-load /by-code call.
  const { data: rooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 5_000,
  });
  const room: Room | undefined = rooms?.find((r) => r.id === id);

  // Chaperon availability (server flag AND session room). Lets us pre-set the
  // user's chaperon preferences before they enter.
  const [chaperonSetupOpen, setChaperonSetupOpen] = useState(false);
  const { data: chaperonExp } = useQuery({
    queryKey: ["room-experience-chaperon", room?.id],
    queryFn: () => getRoomExperienceApi(room!.id),
    enabled: !!room && room.persistence !== "persistent",
    staleTime: 60_000,
  });
  const chaperonAvailable = chaperonExp?.chaperon_enabled === true;

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
    // Persistent-room members are tied to their accounts and can't be removed.
    if (room?.persistence === "persistent") return null;
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
  }, [card, presence, me, room?.persistence]);

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

  // Share URL: `/i/CODE/PIN`. Deliberately no `#k=<recap-invite>` tail —
  // the public by-code card already carries the same token (the Lobby
  // reads it from there), and a 230-character link reads as spam in a
  // chat. Short link, per-room preview card.
  const inviteUrl = room ? `${window.location.origin}/i/${room.code}/${room.pin}` : "";
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

  const currentMood: LobbyMood =
    moodPreview ?? resolveLobbyMood(room?.background_id ?? undefined);

  async function onRenew() {
    if (!room) return;
    try {
      await renewRoom(room.id);
      await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      await queryClient.invalidateQueries({ queryKey: ["entitlement"] });
      toast.success(isResting(room) ? "The room is back." : "Room kept — 30 more days.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't renew the room.";
      if (/subscription|credit|402/i.test(msg)) {
        toast.message("No Together credits left — buy one to renew.");
        navigate("/home?tab=profile");
        return;
      }
      toast.error(msg);
    }
  }

  async function onSaveCopy() {
    if (!room) return;
    try {
      const blob = await exportRoom(room.id);
      downloadBlob(blob, `dateroom-${room.code}.zip`);
      toast.success("Your copy is downloading.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save a copy.");
    }
  }

  async function onPickTheme(id: LobbyMood) {
    if (!room) return;
    setMoodPreview(id);
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
      if (room.persistence === "persistent") {
        await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
        toast.success("We've told your partner. The room closes in 72 hours unless one of you keeps it.");
        setDestroyOpen(false);
      } else {
        toast.success("Room destroyed.");
        navigate("/home");
      }
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
        <div className="pr-pre-room mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[min(1320px,97vw)] flex-col px-2 pb-3 sm:px-3">
          <div className="pr-pre-room__card relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[#100e14]/85 px-6 py-16 text-center shadow-[0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <span className="pr-pre-room__glow" aria-hidden />
            <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Closed door
            </p>
            <p className="relative z-10 mt-3 font-serif text-2xl italic text-cream sm:text-3xl">
              This room isn&apos;t here anymore
            </p>
            <p className="relative z-10 mt-2 max-w-sm text-sm text-muted-foreground">
              It may have been deleted, expired, or you might not have access.
            </p>
            <button
              type="button"
              className="btn-primary relative z-10 mt-8 rounded-full px-8 py-3 text-sm font-semibold"
              onClick={() => navigate("/home")}
            >
              Back to home
            </button>
          </div>
        </div>
      </PreRoomShell>
    );
  }

  const roomActionsMenu = room ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Room actions"
          className="focus-ring rounded-full p-2 text-muted-foreground transition hover:bg-white/[0.04] hover:text-cream"
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
          <DropdownMenuItem onClick={() => void onRenew()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Keep the room
          </DropdownMenuItem>
        )}
        {room.persistence === "persistent" && roomCapabilities(room).can_export && (
          <DropdownMenuItem onClick={() => void onSaveCopy()} className="gap-2">
            <Download className="h-4 w-4" /> Save a copy
          </DropdownMenuItem>
        )}
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
              <Trash2 className="h-4 w-4" /> Close this room
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <PreRoomShell
      mood={room?.persistence === "persistent" ? currentMood : undefined}
    >
      <div className="pr-pre-room mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[min(1320px,97vw)] flex-col px-2 pb-3 sm:px-3">
        <div className="pr-pre-room__card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[#100e14]/85 shadow-[0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <span className="pr-pre-room__glow" aria-hidden />

          <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => navigate("/home")}
              aria-label="Back"
              className="focus-ring -ml-1 rounded-full p-2 text-muted-foreground transition hover:bg-white/[0.04] hover:text-cream"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-xl italic text-cream sm:text-2xl">
                {room?.greeting_headline?.trim() || (room ? room.code : "Your room")}
              </p>
              <p className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {live ? "Session in progress" : "Before you walk in"}
              </p>
            </div>
            {partnerPresent && (
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
                Partner online
              </span>
            )}
            {room?.persistence === "persistent" && (
              <RoomThemeChip
                current={currentMood}
                onClick={() => setThemeOpen(true)}
                className="hidden sm:inline-flex"
              />
            )}
            {roomActionsMenu}
          </header>

          {room && isResting(room) && (
            <div className="relative z-10 border-b border-white/[0.06] px-3 py-3 sm:px-4">
              <RoomLifecycleBanner
                room={room}
                meId={me?.id ?? null}
                partnerName={effectivePartnerName}
              />
            </div>
          )}

          <div className="relative z-10 grid min-h-0 flex-1 lg:grid-cols-[1.08fr_0.92fr]">
            {/* Left — mirror check fills the column height */}
            <section className="pr-pre-room__stage flex min-h-[min(52vh,28rem)] flex-col border-b border-white/[0.06] lg:min-h-0 lg:border-b-0 lg:border-r">
              <div className="relative min-h-0 flex-1 overflow-hidden bg-black/50">
                {cameraEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                      <VideoOff className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-medium">Camera is turned off</p>
                    <p className="max-w-xs text-xs text-muted-foreground/80">
                      You can still enter — toggle video anytime in the room.
                    </p>
                  </div>
                )}
                <span className="pr-pre-room__vignette" aria-hidden />
                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cream/80 backdrop-blur-md">
                  Mirror check
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md",
                      micEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
                    )}
                  >
                    {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                    {micEnabled ? "Mic ready" : "Muted"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMicEnabled(!micEnabled)}
                      aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
                      className={cn(
                        "focus-ring flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition",
                        micEnabled
                          ? "border-white/15 bg-black/50 text-cream hover:bg-black/65"
                          : "border-rose-500/40 bg-rose-500/25 text-rose-200",
                      )}
                    >
                      {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraEnabled(!cameraEnabled)}
                      aria-label={cameraEnabled ? "Turn off camera" : "Turn on camera"}
                      className={cn(
                        "focus-ring flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition",
                        cameraEnabled
                          ? "border-white/15 bg-black/50 text-cream hover:bg-black/65"
                          : "border-rose-500/40 bg-rose-500/25 text-rose-200",
                      )}
                    >
                      {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {(groupedDevices.audioinput.length > 0 || groupedDevices.videoinput.length > 0) && (
                <div className="shrink-0 border-t border-white/[0.06] bg-black/20 px-4 py-3 sm:px-5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {groupedDevices.audioinput.length > 0 && (
                      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Microphone
                        <select
                          value={selectedMic}
                          onChange={(e) => pickMic(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm normal-case tracking-normal text-cream focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">System default</option>
                          {groupedDevices.audioinput.map((d, i) => (
                            <option key={d.deviceId || i} value={d.deviceId}>
                              {deviceLabel(d, i, "audioinput")}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {groupedDevices.videoinput.length > 0 && (
                      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Camera
                        <select
                          value={selectedCam}
                          onChange={(e) => pickCam(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm normal-case tracking-normal text-cream focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">System default</option>
                          {groupedDevices.videoinput.map((d, i) => (
                            <option key={d.deviceId || i} value={d.deviceId}>
                              {deviceLabel(d, i, "videoinput")}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    These settings carry over when you enter the room.
                  </p>
                </div>
              )}
            </section>

            {/* Right — who's here + door codes + enter */}
            <section className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:gap-5 sm:p-6">
              {room?.persistence === "persistent" && (
                <div className="sm:hidden">
                  <RoomThemeChip
                    current={currentMood}
                    onClick={() => setThemeOpen(true)}
                    className="w-full justify-center py-2.5"
                  />
                </div>
              )}

              <div className="pr-pre-room__party rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <AvatarPair
                    selfPhoto={me?.photo_url ?? null}
                    selfName={me?.display_name ?? null}
                    partnerPhoto={effectivePartnerPhoto}
                    partnerName={effectivePartnerName}
                    partnerPresent={partnerPresent}
                    large
                  />
                  <div className="min-w-0 flex-1">
                    {!card ? (
                      <div className="flex flex-col gap-2">
                        <ShimmerSkeleton width={160} height={20} />
                        <ShimmerSkeleton width={220} height={14} />
                      </div>
                    ) : (
                      <>
                        <p className="font-serif text-xl italic text-cream sm:text-2xl">{headerTitle}</p>
                        <p
                          className={cn(
                            "mt-1 text-sm transition-colors",
                            partnerPresent ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {statusLine}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pr-pre-room__invite relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-black/20 to-black/30 p-4 sm:p-5">
                <span className="pr-pre-room__invite-glow" aria-hidden />
                <div className="relative z-10 mb-3 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Door code
                  </p>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">
                    Share to invite
                  </span>
                </div>
                <div className="relative z-10 grid gap-3 sm:grid-cols-2">
                  <CodeCopyTile
                    label="Meeting ID"
                    value={room?.code ?? ""}
                    copied={copiedKey === "room-id"}
                    loading={!room}
                    hero
                    onCopy={() => room && void copyValue(room.code, "room-id")}
                  />
                  <CodeCopyTile
                    label="Passcode"
                    value={room?.pin ?? ""}
                    copied={copiedKey === "pin"}
                    loading={!room}
                    hero
                    onCopy={() => room && void copyValue(room.pin, "pin")}
                  />
                </div>
                <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => room && void copyValue(inviteUrl, "link")}
                    disabled={!room}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-full border border-white/15 bg-black/25 py-3 text-sm font-medium text-cream transition hover:bg-black/35 disabled:opacity-50",
                      copiedKey === "link" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                    )}
                  >
                    {copiedKey === "link" ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" aria-hidden /> Copy link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={share}
                    disabled={!room}
                    className="flex items-center justify-center gap-2 rounded-full bg-amber py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-amber/90 disabled:opacity-50"
                  >
                    <Share2 className="h-4 w-4" aria-hidden /> Invite
                  </button>
                </div>
              </div>

              <div className="mt-auto space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (room && !roomCapabilities(room).can_call) {
                      toast.message(restingReason("can_call", room));
                      return;
                    }
                    start();
                  }}
                  disabled={!room || starting}
                  aria-disabled={room ? !roomCapabilities(room).can_call : undefined}
                  className="btn-primary flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-bold tracking-wide shadow-[0_16px_40px_rgba(232,166,83,0.25)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {starting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
                  {room && !roomCapabilities(room).can_call
                    ? "Room is resting"
                    : live
                      ? "Rejoin room"
                      : "Enter room"}
                </button>
                {chaperonAvailable && (
                  <button
                    type="button"
                    onClick={() => setChaperonSetupOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/[0.12]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Set up chaperon
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <RoomAmbianceSheet
        open={themeOpen}
        onOpenChange={setThemeOpen}
        current={currentMood}
        onPick={(id) => void onPickTheme(id)}
      />

      <ChaperonSetupSheet
        open={chaperonSetupOpen}
        onClose={() => setChaperonSetupOpen(false)}
        variant="preferences"
        roomId={room?.id}
        partnerName={effectivePartnerName}
      />

      <Dialog open={destroyOpen} onOpenChange={(o) => !destroyBusy && setDestroyOpen(o)}>
        <DialogContent className="border-white/10 bg-card/95 text-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-semibold">
              {room?.persistence === "persistent" ? "Close this room?" : "Destroy this room?"}
            </DialogTitle>
          </DialogHeader>
          {destroyStep === "request" ? (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {room?.persistence === "persistent"
                  ? `${effectivePartnerName || "Your partner"} will be told and can save a copy. The room closes in 72 hours unless one of you keeps it. To confirm, we'll email a code to your address.`
                  : "This permanently deletes the room and everything in it — vision board, notes, captures, recap. It can't be undone. To confirm, we'll email a code to your address."}
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
                {room?.persistence === "persistent"
                  ? "Enter the 6-digit code we emailed you to start closing this room."
                  : "Enter the 6-digit code we emailed you to permanently destroy this room."}
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
                {destroyBusy
                  ? "Working…"
                  : room?.persistence === "persistent"
                    ? "Close the room"
                    : "Destroy room permanently"}
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
function PreRoomShell({
  children,
  mood,
}: {
  children: React.ReactNode;
  mood?: LobbyMood;
}) {
  const shellStyle = mood ? ambianceAccentStyle(mood) : undefined;
  return (
    <PageShell className="overflow-hidden" style={shellStyle}>
      {mood ? (
        <>
          <AmbientSceneStack ambiance={mood} positionClassName="pointer-events-none fixed inset-0 z-0" />
          {mood !== PLAIN_MOOD && (
            <div
              className="live-room-ambient pointer-events-none fixed inset-0 z-[1]"
              data-live-ambiance={mood}
              data-photo-backdrop="true"
              aria-hidden
            />
          )}
          <div className="live-room-soft-vignette pointer-events-none fixed inset-0 z-[2]" aria-hidden />
        </>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 120% 80% at 50% 100%, rgba(155, 95, 50, 0.42) 0%, transparent 55%), radial-gradient(circle at 12% 20%, rgba(245, 166, 35, 0.14) 0%, transparent 38%), radial-gradient(circle at 88% 15%, rgba(232,166,83, 0.12) 0%, transparent 36%)",
          }}
        />
      )}
      <div className="relative z-10 mx-auto min-h-[100dvh] w-full py-2 sm:py-3">
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
  partnerPresent,
  large,
}: {
  selfPhoto: string | null;
  selfName: string | null;
  partnerPhoto: string | null;
  partnerName: string | null;
  partnerPresent?: boolean;
  large?: boolean;
}) {
  const partnerEmpty = !partnerName && !partnerPhoto;
  return (
    <div className={cn("flex items-center", large ? "-space-x-3" : "gap-3")}>
      <Avatar64 photo={selfPhoto} name={selfName} size={large ? 72 : 64} />
      <Avatar64
        photo={partnerPhoto}
        name={partnerName}
        awaiting={partnerEmpty}
        size={large ? 72 : 64}
        pulse={partnerPresent && !partnerEmpty}
      />
    </div>
  );
}

function Avatar64({
  photo,
  name,
  awaiting,
  size = 64,
  pulse,
}: {
  photo: string | null;
  name: string | null;
  awaiting?: boolean;
  size?: number;
  pulse?: boolean;
}) {
  const initial = name?.trim() ? name.trim()[0]?.toUpperCase() : null;
  const dim = size >= 72 ? "h-[4.5rem] w-[4.5rem]" : "h-16 w-16";
  const iconSize = size >= 72 ? "h-7 w-7" : "h-6 w-6";
  const initialCls = size >= 72 ? "text-3xl" : "text-2xl";
  const placeholder = (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border-2",
        dim,
        awaiting ? "border-border bg-secondary" : "border-primary/40 bg-primary/12",
      )}
    >
      {awaiting ? (
        <UserPlus className={cn(iconSize, "text-muted-foreground")} strokeWidth={1.5} />
      ) : initial ? (
        <span className={cn(initialCls, "font-semibold text-primary")}>{initial}</span>
      ) : (
        <UserPlus className={cn(iconSize, "text-muted-foreground")} strokeWidth={1.5} />
      )}
    </div>
  );
  const inner = !photo ? (
    placeholder
  ) : (
    <div className={cn("overflow-hidden rounded-full border-2 border-primary/40", dim)}>
      <UserAvatarImg src={photo} fallback={placeholder} className="h-full w-full object-cover" />
    </div>
  );
  if (!pulse) return inner;
  return (
    <span className="pr-pre-room__avatar-pulse relative inline-flex rounded-full">
      {inner}
    </span>
  );
}
