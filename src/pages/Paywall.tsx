import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Sparkles, Heart } from "lucide-react";
import { CardPage } from "@/components/CardPage";
import { PaymentCheckout } from "@/components/PaymentCheckout";
import {
  getBillingConfig,
  getSubscriptionStatus,
  paymentRailLabel,
} from "@/lib/billing";

/**
 * Paywall — premium subscription pitch with location-aware checkout.
 */
export default function Paywall() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const isSuccess = params.get("status") === "success";

  const {
    data: status,
    isLoading: statusLoading,
    refetch,
  } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getSubscriptionStatus,
    staleTime: 10_000,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["billing-config"],
    queryFn: getBillingConfig,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isSuccess) return;
    if (status?.entitled) return;
    const t = window.setTimeout(() => void refetch(), 2000);
    return () => window.clearTimeout(t);
  }, [isSuccess, status?.entitled, refetch]);

  async function refreshBilling() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["subscription-status"] }),
      queryClient.invalidateQueries({ queryKey: ["billing-config"] }),
      queryClient.invalidateQueries({ queryKey: ["entitlement"] }),
    ]);
  }

  if (statusLoading || configLoading || !status || !config) {
    return (
      <CardPage maxWidth="sm:max-w-md">
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
        </div>
      </CardPage>
    );
  }

  const open = !status.paywall_enabled;
  const entitled = status.entitled === true;

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
        <h2 className="font-serif font-semibold text-cream text-2xl sm:text-3xl">
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
        {!open && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
            Account tier · {status.account_tier_label}
            {!entitled && config.payment_provider
              ? ` · Pay with ${paymentRailLabel(config.payment_provider)}`
              : ""}
          </p>
        )}
      </header>

      {!open && !entitled && (
        <section className="editorial-card p-5 space-y-3">
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

      {entitled && status.subscription && (
        <section className="editorial-card p-5 space-y-2 text-sm">
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
          <PaymentCheckout
            config={config}
            product="together"
            label="Subscribe with Together"
            onComplete={refreshBilling}
          />
        )}
        {(open || entitled) && (
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="btn-primary focus-ring w-full py-4 rounded-[1.15rem] font-semibold"
          >
            Back to our rooms
          </button>
        )}
      </div>

      <p className="text-center text-[10px] text-muted-foreground/60">
        Cancel anytime. We never charge without your explicit go-ahead.
      </p>
    </CardPage>
  );
}
