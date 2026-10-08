/**
 * For whoever runs the squad (owner, co-hosts, or everyone when the room
 * says so): someone left off a full call is asking to borrow one of the
 * squad's seats. Shows what lending costs ("leaves 3 nights + 1 spare seat")
 * with Lend a seat / Not tonight. When the squad has no seats to lend, the
 * host can pay for that one seat instead (where paying works on the web).
 * Arrives live (seat_requested) and by polling.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Armchair, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useRoomSession } from "@/context/RoomSessionContext";
import { isMpesaStillConfirming, runMpesaPayment } from "@/lib/mpesaFlow";
import {
  SEAT_DECIDED,
  SEAT_PAID,
  SEAT_REQUESTED,
  canRunSquad,
  declineSeat,
  formatSquadMoney,
  getSeatRequests,
  getSquadMembers,
  getSquadPrices,
  lendSeat,
  seatEffectLine,
  squadCardCheckout,
  squadDevPurchase,
  squadErrorCode,
  squadErrorText,
  squadStkPush,
} from "@/lib/squad";

export function SeatRequestsBanner({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const { channel } = useRoomSession();
  const members = useQuery({ queryKey: ["squad-members", roomId], queryFn: () => getSquadMembers(roomId) });
  const manager = canRunSquad(members.data);
  const asks = useQuery({
    queryKey: ["seat-requests", roomId],
    queryFn: () => getSeatRequests(roomId),
    enabled: manager,
    refetchInterval: 15_000,
  });
  const req = asks.data?.requests[0] ?? null;
  const effect = asks.data?.effect ?? null;
  const prices = useQuery({
    queryKey: ["squad-prices", roomId, "seat"],
    queryFn: () => getSquadPrices(roomId),
    enabled: Boolean(req && effect && !effect.can_lend),
  });
  const seat = prices.data?.products.find((p) => p.product === "squad_seat");
  const canPay = Boolean(prices.data && seat && (prices.data.provider !== "store" || prices.data.dev_checkout));
  const [busy, setBusy] = useState<"lend" | "decline" | "pay" | null>(null);
  const [phone, setPhone] = useState("");
  const [cardOpened, setCardOpened] = useState(false);

  // Someone asked, or a co-host answered: fetch now rather than on the poll.
  useEffect(() => {
    if (!manager) return;
    return channel.onBroadcast((e) => {
      if (e.kind === SEAT_REQUESTED || e.kind === SEAT_DECIDED || e.kind === SEAT_PAID) {
        void qc.invalidateQueries({ queryKey: ["seat-requests", roomId] });
      }
    });
  }, [manager, channel, qc, roomId]);

  if (!manager || !req || !effect) return null;
  const first = req.name.split(" ")[0];
  const others = (asks.data?.requests.length ?? 1) - 1;

  const done = () => {
    void qc.invalidateQueries({ queryKey: ["seat-requests", roomId] });
    void qc.invalidateQueries({ queryKey: ["squad-nights", roomId] });
    setCardOpened(false);
  };

  async function answer(lend: boolean) {
    if (!req) return;
    setBusy(lend ? "lend" : "decline");
    try {
      await (lend ? lendSeat(roomId, req.id) : declineSeat(roomId, req.id));
      toast.success(lend ? `Lent ${first} a seat.` : `Told ${first} not tonight.`);
    } catch (e) {
      const code = squadErrorCode(e);
      toast.error(
        code === "request_closed"
          ? "That ask has already closed."
          : squadErrorText(e, "That didn't go through. Try again."),
      );
    } finally {
      setBusy(null);
      done();
    }
  }

  /** Pay for their one seat (it goes straight onto tonight), then tell them. */
  async function payForThem() {
    const p = prices.data;
    if (!p || !req) return;
    setBusy("pay");
    try {
      if (p.dev_checkout) {
        await squadDevPurchase(roomId, "squad_seat");
      } else if (p.provider === "mpesa") {
        if (!phone.trim()) throw new Error("Enter your M-Pesa number.");
        const number = phone.trim();
        await runMpesaPayment({ label: "seat", start: () => squadStkPush(roomId, "squad_seat", number) });
      } else if (p.provider === "stripe") {
        // Card checkout leaves the page: open it beside the call instead.
        const { url } = await squadCardCheckout(roomId, "squad_seat");
        window.open(url, "_blank", "noopener");
        setCardOpened(true);
        return;
      }
      void channel.broadcast(SEAT_PAID, { id: req.id });
      toast.success(`Paid for ${first}'s seat.`);
      done();
    } catch (e) {
      if (isMpesaStillConfirming(e)) toast.message(e.message);
      else toast.error(squadErrorText(e, e instanceof Error ? e.message : "Payment didn't go through."));
    } finally {
      setBusy(null);
    }
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <div
        role="alertdialog"
        aria-label={`${first} wants to join tonight`}
        className="pointer-events-auto w-full max-w-sm space-y-3 rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Armchair className="h-4 w-4 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-cream">
              {first} wants to join tonight
              {others > 0 && <span className="font-normal text-muted-foreground"> · {others} more waiting</span>}
            </p>
            <p className="text-xs text-muted-foreground">Every seat is taken. {seatEffectLine(effect)}</p>
          </div>
        </div>

        {effect.can_lend ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void answer(true)}
              disabled={busy !== null}
              className="btn-primary focus-ring flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {busy === "lend" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Lend a seat
            </button>
            <button
              type="button"
              onClick={() => void answer(false)}
              disabled={busy !== null}
              className="focus-ring flex-1 rounded-full border border-white/[0.16] py-2.5 text-sm text-cream hover:bg-white/[0.05] disabled:opacity-40"
            >
              Not tonight
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {canPay && seat && prices.data?.provider === "mpesa" && !prices.data.dev_checkout && (
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
            <div className="flex gap-2">
              {canPay && seat && !cardOpened && (
                <button
                  type="button"
                  onClick={() => void payForThem()}
                  disabled={busy !== null}
                  className="btn-primary focus-ring flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  {busy === "pay" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Pay for {first}'s seat · {formatSquadMoney(seat.amount, seat.currency)}
                </button>
              )}
              {cardOpened && (
                <button
                  type="button"
                  onClick={() => {
                    void channel.broadcast(SEAT_PAID, { id: req.id });
                    done();
                  }}
                  className="btn-primary focus-ring flex-1 rounded-full py-2.5 text-sm font-semibold"
                >
                  I've paid, let {first} in
                </button>
              )}
              <button
                type="button"
                onClick={() => void answer(false)}
                disabled={busy !== null}
                className="focus-ring flex-1 rounded-full border border-white/[0.16] py-2.5 text-sm text-cream hover:bg-white/[0.05] disabled:opacity-40"
              >
                Not tonight
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
