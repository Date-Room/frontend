/**
 * /squad/room/:id: a squad's room between nights (F1 version). Name,
 * nights left, the night that's on (or "Start a night"), buying nights,
 * who's in, and the invite link. F2 turns this into the full between-
 * nights room (boards, chat, planning, league) and the group call.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Loader2, Moon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { SquadBuy } from "@/components/squad/SquadBuy";
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
import { ApiError } from "@/lib/api";
import { listMyRooms } from "@/lib/rooms";
import {
  getSquadMembers,
  getSquadNights,
  nightsLeftLabel,
  squadInviteUrl,
  startSquadNight,
  type SquadNights,
} from "@/lib/squad";

/** Pure: a time as "8:30 PM" in the viewer's own clock. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Pure: "Your free night lasts until 28 Oct." or null. */
export function freeNightNote(n: SquadNights): string | null {
  if (!n.free_night_expires_at) return null;
  const d = new Date(n.free_night_expires_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `Your free night is waiting. Use it by ${d}.`;
}

export default function SquadRoom() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [confirmStart, setConfirmStart] = useState(false);

  const rooms = useQuery({ queryKey: ["my-rooms"], queryFn: listMyRooms });
  const room = useMemo(() => rooms.data?.find((r) => r.id === id), [rooms.data, id]);
  const nights = useQuery({ queryKey: ["squad-nights", id], queryFn: () => getSquadNights(id), refetchInterval: 30_000 });
  const members = useQuery({ queryKey: ["squad-members", id], queryFn: () => getSquadMembers(id) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["squad-nights", id] });
    void qc.invalidateQueries({ queryKey: ["squad-prices", id] });
  };

  // Back from a card payment.
  useEffect(() => {
    if (params.get("squad_purchased")) {
      toast.success("Payment received. Your nights are being added.");
      refresh();
      params.delete("squad_purchased");
      params.delete("session_id");
      params.delete("live"); // set by the call screen before it sent us here
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useMutation({
    mutationFn: () => startSquadNight(id),
    onSuccess: () => navigate(`/room/${id}`),
    onError: (e) => {
      const code = e instanceof ApiError ? (e.body as { detail?: { error?: string } })?.detail?.error : null;
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

  const n = nights.data;
  const name = room?.greeting_headline?.trim() || "Our squad";
  const invite = room ? squadInviteUrl(room.code, room.pin) : null;

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

  return (
    <PageShell className="px-5 pb-16 pt-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/home" className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-cream">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Home
        </Link>

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
              onClick={() => navigate(`/room/${id}`)}
              className="btn-primary focus-ring w-full rounded-full py-3.5 font-semibold"
            >
              Join the night
            </button>
          </section>
        ) : (
          <section className="editorial-card space-y-3 p-6">
            <h2 className="font-serif text-2xl text-cream">Between nights</h2>
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
              disabled={n.nights_left === 0 || start.isPending}
              onClick={() => setConfirmStart(true)}
              className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold disabled:opacity-40"
            >
              {start.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Start a night
            </button>
          </section>
        )}

        <section className="editorial-card space-y-4 p-6">
          <h2 className="font-serif text-2xl text-cream">Add nights</h2>
          <SquadBuy roomId={id} onPaid={refresh} />
        </section>

        <section className="editorial-card space-y-4 p-6">
          <div className="flex items-center gap-3">
            <h2 className="flex-1 font-serif text-2xl text-cream">Who's in</h2>
            {invite && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(invite);
                  toast.success("Link copied. Anyone with it can join the squad.");
                }}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-sm text-cream hover:bg-white/[0.06]"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copy link
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {(members.data?.members ?? []).map((m) => (
              <li key={m.participant_id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-cream">
                  {(m.display_name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 text-sm text-cream">
                  {m.display_name}
                  {m.city && <span className="text-muted-foreground"> · {m.city}</span>}
                </span>
                {m.role !== "member" && (
                  <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold capitalize text-primary">
                    {m.role === "cohost" ? "Co-host" : "Owner"}
                  </span>
                )}
                {m.new && <span className="text-[11px] text-muted-foreground">New</span>}
              </li>
            ))}
          </ul>
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
