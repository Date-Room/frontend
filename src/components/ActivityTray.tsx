import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, LogOut, Gamepad2, Play, Headphones, MessageCircle, DoorOpen, Copy, Check, KeyRound, UserMinus, Loader2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Chat } from "@/components/Chat";
import { WatchTogether } from "@/components/WatchTogether";
import { ThisOrThat } from "@/components/ThisOrThat";
import { DJ } from "@/components/DJ";
import { QuestionDeck } from "@/components/QuestionDeck";
import { The36 } from "@/components/The36";
import { TwoTruths } from "@/components/TwoTruths";
import { TruthOrDare } from "@/components/TruthOrDare";
import { useRoomSession } from "@/context/RoomSessionContext";
import { cn } from "@/lib/utils";
import { kickParticipant, listMyRooms, rotateRoomPin, type Room } from "@/lib/rooms";

/**
 * Activity tray — mobile's category model (Games/Watch/Music/Chat/Room), made
 * web-smart: a docked side panel on desktop / bottom sheet on mobile, and
 * per-activity sizing — "media" activities (Watch, DJ) open WIDE so the video
 * has room, while conversation/games use the standard column.
 */

type ActivityDef = { id: string; label: string; tagline: string; ready: boolean; wide?: boolean };
type Category = { id: string; label: string; Icon: LucideIcon; activities: ActivityDef[] };

const CATEGORIES: Category[] = [
  {
    id: "games",
    label: "Games",
    Icon: Gamepad2,
    activities: [
      { id: "questions", label: "21 Questions", tagline: "Pick 24, swap decks, take turns.", ready: true },
      { id: "this_or_that", label: "This or That", tagline: "Pick blind, reveal together.", ready: true, wide: true },
      { id: "the_36", label: "The 36", tagline: "Three sets of twelve. Get closer.", ready: true },
      { id: "2_truths", label: "2 Truths and a Lie", tagline: "Spot the lie. Swap roles.", ready: true },
      { id: "truth_or_dare", label: "Truth or Dare", tagline: "Three cards each. Two skips. Trades welcome.", ready: true },
    ],
  },
  { id: "watch", label: "Watch", Icon: Play, activities: [{ id: "watch", label: "Watch", tagline: "Sync up something to watch.", ready: true, wide: true }] },
  { id: "music", label: "Music", Icon: Headphones, activities: [{ id: "dj", label: "Music", tagline: "Take turns picking the soundtrack.", ready: true, wide: true }] },
  { id: "chat", label: "Chat", Icon: MessageCircle, activities: [{ id: "chat", label: "Chat", tagline: "Side chat while you play.", ready: true }] },
  { id: "room", label: "Room", Icon: DoorOpen, activities: [{ id: "room_details", label: "Room Details", tagline: "", ready: true }] },
];

/** Host-only "Manage room" panel — code + PIN copy tiles, presence
 * list with kick, rotate-PIN action. Not rendered for guests (the
 * Room tray category itself is hidden from non-hosts). */
