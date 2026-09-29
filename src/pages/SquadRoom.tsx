/**
 * /squad/room/:id: a squad's room between nights. No cameras and nothing
 * used up: who's here now, starting a night (two of you in the room, or
 * the planned time), planning the next one in everyone's clock, the chat,
 * the wall and the trip board, the league and the nights so far, buying
 * nights, and the squad itself (the sheet). The call lives at /room/:id
 * while a night is on.
 *
 * The page joins the room's channel like the call does (presence, chat and
 * boards all ride it), as the signed-in member; squads need an account.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Moon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Chat } from "@/components/Chat";
import { FridgeNotes } from "@/components/FridgeNotes";
import { PageShell } from "@/components/PageShell";
import { VisionBoard } from "@/components/VisionBoard";
import { SquadBuy } from "@/components/squad/SquadBuy";
import { SquadMembersSheet } from "@/components/squad/SquadMembersSheet";
import { SquadPlanCard } from "@/components/squad/SquadPlanCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChatProvider, useChatRoom } from "@/context/ChatContext";
import { RoomSessionProvider, useRoomSession, type RoomIdentity } from "@/context/RoomSessionContext";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import { listMyRooms, type Room } from "@/lib/rooms";
import {
  getSquadLeague,
  getSquadMembers,
  getSquadNights,
  getSquadPlan,
  nightsLeftLabel,
  startSquadNight,
  type SquadNights,
} from "@/lib/squad";
import {
  START_MIN_PRESENT,
  hereLine,
  hereNow,
  isAutoStarter,
  nightLine,
  plannedStartDue,
} from "@/lib/squadRoom";
import { cn } from "@/lib/utils";

/** Broadcast when someone starts a night, so everyone here sees it at once. */
const NIGHT_STARTED = "squad.night_started";

/** Pure: a time as "8:30 PM" in the viewer's own clock. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Pure: "Your free night is waiting. Use it by 28 Oct." or null. */
export function freeNightNote(n: SquadNights): string | null {
  if (!n.free_night_expires_at) return null;
  const d = new Date(n.free_night_expires_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `Your free night is waiting. Use it by ${d}.`;
}

export default function SquadRoom() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const session = authClient.getSession();

  useEffect(() => {
    if (!session) navigate(`/auth?next=${encodeURIComponent(`/squad/room/${id}`)}`, { replace: true });
  }, [session, id, navigate]);

  const rooms = useQuery({ queryKey: ["my-rooms"], queryFn: listMyRooms, enabled: Boolean(session) });
  const room = useMemo(() => rooms.data?.find((r) => r.id === id), [rooms.data, id]);
  const nights = useQuery({
    queryKey: ["squad-nights", id],
    queryFn: () => getSquadNights(id),
    refetchInterval: 30_000,
    enabled: Boolean(session),
    retry: (count, e) => !(e instanceof ApiError && e.status === 403) && count < 2,
  });

  const identity = useMemo<RoomIdentity | null>(() => {
    if (!session) return null;
    const u = session.user;
    return {
      senderId: u.id,
      slot: "a", // seats aren't lettered in a squad; nothing between nights reads it
      isHost: room ? room.host_id === u.id : false,
      canPersist: true,
      displayName: u.display_name || u.email?.split("@")[0] || "You",
      photoUrl: u.photo_url ?? null,
    };
    // Rebuild only when who I am (or my ownership) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, room?.host_id]);

  if (nights.error instanceof ApiError && nights.error.status === 403) {
    return (
      <PageShell className="flex items-center justify-center px-6 py-16">
        <div className="editorial-card max-w-sm space-y-3 p-6 text-center">
          <h1 className="font-serif text-2xl text-cream">You're no longer in this room</h1>
          <Link to="/home" className="text-sm text-primary hover:underline">
            Go home
          </Link>
        </div>
      </PageShell>
    );
  }
  if (!identity || !id) return null;

  return (
    <RoomSessionProvider
      roomId={id}
      identity={identity}
      roomPackage="squad"
      maxParticipants={nights.data?.seats ?? room?.max_participants ?? 5}
    >
      <ChatProvider>
        <SquadRoomBody roomId={id} room={room} nights={nights.data} />
      </ChatProvider>
    </RoomSessionProvider>
  );
}

type Tab = "chat" | "wall" | "board" | "league" | "nights";
const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "wall", label: "Wall" },
  { id: "board", label: "Trip board" },
  { id: "league", label: "League" },
  { id: "nights", label: "Our nights" },
];

