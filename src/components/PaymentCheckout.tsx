import { useMemo, useState } from "react";
import { Loader2, MapPin, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  checkoutBlockedMessage,
  formatProductPrice,
  getBillingConfig,
  paymentRailLabel,
  purchaseProduct,
  type BillingConfig,
  type BillableProduct,
  type CheckoutReturnPaths,
} from "@/lib/billing";
import { COUNTRIES, flagFor } from "@/lib/countries";
import { tierPriceForProduct } from "@/lib/tierPricing";
import { updateMe } from "@/lib/users";
import { cn } from "@/lib/utils";

type PaymentCheckoutProps = {
  config: BillingConfig;
  product: BillableProduct;
  label: string;
  busy?: boolean;
  className?: string;
  returnPaths?: CheckoutReturnPaths;
  onComplete?: () => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  onConfigRefresh?: () => void | Promise<void>;
};

/**
 * Location-aware checkout — Stripe redirect for global users,
 * M-Pesa STK Push + phone field for KE/TZ/UG.
 */
export function PaymentCheckout({
  config,
  product,
  label,
  busy: busyProp,
  className,
  returnPaths,
  onComplete,
  onBusyChange,
  onConfigRefresh,
}: PaymentCheckoutProps) {
  const [phone, setPhone] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [savingCountry, setSavingCountry] = useState(false);
  const [internalBusy, setInternalBusy] = useState(false);
  const busy = busyProp ?? internalBusy;

  const productMeta = config.products.find((p) => p.id === product);
  const priceHint =
    tierPriceForProduct(product, config.products) ||
    (productMeta ? formatProductPrice(productMeta) : null);
  const isMpesa = config.payment_provider === "mpesa";
  const needsCountry = !config.country_code;
  const blocked = checkoutBlockedMessage(config);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 8);
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    ).slice(0, 12);
  }, [countryQuery]);

  async function handleCountryPick(code: string) {
    setSavingCountry(true);
    try {
      await updateMe({ country: code });
      await onConfigRefresh?.();
      // The server decides the payment rail (it routes on the account's
      // billing region, not the profile country we just saved) — ask it
      // rather than re-deriving with a hand-kept country list.
      const fresh = await getBillingConfig();
      toast.success(`Location set — pay with ${paymentRailLabel(fresh.payment_provider)}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save country.");
    } finally {
      setSavingCountry(false);
    }
  }

  async function handlePay() {
    if (blocked || needsCountry) return;
    const setBusy = (v: boolean) => {
      setInternalBusy(v);
      onBusyChange?.(v);
    };
    setBusy(true);
    try {
      const result = await purchaseProduct(product, config, phone, returnPaths);
      if (result === "completed") {
        toast.success("Payment received — you're all set.");
        await onComplete?.();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment could not start.");
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {blocked && (
        <p className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-xs leading-relaxed text-amber/90">
          {blocked}
        </p>
      )}

      {needsCountry && !blocked && (
        <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/20 p-3">
          <label
            htmlFor="checkout-country"
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Your location
          </label>
          <input
            id="checkout-country"
            type="search"
            value={countryQuery}
            onChange={(e) => setCountryQuery(e.target.value)}
            placeholder="Search country…"
            className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-3 px-4 text-sm text-cream placeholder:text-muted-foreground/45 focus:border-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/35"
          />
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {filteredCountries.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  disabled={savingCountry}
                  onClick={() => void handleCountryPick(c.code)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-cream transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  <span aria-hidden>{flagFor(c.code)}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            We use this to show M-Pesa in Kenya, Tanzania, and Uganda — Stripe everywhere else.
          </p>
        </div>
      )}

      {!needsCountry && isMpesa && !blocked && (
        <div className="space-y-2">
          <label
            htmlFor="mpesa-phone"
            className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
          >
            M-Pesa number
          </label>
          <div className="relative">
            <Smartphone
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="mpesa-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-3.5 pl-10 pr-4 text-sm text-cream placeholder:text-muted-foreground/45 focus:border-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/35"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            You&apos;ll get an STK prompt on this phone. Pay with{" "}
            {paymentRailLabel(config.payment_provider)}
            {priceHint ? ` · ${priceHint}` : ""}.
          </p>
        </div>
      )}

      {!needsCountry && !isMpesa && !blocked && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          You&apos;ll complete checkout on Stripe
          {priceHint ? ` · ${priceHint}` : ""}.
        </p>
      )}

      <button
        type="button"
        onClick={() => void handlePay()}
        disabled={
          busy ||
          Boolean(blocked) ||
          needsCountry ||
          (isMpesa && !needsCountry && !phone.trim())
        }
        className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-4 font-semibold disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {isMpesa ? "Waiting for M-Pesa…" : `Opening ${paymentRailLabel(config.payment_provider)}…`}
          </>
        ) : needsCountry ? (
          "Pick your country first"
        ) : (
          <>
            {label}
            {!isMpesa && priceHint ? ` · ${priceHint}` : null}
          </>
        )}
      </button>
    </div>
  );
}
