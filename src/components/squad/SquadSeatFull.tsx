/**
 * Shown in place of the video when tonight's seats are all taken: the
 * person in the room but off the call can add a seat for tonight, from
 * the room's nights when it has some (anyone in the squad can), else by
 * paying for one seat themselves. Either way they join without anyone
 * dropping off. A night never seats more than five.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { isMpesaStillConfirming, runMpesaPayment } from "@/lib/mpesaFlow";
import {
  addSquadSeat,
  formatSquadMoney,
  getSquadNights,
  getSquadPrices,
  seatChoice,
  squadCardCheckout,
  squadDevPurchase,
  squadErrorText,
  squadStkPush,
  type NightFull,
} from "@/lib/squad";

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
  const nights = useQuery({ queryKey: ["squad-nights", roomId], queryFn: () => getSquadNights(roomId) });
  const choice = seatChoice(full, nights.data ? nights.data.seat_nights : nights.isError ? 0 : null);
  const prices = useQuery({
    queryKey: ["squad-prices", roomId, "seat"],
    queryFn: () => getSquadPrices(roomId),
    enabled: choice === "pay",
  });
  const seat = prices.data?.products.find((p) => p.product === "squad_seat");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/[0.1] bg-card/60 p-5 text-center">
        <div className="space-y-1">
          <p className="text-[17px] font-semibold text-cream">Tonight's {seats} are taken</p>
          <p className="text-sm text-muted-foreground">
            {choice === "maxed"
              ? "A squad night seats five at most. When someone leaves the call, you can take their seat."
              : "Add a seat for tonight and you're on the call. Nobody has to drop off."}
          </p>
        </div>

        {choice === "loading" && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Checking the room's nights" />}

        {choice === "use_balance" && (
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

        {choice === "pay" &&
          (prices.isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading the price" />
          ) : !prices.data || !seat ? (
            <p className="text-sm text-muted-foreground">The seat price didn't load. Try again in a moment.</p>
          ) : prices.data.provider === "store" && !prices.data.dev_checkout ? (
            <p className="text-sm text-muted-foreground">
              Ask someone already in the squad to add a seat for you.
            </p>
          ) : (
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
              <p className="text-center text-xs text-muted-foreground">
                The room has no nights left, so this seat is just for you, tonight.
              </p>
            </div>
          ))}

        <button type="button" onClick={onSeated} disabled={busy} className="text-xs text-primary hover:underline disabled:opacity-40">
          Someone left? Try again
        </button>
      </div>
    </div>
  );
}
