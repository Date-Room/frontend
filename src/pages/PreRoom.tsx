import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Palette,
  MoreVertical,
  UserMinus,
  KeyRound,
} from "lucide-react";
import { CustomizeSheet } from "@/components/CustomizeSheet";
import { PageShell } from "@/components/PageShell";
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
  deleteRoom,
  getRoomByCode,
  kickParticipant,
  rotateRoomPin,
  type Room,
  type InviteCard,
  type ParticipantInfo,
} from "@/lib/rooms";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<CopiedKey>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Server-authoritative list of my rooms — gets us the canonical
  // code/pin/state/expiry without a per-page-load /by-code call.
  const { data: rooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 5_000,
  });
  const room: Room | undefined = rooms?.find((r) => r.id === id);

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
      return { name: p.display_name, photo: p.photo_url, participantId: null };
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

  // Anonymous guests publish `participant_id` on their presence row
  // (see RoomSessionContext.track()). Signed-in partners don't — they
  // aren't kickable from this UI either way. Surfaces the id so the
  // host's Remove action has something to address.
  const kickableGuest = useMemo(() => {
    if (!me) return null;
    for (const p of presence) {
      const uid = (p.user_id ?? p.sender_id) as string | undefined;
      if (!uid || uid === me.id) continue;
      const pid = typeof p.participant_id === "string" ? p.participant_id : null;
      if (!pid) continue;
      const name = (p.display_name ?? p.name) as string | undefined;
      return { participantId: pid, name: name ?? "Guest" };
    }
    return null;
  }, [presence, me]);

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
  const effectivePartnerName = partner?.name ?? presencePartnerName;
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
      const exp = room.expires_at ? `&expires_at=${encodeURIComponent(room.expires_at)}` : "";
      navigate(`/room/${room.id}?slot=a${exp}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the session.");
      setStarting(false);
    }
  }

  async function destroy() {
    if (!room) return;
    if (!window.confirm("Destroy this room? This permanently deletes it and everything in it.")) return;
    try {
      await deleteRoom(room.id);
      toast.success("Room destroyed.");
      navigate("/home");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not destroy the room.");
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
      <header className="mx-auto flex max-w-2xl items-center px-1">
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
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={destroy}
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

      <main className="mx-auto mt-6 w-full max-w-2xl space-y-6 px-4 sm:px-6 lg:max-w-3xl">
        {/* Avatar pair — always renders. Partner side shows the
            person-plus placeholder when unknown. */}
        <div className="flex flex-col items-center gap-3">
          <AvatarPair
            selfPhoto={me?.photo_url ?? null}
            selfName={me?.display_name ?? null}
            partnerPhoto={effectivePartnerPhoto}
            partnerName={effectivePartnerName}
          />
          {/* Title + status line — skeleton until the InviteCard lands. */}
          {!card ? (
            <div className="flex flex-col items-center gap-2">
              <ShimmerSkeleton width={140} height={18} />
              <ShimmerSkeleton width={200} height={12} />
            </div>
          ) : (
            <>
              <p className="text-center text-base font-semibold text-cream">{headerTitle}</p>
              <p
                className={cn(
                  "text-center text-sm",
                  partnerPresent ? "text-primary" : "text-muted-foreground",
                )}
              >
                {statusLine}
              </p>
            </>
          )}
        </div>

        {/* Invite section.
            Mobile / sm / md: single card with code-tiles on top and the
            link/share row beneath, separated by an 'or' rule.
            Desktop (lg+): two cards side-by-side — codes left, link/share
            right — so a wide canvas isn't wasted vertically. */}
        <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {/* Codes card */}
          <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Share a code
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CodeCopyTile
                label="Room ID"
                value={room?.code ?? ""}
                copied={copiedKey === "room-id"}
                loading={!room}
                onCopy={() => room && void copyValue(room.code, "room-id")}
              />
              <CodeCopyTile
                label="PIN"
                value={room?.pin ?? ""}
                copied={copiedKey === "pin"}
                loading={!room}
                onCopy={() => room && void copyValue(room.pin, "pin")}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Tell them the Room ID and PIN — they enter it on the Join screen.
            </p>
          </section>

          {/* 'or' rule — mobile/tablet only. Desktop's grid layout makes
              the divider redundant (cards sit side-by-side). */}
          <div className="flex items-center gap-3 lg:hidden" aria-hidden>
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* Link / share card */}
          <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Send a link
            </p>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <button
                type="button"
                onClick={() => room && void copyValue(inviteUrl, "link")}
                disabled={!room}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm text-cream transition hover:bg-white/5 disabled:opacity-50",
                  copiedKey === "link" && "border-emerald-400/40 text-emerald-200",
                )}
              >
                {copiedKey === "link" ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden /> Link copied
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
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-amber/90 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" aria-hidden /> Share…
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Drops them straight into the room when tapped.
            </p>
          </section>
        </div>

        {/* Helper copy */}
        <p className="rounded-2xl border border-white/[0.08] bg-card/40 p-4 text-center text-sm text-muted-foreground">
          Share the link above. They&apos;ll join from it — then start the session whenever you&apos;re both ready.
        </p>

        {/* Customize + Start / Rejoin */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            disabled={!room}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-[1.15rem] border border-white/15 py-3 text-sm font-medium text-cream transition hover:bg-white/[0.04] disabled:opacity-50"
          >
            <Palette className="h-4 w-4" aria-hidden /> Customize
          </button>
          <button
            type="button"
            onClick={start}
            disabled={!room || starting}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-4 font-semibold disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {live ? "Rejoin" : "Start session"}
          </button>
        </div>
      </main>

      {/* Customize sheet — picks theme + background, saves per tap. */}
      {room && (
        <CustomizeSheet
          roomId={room.id}
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
          initialThemeId={room.theme_color}
          initialBackgroundId={room.background_id}
        />
      )}
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
      <div className="relative z-10 mx-auto min-h-screen w-full px-4 py-6 sm:px-6 sm:py-10">
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
  if (photo) {
    return (
      <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-primary/40">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={photo} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
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
}
