/**
 * Shown in place of the video when tonight's seats are all taken.
 *
 * The squad's seats are shared, so only the people who run the squad (the
 * owner and co-hosts, or everyone when the room says so) spend them: they
 * get "Add a seat and join". Anyone else pays for their own seat, or asks
 * the host to lend one; the host sees what lending costs and says yes or
 * not tonight (SeatRequestsBanner). Either way nobody on the call drops off.
 * The app follows this rule whether or not the server enforces it yet
 * (SQUAD_SEAT_CONSENT).
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useMaybeRoomSession } from "@/context/RoomSessionContext";
import { isMpesaStillConfirming, runMpesaPayment } from "@/lib/mpesaFlow";
import {
  SEAT_DECIDED,
  SEAT_PAID,
  addSquadSeat,
  askForSeat,
  canRunSquad,
  cancelSeatRequest,
  formatSquadMoney,
  getSeatRequests,
  getSquadMembers,
  getSquadNights,
  getSquadPrices,
  ownerFirstName,
  seatChoice,
  squadCardCheckout,
  squadDevPurchase,
  squadErrorCode,
  squadErrorText,
  squadStkPush,
  type NightFull,
  type SeatRequest,
} from "@/lib/squad";
import { cn } from "@/lib/utils";

type Ask =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "waiting"; req: SeatRequest }
  | { status: "declined" }
  | { status: "expired" }
  | { status: "recent" };

export function SquadSeatFull({
  roomId,
  full,
  onSeated,
}: {
  roomId: string;
  full: NightFull;
  /** Try the call again: a seat was added, or someone may have left. */
  onSeated: () => void;
}) {
  const session = useMaybeRoomSession();
  // The parent's retry changes on every render; keep listeners steady.
  const seated = useRef(onSeated);
  seated.current = onSeated;
  const nights = useQuery({ queryKey: ["squad-nights", roomId], queryFn: () => getSquadNights(roomId) });
  const members = useQuery({ queryKey: ["squad-members", roomId], queryFn: () => getSquadMembers(roomId) });
  const manager = canRunSquad(members.data);
  const host = ownerFirstName(members.data);
  const balanceChoice = seatChoice(full, nights.data ? nights.data.seat_nights : nights.isError ? 0 : null);
  const mode: "maxed" | "loading" | "use_balance" | "pay" | "ask" = !full.can_add_seat
    ? "maxed"
    : members.isLoading
      ? "loading"
      : manager
        ? balanceChoice
        : "ask";
  const prices = useQuery({
    queryKey: ["squad-prices", roomId, "seat"],
    queryFn: () => getSquadPrices(roomId),
    enabled: mode === "pay" || mode === "ask",
  });
  const seat = prices.data?.products.find((p) => p.product === "squad_seat");
  const canPayHere = Boolean(prices.data && seat && (prices.data.provider !== "store" || prices.data.dev_checkout));
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<Ask>({ status: "idle" });
  const waitingId = ask.status === "waiting" ? ask.req.id : null;

  // The host's answer arrives live; a host who paid for the seat says so too.
  useEffect(() => {
    if (!waitingId || !session) return;
    return session.channel.onBroadcast((e) => {
      if (e.payload.id !== waitingId) return;
      if (e.kind === SEAT_PAID || (e.kind === SEAT_DECIDED && e.payload.status === "lent")) {
        toast.success(`${host} got you a seat. Joining…`);
        seated.current();
      } else if (e.kind === SEAT_DECIDED) {
        setAsk({ status: "declined" });
      }
    });
  }, [waitingId, session, host]);

  // And by polling, in case a live message was missed: once my request is
  // no longer waiting, try the call again (lent: in; otherwise back here).
  useEffect(() => {
    if (ask.status !== "waiting") return;
    const req = ask.req;
    const t = window.setInterval(() => {
      if (Date.now() >= new Date(req.expires_at).getTime()) {
        setAsk({ status: "expired" });
        return;
      }
      void getSeatRequests(roomId)
        .then((r) => {
          if (!r.requests.some((q) => q.id === req.id)) seated.current();
        })
        .catch(() => {});
    }, 10_000);
    return () => window.clearInterval(t);
  }, [ask, roomId]);

  async function askHost() {
    setAsk({ status: "asking" });
    try {
      const req = await askForSeat(roomId);
      setAsk({ status: "waiting", req });
    } catch (e) {
      const code = squadErrorCode(e);
      if (code === "seat_free") {
        onSeated();
        return;
      }
      if (code === "asked_recently") {
        setAsk({ status: "recent" });
        return;
      }
      toast.error(squadErrorText(e, "Couldn't ask just now. Try again."));
      setAsk({ status: "idle" });
    }
  }

  async function withdraw() {
    if (ask.status !== "waiting") return;
    const id = ask.req.id;
    setAsk({ status: "idle" });
    await cancelSeatRequest(roomId, id).catch(() => {});
  }

  async function addFromBalance() {
    setBusy(true);
    try {
      await addSquadSeat(roomId);
      toast.success("Seat added. Joining…");
      onSeated();
    } catch (e) {
      toast.error(squadErrorText(e, "Couldn't add a seat just now."));
      void nights.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    const p = prices.data;
    if (!p) return;
    setBusy(true);
    try {
      if (p.dev_checkout) {
        await squadDevPurchase(roomId, "squad_seat");
      } else if (p.provider === "mpesa") {
        if (!phone.trim()) throw new Error("Enter your M-Pesa number.");
        const number = phone.trim();
        await runMpesaPayment({ label: "seat", start: () => squadStkPush(roomId, "squad_seat", number) });
      } else if (p.provider === "stripe") {
        const { url } = await squadCardCheckout(roomId, "squad_seat");
        window.location.assign(url);
        return;
      }
      if (ask.status === "waiting") void cancelSeatRequest(roomId, ask.req.id).catch(() => {});
      toast.success("Seat paid. Joining…");
      onSeated();
    } catch (e) {
      if (isMpesaStillConfirming(e)) toast.message(e.message);
      else toast.error(squadErrorText(e, e instanceof Error ? e.message : "Payment didn't go through."));
    } finally {
      setBusy(false);
    }
  }

  const seats = full.seats === 1 ? "1 seat" : `${full.seats} seats`;

  const payBlock = (note: string) =>
    prices.isLoading ? (
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading the price" />
    ) : !prices.data || !seat ? (
      <p className="text-sm text-muted-foreground">The seat price didn't load. Try again in a moment.</p>
    ) : !canPayHere ? null : (
      <div className="space-y-3 text-left">
        {prices.data.provider === "mpesa" && !prices.data.dev_checkout && (
          <div className="relative">
            <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-label="M-Pesa number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="auth-input focus-ring pl-10"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy}
          className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-full py-3 font-semibold disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Pay for my seat · {formatSquadMoney(seat.amount, seat.currency)}
        </button>
        <p className="text-center text-xs text-muted-foreground">{note}</p>
      </div>
    );

  const askBlock = (() => {
    if (ask.status === "waiting") {
      return (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-cream">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Waiting for {host}…
          </p>
          <p className="text-xs text-muted-foreground">They'll see your ask on their screen.</p>
          <button type="button" onClick={() => void withdraw()} className="text-xs text-primary hover:underline">
            Cancel
          </button>
        </div>
      );
    }
    const line =
      ask.status === "declined"
        ? `Not tonight from ${host}.`
        : ask.status === "expired"
          ? `No answer from ${host} yet.`
          : ask.status === "recent"
            ? "You asked a moment ago."
            : null;
    return (
      <div className="space-y-2">
        {line && <p className="text-sm text-cream">{line}</p>}
        {ask.status !== "declined" && ask.status !== "recent" && (
          <button
            type="button"
            onClick={() => void askHost()}
            disabled={ask.status === "asking"}
            className={cn(
              "focus-ring flex w-full items-center justify-center gap-2 rounded-full py-3 font-semibold disabled:opacity-40",
              canPayHere ? "border border-white/[0.16] text-cream hover:bg-white/[0.05]" : "btn-primary",
            )}
          >
            {ask.status === "asking" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {ask.status === "expired" ? `Ask ${host} again` : `Ask ${host} to lend you a seat`}
          </button>
        )}
      </div>
    );
  })();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/[0.1] bg-card/60 p-5 text-center">
        <div className="space-y-1">
          <p className="text-[17px] font-semibold text-cream">Tonight's {seats} are taken</p>
          <p className="text-sm text-muted-foreground">
            {mode === "maxed"
              ? "This night can't take anyone else. When someone leaves the call, you can take their seat."
              : mode === "ask"
                ? `Pay for your own seat, or ask ${host} to lend you one of the squad's. Nobody has to drop off.`
                : "Add a seat for tonight and you're on the call. Nobody has to drop off."}
          </p>
        </div>

        {mode === "loading" && (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Checking the room's nights" />
        )}

        {mode === "use_balance" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void addFromBalance()}
              disabled={busy}
              className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-full py-3 font-semibold disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Add a seat and join
            </button>
            <p className="text-xs text-muted-foreground">Uses one seat from the room's nights, which belong to the whole squad.</p>
          </div>
        )}

        {mode === "pay" &&
          (canPayHere || prices.isLoading || !prices.data || !seat ? (
            payBlock("The room has no nights left, so this seat is just for you, tonight.")
          ) : (
            <p className="text-sm text-muted-foreground">Ask someone already in the squad to add a seat for you.</p>
          ))}

        {mode === "ask" && (
          <>
            {payBlock("Just for you, tonight. The squad's nights aren't touched.")}
            {askBlock}
          </>
        )}

        <button type="button" onClick={onSeated} disabled={busy} className="text-xs text-primary hover:underline disabled:opacity-40">
          Someone left? Try again
        </button>
      </div>
    </div>
  );
}
