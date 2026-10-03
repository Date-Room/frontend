/**
 * Buy nights for a squad room. Anyone in the squad can: the nights go to
 * the room, not to whoever pays. Prices come from the server for this
 * room's seats in the payer's currency; Kenya pays by M-Pesa, everyone
 * else by card (Stripe redirect).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { isMpesaStillConfirming, runMpesaPayment } from "@/lib/mpesaFlow";
import {
  formatSquadMoney,
  getSquadPrices,
  squadCardCheckout,
  squadDevPurchase,
  squadStkPush,
  type SquadPrice,
} from "@/lib/squad";
import { cn } from "@/lib/utils";

/** Pure: the two night products, with a "save" note on the pack. */
export function nightOptions(products: SquadPrice[]): { price: SquadPrice; title: string; sub: string; save: string | null }[] {
  const night = products.find((p) => p.product === "squad_night");
  const pack = products.find((p) => p.product === "squad_pack");
  const out = [];
  if (night) {
    out.push({
      price: night,
      title: "Squad Night",
      sub: `One night · ${formatSquadMoney(night.per_seat, night.currency)} each`,
      save: null,
    });
  }
  if (pack) {
    const saving = night ? night.amount * pack.nights - pack.amount : 0;
    out.push({
      price: pack,
      title: "Squad Pack",
      sub: `${pack.nights} nights, use them whenever · ${formatSquadMoney(pack.per_seat, pack.currency)} each a night`,
      save: saving > 0 ? `Save ${formatSquadMoney(saving, pack.currency)}` : null,
    });
  }
  return out;
}

export function SquadBuy({ roomId, onPaid }: { roomId: string; onPaid: () => void }) {
  const prices = useQuery({ queryKey: ["squad-prices", roomId], queryFn: () => getSquadPrices(roomId) });
  const [choice, setChoice] = useState<string>("squad_pack");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  if (prices.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading prices" />;
  }
  if (!prices.data) {
    return <p className="text-sm text-muted-foreground">Prices didn't load. Refresh to try again.</p>;
  }
  const p = prices.data;
  const options = nightOptions(p.products);
  const chosen = options.find((o) => o.price.product === choice) ?? options[0];

  async function pay() {
    if (!chosen) return;
    setBusy(true);
    try {
      if (p.dev_checkout) {
        await squadDevPurchase(roomId, chosen.price.product);
      } else if (p.provider === "mpesa") {
        if (!phone.trim()) throw new Error("Enter your M-Pesa number.");
        const product = chosen.price.product;
        const number = phone.trim();
        await runMpesaPayment({
          label: chosen.title,
          start: () => squadStkPush(roomId, product, number),
        });
      } else if (p.provider === "stripe") {
        const { url } = await squadCardCheckout(roomId, chosen.price.product);
        window.location.assign(url);
        return;
      }
      toast.success("Nights added to the room.");
      onPaid();
    } catch (e) {
      if (isMpesaStillConfirming(e)) toast.message(e.message);
      else toast.error(e instanceof Error ? e.message : "Payment didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  if (p.provider === "store" && !p.dev_checkout) {
    return (
      <p className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Paying on the web isn't open in your country yet. Anyone else in your squad can top up the
        room, and the nights are shared.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="What to buy" className="space-y-2.5">
        {options.map((o) => {
          const on = o.price.product === chosen?.price.product;
          return (
            <button
              key={o.price.product}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(o.price.product)}
              className={cn(
                "focus-ring relative flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors",
                on ? "border-primary/60 bg-primary/15" : "border-white/[0.08] bg-card/30 hover:border-primary/25",
              )}
            >
              {o.save && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                  {o.save}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-cream">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.sub}</span>
              </span>
              <span className="text-[15px] font-bold tabular-nums text-cream">
                {formatSquadMoney(o.price.amount, o.price.currency)}
              </span>
            </button>
          );
        })}
      </div>

      {p.provider === "mpesa" && !p.dev_checkout && (
        <div className="space-y-1.5">
          <label htmlFor="squad-mpesa" className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            M-Pesa number
          </label>
          <div className="relative">
            <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="squad-mpesa"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="auth-input focus-ring pl-10"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy || !chosen}
        className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {p.dev_checkout
          ? "Add nights (dev)"
          : p.provider === "mpesa"
            ? "Pay with M-Pesa"
            : "Pay by card"}
      </button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Nights never expire. They belong to the room, so anyone in the squad can use them.
      </p>
    </div>
  );
}
