import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  defaultTimeExtensionConfig,
  formatTimeExtensionPrice,
  getTimeExtensionConfig,
  isTimeStoreCheckout,
  purchaseTimeExtension,
  resolveTimeExtensionConfig,
  timeCheckoutBlockedMessage,
  type TimeExtensionProduct,
  type TimeExtensionProductId,
} from "@/lib/timeExtensions";
import { paymentRailLabel } from "@/lib/billing";
import { StoreDownloadCta } from "@/components/StoreDownloadCta";
import { cn } from "@/lib/utils";

type AddMoreTimeCheckoutProps = {
  roomId: string;
  participantId?: string;
  canPay: boolean;
  onTimeAdded: (expiresAt: string) => void;
};

export function AddMoreTimeCheckout({
  roomId,
  participantId,
  canPay,
  onTimeAdded,
}: AddMoreTimeCheckoutProps) {
  const [phone, setPhone] = useState("");
  const [busyProduct, setBusyProduct] = useState<TimeExtensionProductId | null>(
    null,
  );

  const {
    data: serverConfig,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["time-extensions", roomId, participantId],
    queryFn: () => getTimeExtensionConfig(roomId, participantId),
    initialData: defaultTimeExtensionConfig(),
    staleTime: 10_000,
    retry: 1,
  });

  const config = resolveTimeExtensionConfig(serverConfig);
  const blocked = timeCheckoutBlockedMessage(config);
  const isStore = isTimeStoreCheckout(config);
  const isMpesa = config.payment_provider === "mpesa";
  const loadError =
    isError && error instanceof Error ? error.message : isError ? "Could not load checkout." : null;

  async function handleBuy(product: TimeExtensionProduct) {
    if (!config || blocked || !canPay) return;
    setBusyProduct(product.id);
    try {
      const outcome = await purchaseTimeExtension(
        roomId,
        product.id,
        config,
        phone,
      );
      if (outcome.result === "completed") {
        toast.success(`${product.label} added — enjoy your extra time.`);
        const nextExpiry =
          outcome.expires_at ??
          (await getTimeExtensionConfig(roomId, participantId)).expires_at;
        if (nextExpiry) {
          onTimeAdded(nextExpiry);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment could not start.");
    } finally {
      setBusyProduct(null);
    }
  }

  if (!canPay) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
        Sign in to add more time to this session.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-xs leading-relaxed text-amber/90">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 font-semibold text-amber underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {config.dev_checkout_enabled && (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-100/90">
          Dev checkout — purchases apply instantly without Stripe or M-Pesa.
        </p>
      )}

      {blocked && !isStore && (
        <p className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-xs leading-relaxed text-amber/90">
          {blocked}
        </p>
      )}

      <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-black/20">
        {config.products.map((product) => {
          const busy = busyProduct === product.id;
          const price = formatTimeExtensionPrice(product);
          return (
            <li
              key={product.id}
              className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Clock className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-cream">{product.label}</p>
                <p className="text-xs text-muted-foreground">{price}</p>
              </div>
              {isStore ? (
                <span className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  In app
                </span>
              ) : (
                <button
                  type="button"
                  disabled={
                    Boolean(blocked) ||
                    busy ||
                    busyProduct !== null ||
                    (isMpesa && !phone.trim())
                  }
                  onClick={() => void handleBuy(product)}
                  className={cn(
                    "shrink-0 rounded-full border border-primary/35 bg-primary/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary transition hover:bg-primary/25 disabled:opacity-50",
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <>Add · {price}</>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {isStore && (
        <StoreDownloadCta note="Add more time in the DateRoom app." />
      )}

      {!isStore && isMpesa && !blocked && (
        <div className="space-y-2">
          <label
            htmlFor="time-mpesa-phone"
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
              id="time-mpesa-phone"
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
            Tap Add on a duration — you&apos;ll get an STK prompt on this phone via{" "}
            {paymentRailLabel(config.payment_provider)}.
          </p>
        </div>
      )}

      {!isStore && !isMpesa && !blocked && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Tap Add — you&apos;ll complete payment with{" "}
          {paymentRailLabel(config.payment_provider)} and return here with extra time.
        </p>
      )}

      {isFetching && !loadError && (
        <p className="text-center text-[11px] text-muted-foreground/70">
          Updating checkout…
        </p>
      )}
    </div>
  );
}