function RoomDetails({ onLeave }: { onLeave: () => void }) {
  const session = useRoomSession();
  const [room, setRoom] = useState<Room | null>(null);
  const [copiedKey, setCopiedKey] = useState<"room-id" | "pin" | "link" | null>(null);
  const [rotating, setRotating] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);

  // Pull the room row so we have code + pin (the in-room channel
  // doesn't carry them). Listing my rooms is cheap and uses cached
  // data from PreRoom in most cases.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await listMyRooms();
        if (cancelled) return;
        setRoom(all.find((r) => r.id === session.roomId) ?? null);
      } catch {
        /* leave room null — the rest of the panel still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.roomId]);

  async function copy(value: string, key: "room-id" | "pin" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Couldn't copy.");
    }
  }

  async function onRotate() {
    if (!room || rotating) return;
    if (!window.confirm("Rotate the PIN? The current invite link will stop working.")) return;
    setRotating(true);
    try {
      const updated = await rotateRoomPin(room.id);
      setRoom(updated);
      toast.success("PIN rotated. Re-share the new link.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rotate the PIN.");
    } finally {
      setRotating(false);
    }
  }

  async function onKick(participantId: string, name: string) {
    if (kicking) return;
    if (!window.confirm(`Remove ${name} from the room?`)) return;
    setKicking(participantId);
    try {
      await kickParticipant(session.roomId, participantId);
      // Optimistic local eject — filter out their presence rows until
      // their client tears down. Mirrors mobile's markEjected flow.
      setEjectedIds((prev) => {
        const next = new Set(prev);
        next.add(participantId);
        return next;
      });
      // Broadcast on the room channel so the kicked partner's client
      // navigates home (LiveRoom listens for 'kicked' on the channel).
      // The backend kick only marks left_at — without this broadcast
      // the kicked client just keeps publishing presence.
      try {
        await session.channel.broadcast("kicked", { participant_id: participantId });
      } catch { /* soft-fail — local filter still hides them */ }
      toast.success(`${name} removed.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove that participant.");
    } finally {
      setKicking(null);
    }
  }

  const inviteUrl = room ? `${window.location.origin}/i/${room.code}/${room.pin}` : "";
  // Participants we've optimistically kicked but whose presence row
  // hasn't disappeared yet (the kicked client keeps publishing for a
  // beat before our 'kicked' broadcast reaches it). Filtering them
  // out locally stops the host's UI from looking like nothing happened.
  // Mirrors mobile's `ejectedParticipantIds` set.
  const [ejectedIds, setEjectedIds] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Share — Room ID + PIN tiles, then the link beneath. */}
      <section className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Share</p>
        {room ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <CopyTile label="Room ID" value={room.code} copied={copiedKey === "room-id"} onCopy={() => void copy(room.code, "room-id")} />
              <CopyTile label="PIN" value={room.pin} copied={copiedKey === "pin"} onCopy={() => void copy(room.pin, "pin")} />
            </div>
            <div className="flex items-center gap-3" aria-hidden>
              <span className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">or</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>
            <button
              type="button"
              onClick={() => void copy(inviteUrl, "link")}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm text-cream hover:bg-white/5 transition",
                copiedKey === "link" && "border-emerald-400/40 text-emerald-200",
              )}
            >
              {copiedKey === "link" ? (
                <>
                  <Check className="w-4 h-4" aria-hidden /> Link copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" aria-hidden /> Copy invite link
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onRotate}
              disabled={rotating}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-amber/40 text-amber py-2.5 text-sm hover:bg-amber/10 transition disabled:opacity-50"
            >
              {rotating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <KeyRound className="w-4 h-4" aria-hidden />}
              Rotate PIN
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-card/40 p-4 text-sm text-muted-foreground">Loading…</div>
        )}
      </section>

      {/* People — live presence list with kick. */}
      <section className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">In the room ({session.presence.filter((p) => !(typeof p.participant_id === "string" && ejectedIds.has(p.participant_id))).length})</p>
        <div className="rounded-2xl border border-border bg-card/60 divide-y divide-white/[0.06]">
          {session.presence.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Just you — waiting on your guest.</p>
          ) : (
            session.presence
              .filter((p) => !(typeof p.participant_id === "string" && ejectedIds.has(p.participant_id)))
              .map((p) => {
              const isSelf = p.sender_id === session.senderId;
              // Only guests have participant_id from /join. Signed-in
              // partners join via session and don't expose one to the
              // wire — they aren't kickable from this UI.
              const kickable = !isSelf && typeof p.participant_id === "string";
              return (
                <div key={`${p.sender_id}-${p.slot}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-cream truncate">
                      {p.name || (isSelf ? "You" : "Guest")} {isSelf && <span className="text-muted-foreground text-xs">· you</span>}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Seat {String(p.slot || "?").toUpperCase()} {p.is_host ? "· host" : ""}
                    </p>
                  </div>
                  {kickable && (
                    <button
                      type="button"
                      onClick={() => void onKick(String(p.participant_id), p.name ?? "Guest")}
                      disabled={kicking === p.participant_id}
                      className="flex items-center gap-1.5 rounded-full border border-destructive/30 text-destructive/80 hover:text-destructive hover:bg-destructive/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition disabled:opacity-50"
                    >
                      {kicking === p.participant_id ? (
                        <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                      ) : (
                        <UserMinus className="w-3 h-3" aria-hidden />
                      )}
                      Remove
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={onLeave}
        className="flex items-center justify-center gap-2 rounded-full border border-destructive/40 text-destructive py-3 text-sm hover:bg-destructive/10 transition"
      >
        <LogOut className="w-4 h-4" /> Leave the room
      </button>
    </div>
  );
}

function CopyTile({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      className={cn(
        "group rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-left transition",
        "hover:bg-white/[0.06] hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        copied && "border-emerald-400/40 bg-emerald-400/5",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" aria-hidden /> : <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition" aria-hidden />}
      </div>
      <p className="mt-1 font-serif text-2xl tracking-[0.3em] text-primary tabular-nums select-all">{value}</p>
    </button>
  );
}

function ActivityView({ id, onLeave }: { id: string; onLeave: () => void }) {
  switch (id) {
    case "chat":
      return <Chat />;
    case "watch":
      return <WatchTogether />;
    case "this_or_that":
      return <ThisOrThat />;
    case "dj":
      return <DJ watchActive={false} />;
    case "questions":
      return <QuestionDeck />;
    case "the_36":
      return <The36 />;
    case "2_truths":
      return <TwoTruths />;
    case "truth_or_dare":
      return <TruthOrDare />;
    case "room_details":
      return <RoomDetails onLeave={onLeave} />;
    default:
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <p className="font-serif italic text-cream/70 text-sm max-w-xs leading-relaxed">Coming to the web soon.</p>
        </div>
      );
  }
}

export function ActivityTray({
  open,
  onClose,
  onLeave,
  onActiveActivityChange,
  externalOpenActivityId,
  onExternalOpenHandled,
}: {
  open: boolean;
  onClose: () => void;
  onLeave: () => void;
  /** Optional — notify the parent which activity is in front so the
   *  mini-player can hide when its activity is open. */
  onActiveActivityChange?: (id: string | null) => void;
  /** Optional — when set non-null, the tray navigates to that activity
   *  (and on mobile, opens itself). Parent should clear it back to null
   *  via [onExternalOpenHandled] once handled. */
  externalOpenActivityId?: string | null;
  onExternalOpenHandled?: () => void;
}) {
  // Separate category vs. activity ids so single-activity categories (Watch,
  // Chat) whose ids match their activity can't collide and break "back".
  const [catId, setCatId] = useState<string | null>(null);
  const [actId, setActId] = useState<string | null>(null);
  const { isHost } = useRoomSession();

  // Surface activity changes to the parent (mini-player visibility).
  useEffect(() => {
    onActiveActivityChange?.(actId);
  }, [actId, onActiveActivityChange]);

  // External open requests (from the mini-player).
  useEffect(() => {
    if (!externalOpenActivityId) return;
    // Find the category that hosts this activity so 'back' navigates
    // sensibly.
    const cat = CATEGORIES.find((c) => c.activities.some((a) => a.id === externalOpenActivityId));
    if (cat) setCatId(cat.id);
    setActId(externalOpenActivityId);
    onExternalOpenHandled?.();
  }, [externalOpenActivityId, onExternalOpenHandled]);

  // The Room/Manage category is host-only — guests don't need to see
  // (or accidentally tap into) the host's PIN-rotation + kick controls.
  const visibleCategories = isHost ? CATEGORIES : CATEGORIES.filter((c) => c.id !== "room");

  const category = visibleCategories.find((c) => c.id === catId);
  const activity = visibleCategories.flatMap((c) => c.activities).find((a) => a.id === actId);
  const wide = !!activity?.wide;
  const isMenu = !catId && !actId;

  function openCategory(c: Category) {
    if (c.activities.length === 1) {
      setCatId(c.id);
      setActId(c.activities[0].id);
    } else {
      setCatId(c.id);
      setActId(null);
    }
  }
  function back() {
    if (actId) {
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (cat && cat.activities.length > 1) {
        setActId(null); // back to the category list
      } else {
        setActId(null);
        setCatId(null); // single-activity category → back to menu
      }
    } else {
      setCatId(null);
    }
  }
  function close() {
    setActId(null);
    setCatId(null);
    onClose();
  }

  const title = activity ? activity.label : category ? category.label : "Activities";

  return (
    <>
      {open && (
        <button type="button" aria-label="Close" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "z-50 flex flex-col glass-strong",
          "fixed inset-x-0 bottom-0 h-[80vh] rounded-t-3xl border-t border-white/10 transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
          // Desktop docked column; widens for media activities.
          "lg:static lg:z-auto lg:translate-y-0 lg:h-full lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-l transition-[width]",
          wide ? "lg:w-[46vw] xl:w-[42vw]" : "lg:w-[340px] xl:w-[400px]",
        )}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 px-4 py-3 border-b border-border/30 shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-white/20 lg:hidden" aria-hidden />
          {!isMenu ? (
            <button type="button" onClick={back} className="text-muted-foreground hover:text-cream" aria-label="Back">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="flex-1 text-center font-serif italic text-cream">{title}</span>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-cream lg:hidden" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isMenu ? (
            <div className="flex flex-col gap-2 p-4">
              {visibleCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openCategory(c)}
                  className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-card/40 p-4 text-left hover:border-primary/35 hover:bg-white/[0.04] transition"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25 text-primary">
                    <c.Icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 text-cream font-medium">{c.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>
              ))}
            </div>
          ) : actId ? (
            <div className="h-full">
              <ActivityView id={actId} onLeave={onLeave} />
            </div>
          ) : category ? (
            <div className="flex flex-col gap-2 p-4">
              {category.activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActId(a.id)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-4 text-left hover:border-primary/30 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-cream flex items-center gap-2">
                      {a.label}
                      {!a.ready && <span className="text-[9px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-1.5 py-0.5">soon</span>}
                    </p>
                    {a.tagline && <p className="text-xs text-muted-foreground mt-0.5">{a.tagline}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