function SquadRoomBody({ roomId, room, nights: n }: { roomId: string; room: Room | undefined; nights: SquadNights | undefined }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const live = useRoomSession();
  const chat = useChatRoom();
  const [params, setParams] = useSearchParams();
  const [confirmStart, setConfirmStart] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [now, setNow] = useState(() => Date.now());

  const members = useQuery({ queryKey: ["squad-members", roomId], queryFn: () => getSquadMembers(roomId), refetchInterval: 60_000 });
  const plan = useQuery({ queryKey: ["squad-plan", roomId], queryFn: () => getSquadPlan(roomId), refetchInterval: 30_000 });

  const here = useMemo(() => hereNow(live.presence, members.data?.members ?? []), [live.presence, members.data]);
  const hereIds = useMemo(() => new Set(here.map((p) => p.userId)), [here]);
  const me = members.data?.members.find((m) => m.user_id === live.senderId) ?? null;
  const names = useMemo(
    () =>
      Object.fromEntries(
        (members.data?.members ?? []).filter((m) => m.user_id).map((m) => [m.user_id as string, m.display_name]),
      ),
    [members.data],
  );

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["squad-nights", roomId] });
    void qc.invalidateQueries({ queryKey: ["squad-prices", roomId] });
  };

  // Someone new in the room: they may not be on the list yet.
  useEffect(() => {
    if (here.some((p) => !p.member)) void qc.invalidateQueries({ queryKey: ["squad-members", roomId] });
  }, [here, qc, roomId]);

  // Back from a card payment; and tidy what the invite join and the call
  // screen left on the URL (the room doesn't use them).
  useEffect(() => {
    if (params.get("squad_purchased")) {
      toast.success("Payment received. Your nights are being added.");
      refresh();
    }
    const leftovers = ["squad_purchased", "session_id", "live", "participant_id", "slot", "name"];
    if (leftovers.some((k) => params.has(k))) {
      leftovers.forEach((k) => params.delete(k));
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A friend started the night: show it now rather than on the next poll.
  useEffect(
    () =>
      live.channel.onBroadcast((e) => {
        if (e.kind !== NIGHT_STARTED) return;
        refresh();
        const by = typeof e.payload.by === "string" ? e.payload.by : "Someone";
        toast.success(`${by} started the night`, {
          action: { label: "Join", onClick: () => navigate(`/room/${roomId}`) },
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live.channel, roomId],
  );

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const start = useMutation({
    mutationFn: () => startSquadNight(roomId),
    onSuccess: () => {
      void live.channel.broadcast(NIGHT_STARTED, { by: live.displayName });
      navigate(`/room/${roomId}`);
    },
    onError: (e) => {
      const code = e instanceof ApiError ? (e.body as { detail?: { error?: string } })?.detail?.error : null;
      if (code === "night_in_progress") {
        // Someone beat us to it: it's on, so go in.
        navigate(`/room/${roomId}`);
        return;
      }
      toast.error(
        code === "no_nights_left"
          ? "No nights left. Top up the room below."
          : code === "squad_cost_cap"
            ? "Squad nights are paused for today. Try again tomorrow."
            : "The night didn't start. Try again.",
      );
      refresh();
    },
  });

  // The planned time: once two of us are in, one browser starts the night.
  const nextAt = plan.data?.next_night_at ?? null;
  const triedFor = useRef<string | null>(null);
  const enough = here.length >= START_MIN_PRESENT;
  useEffect(() => {
    if (!n || n.active_night || n.nights_left === 0 || !nextAt || !enough) return;
    if (!plannedStartDue(nextAt, now) || !isAutoStarter(here, live.senderId)) return;
    if (triedFor.current === nextAt || start.isPending) return;
    triedFor.current = nextAt;
    toast.message("It's time. Starting the night…");
    start.mutate();
  }, [n, nextAt, enough, now, here, live.senderId, start]);

  const name = room?.greeting_headline?.trim() || "Our squad";

  return (
    <PageShell className="px-5 pb-16 pt-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link to="/home" className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-cream">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Home
          </Link>
          <SquadMembersSheet room={room} members={members.data} selfUserId={live.senderId} hereIds={hereIds} />
        </div>

        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary/85">Squad room</p>
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-cream">{name}</h1>
          {n && (
            <p className="text-sm text-muted-foreground">
              {nightsLeftLabel(n)} · {n.seats} seats
            </p>
          )}
        </header>

        {!n ? (
          <div className="editorial-card flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : n.active_night ? (
          <section className="editorial-card space-y-3 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Moon className="h-4 w-4" aria-hidden /> Night {n.active_night.number} is on
            </div>
            <p className="text-sm text-muted-foreground">
              Ends at {clockTime(n.active_night.ends_at)} your time · {n.active_night.seats} seats tonight
            </p>
            <button
              type="button"
              onClick={() => navigate(`/room/${roomId}`)}
              className="btn-primary focus-ring w-full rounded-full py-3.5 font-semibold"
            >
              Join the night
            </button>
          </section>
        ) : (
          <section className="editorial-card space-y-4 p-6">
            <h2 className="font-serif text-2xl text-cream">Between nights</h2>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2" aria-hidden>
                {here.slice(0, 5).map((p) => (
                  <span
                    key={p.userId}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary/25 text-sm font-bold text-cream"
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
              <p className="flex items-center gap-2 text-sm text-cream">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                {hereLine(here, live.senderId)}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              No cameras on, nothing used up. When two of you are here, start a night: 2 hours on one
              clock for everyone.
            </p>
            {freeNightNote(n) && (
              <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-cream">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden /> {freeNightNote(n)}
              </p>
            )}
            <button
              type="button"
              disabled={n.nights_left === 0 || !enough || start.isPending}
              onClick={() => setConfirmStart(true)}
              className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold disabled:opacity-40"
            >
              {start.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Start a night
            </button>
            {!enough && n.nights_left > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Waiting for one more. Send the link or say hi in the chat.
              </p>
            )}
          </section>
        )}

        <SquadPlanCard roomId={roomId} selfParticipantId={me?.participant_id ?? null} />

        <section className="editorial-card overflow-hidden">
          <div role="tablist" aria-label="The room" className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 pt-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "focus-ring relative shrink-0 rounded-t-xl px-3.5 py-2.5 text-sm transition-colors",
                  tab === t.id ? "bg-white/[0.06] font-semibold text-cream" : "text-muted-foreground hover:text-cream",
                )}
              >
                {t.label}
                {t.id === "chat" && tab !== "chat" && (chat?.unread ?? 0) > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                    {chat?.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div role="tabpanel" className={cn(tab === "chat" && "h-[440px]")}>
            {tab === "chat" && <Chat names={names} />}
            {tab === "wall" && (
              <div className="p-4">
                <FridgeNotes />
              </div>
            )}
            {tab === "board" && (
              <div className="p-4">
                <VisionBoard />
              </div>
            )}
            {tab === "league" && <League roomId={roomId} selfUserId={live.senderId} />}
            {tab === "nights" && <NightsLog nights={n} />}
          </div>
        </section>

        <section className="editorial-card space-y-4 p-6">
          <h2 className="font-serif text-2xl text-cream">Add nights</h2>
          <SquadBuy roomId={roomId} onPaid={refresh} />
        </section>
      </div>

      <AlertDialog open={confirmStart} onOpenChange={setConfirmStart}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a night?</AlertDialogTitle>
            <AlertDialogDescription>
              {n
                ? `Uses 1 of your ${n.nights_left} night${n.nights_left === 1 ? "" : "s"}. Two hours, one clock for everyone. If everyone leaves in the first 10 minutes, it doesn't count.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => start.mutate()}>Start the night</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

const GAME_NAMES: Record<string, string> = {
  most_likely: "Most likely to",
  who_said_it: "Who said it",
  imposter: "Imposter",
  spill_tea: "Spill the tea",
  heads_up: "Heads up",
};

function League({ roomId, selfUserId }: { roomId: string; selfUserId: string }) {
  const league = useQuery({ queryKey: ["squad-league", roomId], queryFn: () => getSquadLeague(roomId) });
  if (!league.data) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }
  const rows = [...league.data].sort((a, b) => b.points - a.points);
  if (rows.length === 0 || rows.every((r) => r.points === 0)) {
    return (
      <p className="p-6 text-sm leading-relaxed text-muted-foreground">
        No points yet. Play a game on your next night and the league starts here.
      </p>
    );
  }
  return (
    <ol className="space-y-2 p-4">
      {rows.map((r, i) => {
        const best = Object.entries(r.by_game).sort((a, b) => b[1] - a[1])[0];
        return (
          <li
            key={r.user_id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5",
              r.user_id === selfUserId ? "bg-primary/15" : "bg-white/[0.03]",
            )}
          >
            <span className="w-6 text-center font-serif text-lg text-primary">{i + 1}</span>
            <span className="min-w-0 flex-1 text-sm text-cream">
              <span className="block truncate">{r.display_name}</span>
              {best && best[1] > 0 && (
                <span className="block text-xs text-muted-foreground">Best at {GAME_NAMES[best[0]] ?? best[0]}</span>
              )}
            </span>
            <span className="text-[15px] font-bold tabular-nums text-cream">{r.points}</span>
          </li>
        );
      })}
    </ol>
  );
}

function NightsLog({ nights }: { nights: SquadNights | undefined }) {
  const list = nights?.nights ?? [];
  if (list.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Your first night will show up here.</p>;
  }
  return (
    <ul className="space-y-2 p-4">
      {list.map((night) => (
        <li
          key={night.id}
          className={cn("flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5", night.refunded && "opacity-60")}
        >
          <span className="w-16 shrink-0 font-serif text-sm text-primary">Night {night.number}</span>
          <span className="text-sm text-cream">{nightLine(night)}</span>
        </li>
      ))}
    </ul>
  );
}
