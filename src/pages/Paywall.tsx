import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Sparkles, Heart } from "lucide-react";
import { toast } from "sonner";
import { CardPage } from "@/components/CardPage";
import { createCheckoutSession, getSubscriptionStatus } from "@/lib/billing";

/**
 * Paywall — premium subscription pitch + Stripe Checkout handoff.
 *
 * Three states based on the GET /v1/billing/subscription response:
 *  - paywall_enabled=false → "everything's free right now" view, no
 *    checkout button.
 *  - paywall_enabled=true + entitled=true → "you're already in" view
 *    with manage-link affordance (future Stripe Customer Portal).
 *  - paywall_enabled=true + entitled=false → the pitch + CTA.
 *
 * On successful return from Stripe we re-query the subscription
 * endpoint until the webhook lands (Stripe's redirect can beat our
 * webhook by a second or two).
 */
export default function Paywall() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const isSuccess = params.get("status") === "success";
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const {
    data: status,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getSubscriptionStatus,
    staleTime: 10_000,
  });

  // Post-success polling: hammer /subscription every 2s up to 5×
  // until `entitled` flips true, so the user sees confirmation
  // without a manual refresh.
  useEffect(() => {
    if (!isSuccess) return;
    if (status?.entitled) return;
    const t = window.setTimeout(() => void refetch(), 2000);
    return () => window.clearTimeout(t);
  }, [isSuccess, status?.entitled, refetch]);

  async function startCheckout() {
    setCheckoutBusy(true);
    try {
      const { url } = await createCheckoutSession();
      // Stash the marker for the post-success re-poll path.
      queryClient.invalidateQueries({ queryKey: ["subscription-status"] });
      window.location.assign(url);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Couldn't open Stripe — try again in a moment.",
      );
      setCheckoutBusy(false);
    }
  }

  if (isLoading) {
    return (
      <CardPage maxWidth="sm:max-w-md">
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
        </div>
      </CardPage>
    );
  }

  const open = status && !status.paywall_enabled;
  const entitled = status?.entitled === true;

  return (
    <CardPage
      title={isSuccess ? "Welcome in" : "DateRoom Premium"}
      onBack={() => navigate(-1)}
      maxWidth="sm:max-w-lg lg:max-w-xl"
      bodyClassName="animate-float-up space-y-7"
    >
      <header className="text-center space-y-3">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
          {entitled ? (
            <Check className="h-7 w-7 text-emerald-300" aria-hidden />
          ) : (
            <Sparkles className="h-7 w-7 text-amber" aria-hidden />
          )}
        </div>
        <h2 className="font-serif italic text-cream text-2xl sm:text-3xl">
          {open
            ? "Everything's open right now"
            : entitled
              ? "You're all set"
              : "Keep the room going forever"}
        </h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {open
            ? "We haven't turned on the paywall yet — every feature is free during the early access window."
            : entitled
              ? "Your subscription unlocks persistent rooms, recap timelines, and every activity that ships."
              : "Persistent Our Rooms, ongoing recaps, and full access to every activity we ship — for the two of you."}
        </p>
      </header>

      {!open && !entitled && (
        <section className="editorial-card grain p-5 space-y-3">
          {[
            { Icon: Heart, label: "Persistent Our Room", desc: "Same code, every night." },
            { Icon: Sparkles, label: "Recap timeline", desc: "Replay how the date played out." },
            { Icon: Check, label: "All activities, every release", desc: "New games unlock automatically." },
          ].map(({ Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <Icon className="h-4 w-4 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-cream">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {entitled && status?.subscription && (
        <section className="editorial-card grain p-5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="pill-live">{status.subscription.status}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Renews</span>
            <span className="tabular-nums text-cream">
              {new Date(status.subscription.current_period_end).toLocaleDateString()}
            </span>
          </div>
        </section>
      )}

      <div className="space-y-3">
        {!open && !entitled && (
          <button
            type="button"
            onClick={startCheckout}
            disabled={checkoutBusy}
            className="btn-primary focus-ring w-full py-4 rounded-[1.15rem] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {checkoutBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Opening Stripe…
              </>
            ) : (
              "Subscribe"
            )}
          </button>
        )}
        {(open || entitled) && (
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="btn-primary focus-ring w-full py-4 rounded-[1.15rem] font-semibold"
          >
            Back to your rooms
          </button>
        )}
      </div>

      <p className="text-center text-[10px] text-muted-foreground/60">
        Cancel anytime. We never charge without your explicit go-ahead.
      </p>
    </CardPage>
  );
}
