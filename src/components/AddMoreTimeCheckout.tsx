import { isMpesaStillConfirming } from "@/lib/mpesaFlow";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, Smartphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  defaultTimeExtensionConfig,
  formatTimeExtensionPrice,
  getTimeExtensionConfig,
  isTimeStoreCheckout,
  purchaseTimeExtension,
  resolveTimeExtensionConfig,
  timeCheckoutBlockedMessage,
  announceRoomPlanChanged,
  buyPackForRoom,
  formatPackPrice,
  upgradePackRows,
  upgradeRoomWithOwnedPack,
  visibleTimeProducts,
  type TimeExtensionProduct,
  type TimeExtensionProductId,
  type TimeSheetMode,
  type UpgradePackId,
} from "@/lib/timeExtensions";
import { paymentRailLabel } from "@/lib/billing";
import { StoreDownloadCta } from "@/components/StoreDownloadCta";
import { cn } from "@/lib/utils";

type AddMoreTimeCheckoutProps = {
  roomId: string;
  participantId?: string;
  canPay: boolean;
  onTimeAdded: (expiresAt: string) => void;
  /** "upgrade" leads with the packs (Try rooms, any time); "time" with minutes. */
  mode?: TimeSheetMode;
};

export function AddMoreTimeCheckout({
  roomId,
  participantId,
  canPay,
  onTimeAdded,
  mode = "time",
}: AddMoreTimeCheckoutProps) {
  const [phone, setPhone] = useState("");
  const [busyProduct, setBusyProduct] = useState<TimeExtensionProductId | UpgradePackId | null>(
    null,
  );

  const {
    data: serverConfig,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["time-extensions", roomId, participantId],
    queryFn: () => getTimeExtensionConfig(roomId, participantId),
    // A placeholder, not initial data: initial data counts as fresh, so the
    // sheet showed the USD fallback (and no packs) without asking the server.
    placeholderData: defaultTimeExtensionConfig(),
    staleTime: 10_000,
    retry: 1,
  });

  const config = resolveTimeExtensionConfig(serverConfig);
  // Until the room's real options arrive, the fallback can't block or sell.
  const blocked = isPlaceholderData ? null : timeCheckoutBlockedMessage(config);
  const isStore = isTimeStoreCheckout(config);
  const isMpesa = config.payment_provider === "mpesa";
  const timeProducts = visibleTimeProducts(config, mode);
  const packs = config.is_try ? upgradePackRows(config) : [];

  async function finishUpgrade(message: string) {
    toast.success(message);
    announceRoomPlanChanged();
    const next = (await getTimeExtensionConfig(roomId, participantId)).expires_at;
    if (next) onTimeAdded(next);
  }

  async function handlePack(pack: ReturnType<typeof upgradePackRows>[number]) {
    if (!canPay || busyProduct) return;
    setBusyProduct(pack.id);
    try {
      if (pack.owned > 0) {
        await upgradeRoomWithOwnedPack(roomId, pack.id);
      } else {
        if (!phone.trim()) throw new Error("Enter your M-Pesa number first.");
        await buyPackForRoom(roomId, pack.id, phone);
      }
      const length = pack.minutes === 60 ? "full hour" : `${pack.minutes / 60} hours`;
      await finishUpgrade(`${pack.title}: every game is open and you have a ${length} from now.`);
    } catch (e) {
      if (isMpesaStillConfirming(e)) toast.message(e.message);
      else toast.error(e instanceof Error ? e.message : "Couldn't upgrade the date.");
    } finally {
      setBusyProduct(null);
    }
  }
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
        toast.success(
          config.is_try
            ? `${product.label} added, and the full room is unlocked: every game is open.`
            : `${product.label} added — enjoy your extra time.`,
        );
        announceRoomPlanChanged();
        const nextExpiry =
          outcome.expires_at ??
          (await getTimeExtensionConfig(roomId, participantId)).expires_at;
        if (nextExpiry) {
          onTimeAdded(nextExpiry);
        }
      }
    } catch (e) {
      if (isMpesaStillConfirming(e)) toast.message(e.message);
      else toast.error(e instanceof Error ? e.message : "Payment could not start.");
    } finally {
      setBusyProduct(null);
    }
  }

  const timeHeading =
    packs.length > 0 ? (
      <p className="pt-1 text-label font-semibold uppercase tracking-[0.18em] text-muted-foreground">Just this date</p>
    ) : null;

  const timeList = (
    <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-black/20">
            {timeProducts.map((product) => {
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
                    <p className="text-label text-muted-foreground">{price}</p>
                  </div>
                  {isStore ? (
                    <span className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-label font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      In app
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        isPlaceholderData ||
                        Boolean(blocked) ||
                        busy ||
                        busyProduct !== null ||
                        (isMpesa && !phone.trim())
                      }
                      onClick={() => void handleBuy(product)}
                      className={cn(
                        "shrink-0 rounded-full border border-primary/35 bg-primary/15 px-3 py-2 text-label font-bold uppercase tracking-[0.12em] text-primary transition hover:bg-primary/25 disabled:opacity-50",
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
  );

  const packSection =
    packs.length > 0 ? (
      <ul className="space-y-2.5">
        {packs.map((pack) => {
          const busy = busyProduct === pack.id;
          const price = formatPackPrice(pack);
          const usable = pack.owned > 0 || (isMpesa && !blocked);
          return (
            <li
              key={pack.id}
              className={cn(
                "relative rounded-2xl border px-4 py-3.5 sm:px-5",
                pack.bestValue ? "border-primary/45 bg-primary/[0.08]" : "border-white/[0.08] bg-black/20",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-cream">{pack.title}</p>
                    {pack.badge && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-label font-semibold text-emerald-300">
                        {pack.badge}
                      </span>
                    )}
                    {pack.bestValue && (
                      <span className="rounded-full border border-primary/40 px-2 py-0.5 text-label font-semibold text-primary">
                        Best value
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-label text-muted-foreground">
                    {pack.sub}
                    {pack.owned > 0 && ` · you have ${pack.owned} left`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPlaceholderData || !usable || busy || busyProduct !== null || (pack.owned === 0 && isMpesa && !phone.trim())}
                  onClick={() => void handlePack(pack)}
                  className="shrink-0 rounded-full border border-primary/35 bg-primary/15 px-3 py-2 text-label font-bold uppercase tracking-[0.12em] text-primary transition hover:bg-primary/25 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : pack.owned > 0 ? (
                    "Use one"
                  ) : (
                    <>Buy · {price}</>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    ) : null;

  if (!canPay) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-body text-muted-foreground">
        Sign in to add more time to this session.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-label leading-relaxed text-amber/90">
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
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-label leading-relaxed text-emerald-100/90">
          Dev checkout — purchases apply instantly without Stripe or M-Pesa.
        </p>
      )}

      {blocked && !isStore && (
        <p className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-label leading-relaxed text-amber/90">
          {blocked}
        </p>
      )}

      {mode === "upgrade" ? (
        <>
          {packSection}
          {timeHeading}
          {timeList}
        </>
      ) : (
        <>
          {timeList}
          {packs.length > 0 && <p className="pt-1 text-label font-semibold uppercase tracking-[0.18em] text-muted-foreground">Or make it a full date</p>}
          {packSection}
        </>
      )}

      {isStore && (
        <StoreDownloadCta note="Add more time in the DateRoom app." />
      )}

      {!isStore && isMpesa && !blocked && (
        <div className="space-y-2">
          <label
            htmlFor="time-mpesa-phone"
            className="block text-label uppercase tracking-[0.22em] text-muted-foreground"
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
              className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-3.5 pl-10 pr-4 text-body text-ondark placeholder:text-muted-foreground/45 focus:border-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/35"
            />
          </div>
          <p className="text-label leading-relaxed text-muted-foreground">
            {packs.length > 0 ? "Tap Buy or Add" : "Tap Add on a duration"}: you&apos;ll get an{" "}
            {paymentRailLabel(config.payment_provider)} prompt on this phone.
          </p>
        </div>
      )}

      {!isStore && !isMpesa && !blocked && (
        <p className="text-label leading-relaxed text-muted-foreground">
          Tap Add — you&apos;ll complete payment with{" "}
          {paymentRailLabel(config.payment_provider)} and return here with extra time.
        </p>
      )}

      {isFetching && !loadError && (
        <p className="text-center text-label text-muted-foreground/70">
          Updating checkout…
        </p>
      )}
    </div>
  );
}
