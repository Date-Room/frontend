import type { FocusEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  User,
  Pen,
  Sparkles,
  Loader2,
  Check,
  Lock,
} from "lucide-react";
import { LobbyGreetingPreview } from "@/components/LobbyGreetingPreview";
import { PageShell } from "@/components/PageShell";
import { AMBIANCE_PRESETS } from "@/lib/ambiance";
import type { AmbiancePresetId } from "@/lib/ambiance";
import { ambianceMeta } from "@/lib/ambiance";
import {
  getBillingConfig,
  getEntitlement,
  paymentRailLabel,
  type BillingConfig,
  type CheckoutReturnPaths,
  type Entitlement,
} from "@/lib/billing";
import { PaymentCheckout } from "@/components/PaymentCheckout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { connectionIntentLabel, type ConnectionIntent } from "@/lib/connectionIntent";
import { ApiError } from "@/lib/api";
import { saveInvitedGuestName } from "@/lib/invitedGuest";
import { createRoom, updateRoom, type RoomPackage, type RoomPersistence } from "@/lib/rooms";
import {
  CURATABLE_ACTIVITIES,
  availableActivityIdsForPackage,
  defaultCuratedForPackage,
  isTryPackage,
  activityMeta,
  type CuratableActivityId,
} from "@/lib/roomExperience";
import { saveRoomPlanFromServer } from "@/lib/roomExperience";
import { billingProductForTier, formatTierPrice, tierPricingMeta } from "@/lib/tierPricing";
import { cn } from "@/lib/utils";

type Plan = "try" | "date_pack" | "long_pack" | "together" | "crew";

type PlanMeta = {
  id: Plan;
  title: string;
  desc: string;
  icon: string;
  persistence: RoomPersistence;
  package: RoomPackage;
  priceHint: string;
};

const PLANS: PlanMeta[] = [
  {
    id: "try",
    title: "Try",
    desc: "One session, 20 minutes. Free.",
    icon: "🕯️",
    persistence: "session",
    package: "single_pass",
    priceHint: "Free",
  },
  {
    id: "date_pack",
    title: "Date Pack",
    desc: "Three sessions, 1 hour each.",
    icon: "💌",
    persistence: "session",
    package: "date_pack",
    priceHint: "Uses a Date Pack credit",
  },
  {
    id: "long_pack",
    title: "Long Pack",
    desc: "Five sessions, 2 hours each.",
    icon: "🌙",
    persistence: "session",
    package: "long_pack",
    priceHint: "Uses a Long Pack credit",
  },
  {
    id: "together",
    title: "Together",
    desc: "Persistent room — vision board, bookshelf, watch party for up to 12.",
    icon: "🏠",
    persistence: "persistent",
    package: "subscription",
    priceHint: "Together subscription",
  },
  {
    id: "crew",
    title: "Crew",
    desc: "Persistent room — vision board, bookshelf, group watch parties.",
    icon: "🎬",
    persistence: "persistent",
    package: "subscription",
    priceHint: "Crew subscription",
  },
];

type Step = "plan" | "recipient" | "when" | "experience" | "greeting" | "confirm";
const STEPS: Step[] = ["plan", "recipient", "when", "experience", "greeting", "confirm"];
const STEP_LABELS = ["Plan", "Guest", "When", "Experience", "Lobby mood", "Review"] as const;
const CREATE_CHECKOUT_STORAGE_KEY = "dateroom:create:checkout-plan";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function stripeReturnPaths(plan: Plan): CheckoutReturnPaths {
  return {
    successPath: `/create?checkout=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    cancelPath: `/create?checkout=cancel&plan=${plan}`,
  };
}

const WIDE_LAYOUT_STEPS = new Set<Step>(["plan", "recipient", "when", "experience", "confirm"]);

function shellMaxWidth(step: Step): string {
  if (step === "greeting") return "max-w-6xl";
  if (WIDE_LAYOUT_STEPS.has(step)) return "max-w-4xl lg:max-w-5xl";
  return "max-w-2xl";
}

function mainMaxWidth(step: Step): string {
  if (step === "greeting") return "max-w-6xl pb-36 lg:pb-28";
  if (WIDE_LAYOUT_STEPS.has(step)) return "max-w-4xl lg:max-w-5xl";
  return "max-w-xl";
}

function StepEyebrow({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="mb-6 space-y-3">
      <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-3">
          <span
            className="h-px w-8 bg-gradient-to-r from-transparent via-primary/55 to-primary rounded-full shrink-0"
            aria-hidden
          />
          Step {stepIndex + 1} of {STEPS.length}
        </span>
        <span className="text-muted-foreground/80 tracking-[0.12em] normal-case font-normal">
          {STEP_LABELS[stepIndex]}
        </span>
      </p>
      <div className="flex gap-2 pl-11 sm:pl-11">
        {STEPS.map((id, i) => (
          <span
            key={id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === stepIndex && "w-8 bg-primary shadow-[0_0_12px_rgba(212,130,106,0.45)]",
              i < stepIndex && "w-2 bg-primary/40",
              i > stepIndex && "w-1.5 bg-white/15",
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

export default function CreateRoom() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("try");
  const [curatedActivities, setCuratedActivities] = useState<CuratableActivityId[]>(
    () => defaultCuratedForPackage("single_pass"),
  );
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<"plan" | "confirm">("plan");
  const [recipientName, setRecipientName] = useState("");
  const [scheduledType, setScheduledType] = useState<"now" | "later">("now");
  const [scheduledDatePart, setScheduledDatePart] = useState("");
  const [scheduledTimePart, setScheduledTimePart] = useState("");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [lobbyAmbiance, setLobbyAmbiance] = useState<AmbiancePresetId>("candlelit");
  const [connectionIntent, setConnectionIntent] = useState<ConnectionIntent>("heartfelt");
  const [greetingFocus, setGreetingFocus] = useState<"headline" | "subtext" | null>(null);
  const [creating, setCreating] = useState(false);
  const greetingBlurClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledDateInputRef = useRef<HTMLInputElement>(null);
  const scheduledTimeInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const planMeta = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0];
  const currentTier = (entitlement?.account_tier ??
    billingConfig?.account_tier ??
    "try") as Plan;
  const currentTierLabel =
    entitlement?.account_tier_label ?? billingConfig?.account_tier_label ?? "Try";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [e, cfg] = await Promise.all([getEntitlement(), getBillingConfig()]);
        if (!cancelled) {
          setEntitlement(e);
          setBillingConfig(cfg);
        }
      } catch {
        /* badges optional */
      }
    })();
    const onFocus = async () => {
      try {
        const [e, cfg] = await Promise.all([getEntitlement(), getBillingConfig()]);
        if (!cancelled) {
          setEntitlement(e);
          setBillingConfig(cfg);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const scheduledDateTime = useMemo(() => {
    if (!scheduledDatePart || !scheduledTimePart) return null;
    const d = new Date(`${scheduledDatePart}T${scheduledTimePart}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [scheduledDatePart, scheduledTimePart]);

  const scheduleComplete = scheduledDatePart.trim() !== "" && scheduledTimePart.trim() !== "";

  const lobbyScheduledPreviewLabel = useMemo(() => {
    if (scheduledType !== "later" || !scheduledDateTime) return null;
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(scheduledDateTime);
  }, [scheduledType, scheduledDateTime]);

  function next() {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }
  function prev() {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]);
  }

  function handleBack() {
    if (stepIndex === 0) navigate("/home");
    else prev();
  }

  const availableActivityIds = useMemo(
    () => new Set(availableActivityIdsForPackage(planMeta.package)),
    [planMeta.package],
  );

  function toggleActivity(id: CuratableActivityId) {
    if (!availableActivityIds.has(id)) return;
    setCuratedActivities((cur) => {
      if (cur.includes(id)) {
        const next = cur.filter((x) => x !== id);
        return next.length ? next : cur; // keep at least one
      }
      return [...cur, id];
    });
  }

  function purchaseRequired(plan: Plan, e: Entitlement | null): boolean {
    if (plan === "try") return false;
    if (e === null) return true;
    switch (plan) {
      case "date_pack":
        return e.date_pack_remaining <= 0;
      case "long_pack":
        return e.long_pack_remaining <= 0;
      case "together":
        return !e.has_active_subscription;
      case "crew":
        return e.account_tier !== "crew";
    }
  }

  function isCurrentPlan(plan: Plan): boolean {
    return plan === currentTier;
  }

  function badgeFor(plan: Plan): string | null {
    if (entitlement === null || isCurrentPlan(plan)) return null;
    switch (plan) {
      case "date_pack":
        return entitlement.date_pack_remaining > 0
          ? `${entitlement.date_pack_remaining} left`
          : null;
      case "long_pack":
        return entitlement.long_pack_remaining > 0
          ? `${entitlement.long_pack_remaining} left`
          : null;
      case "try":
      case "together":
      case "crew":
        return null;
    }
  }

  function ctaLabel(): string {
    if (!purchaseRequired(selectedPlan, entitlement)) return "Create room & continue";
    switch (selectedPlan) {
      case "together":
        return "Subscribe & create";
      case "crew":
        return "Subscribe to Crew & create";
      case "date_pack":
        return "Buy Date Pack & create";
      case "long_pack":
        return "Buy Long Pack & create";
      case "try":
        return "Create room & continue";
    }
  }

  function priceSummary(): string {
    if (purchaseRequired(selectedPlan, entitlement)) {
      const rail = billingConfig
        ? paymentRailLabel(billingConfig.payment_provider)
        : "checkout";
      switch (selectedPlan) {
        case "together":
          return `${rail} for Together, then room creation`;
        case "crew":
          return `${rail} for Crew, then room creation`;
        case "date_pack":
          return `Buy Date Pack via ${rail}, then create`;
        case "long_pack":
          return `Buy Long Pack via ${rail}, then create`;
        case "try":
          return planMeta.priceHint;
      }
    }
    return planMeta.priceHint;
  }

  function productForPlan(plan: Plan): "date_pack" | "long_pack" | "together" | "crew" {
    if (plan === "long_pack") return "long_pack";
    if (plan === "together") return "together";
    if (plan === "crew") return "crew";
    return "date_pack";
  }

  function paymentLabelForPlan(plan: Plan): string {
    switch (plan) {
      case "date_pack":
        return "Pay for Date Pack";
      case "long_pack":
        return "Pay for Long Pack";
      case "together":
        return "Subscribe to Together";
      case "crew":
        return "Subscribe to Crew";
      default:
        return "Continue";
    }
  }

  function paymentDialogTitle(plan: Plan): string {
    const title = PLANS.find((p) => p.id === plan)?.title ?? "Upgrade";
    const rail = billingConfig ? paymentRailLabel(billingConfig.payment_provider) : "checkout";
    if (!billingConfig?.country_code) return `Upgrade to ${title}`;
    return `Pay for ${title} with ${rail}`;
  }

  function handlePlanSelect(plan: Plan) {
    const meta = PLANS.find((p) => p.id === plan) ?? PLANS[0];
    setSelectedPlan(plan);
    setCuratedActivities(defaultCuratedForPackage(meta.package));

    if (entitlement === null) {
      toast.message("Loading your account…");
      return;
    }

    if (purchaseRequired(plan, entitlement)) {
      if (!billingConfig) {
        toast.error("Loading billing — try again in a moment.");
        return;
      }
      sessionStorage.setItem(CREATE_CHECKOUT_STORAGE_KEY, plan);
      setPaymentIntent("plan");
      setPaymentOpen(true);
      return;
    }

    next();
  }

  const refreshBilling = useCallback(async () => {
    const [e, cfg] = await Promise.all([getEntitlement(), getBillingConfig()]);
    setEntitlement(e);
    setBillingConfig(cfg);
    await queryClient.invalidateQueries({ queryKey: ["entitlement"] });
    await queryClient.invalidateQueries({ queryKey: ["billing-config"] });
  }, [queryClient]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout) return;

    let cancelled = false;
    void (async () => {
      const planParam = searchParams.get("plan") as Plan | null;
      const storedPlan = sessionStorage.getItem(CREATE_CHECKOUT_STORAGE_KEY) as Plan | null;
      const plan = planParam ?? storedPlan;

      if (plan && PLANS.some((p) => p.id === plan)) {
        const meta = PLANS.find((p) => p.id === plan)!;
        setSelectedPlan(plan);
        setCuratedActivities(defaultCuratedForPackage(meta.package));
      }

      if (checkout === "success") {
        await refreshBilling();
        let e = await getEntitlement();
        for (let i = 0; i < 6 && plan && purchaseRequired(plan, e); i += 1) {
          await sleep(2000);
          if (cancelled) return;
          e = await getEntitlement();
          setEntitlement(e);
        }
        if (!cancelled) {
          setEntitlement(e);
          toast.success("Payment received — your plan is upgraded.");
          setStep("recipient");
        }
      } else if (checkout === "cancel") {
        toast.message("Checkout cancelled — pick a plan when you're ready.");
        setStep("plan");
      }

      sessionStorage.removeItem(CREATE_CHECKOUT_STORAGE_KEY);
      setSearchParams({}, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, refreshBilling]);

  async function createRoomAfterPlan() {
    const guestName = recipientName.trim();
    if (!guestName) {
      toast.error("Add their name.");
      setStep("recipient");
      throw new Error("missing guest");
    }

    let scheduledFor: string | null = null;
    if (scheduledType === "later") {
      if (!scheduledDateTime) {
        toast.error("Pick a date and time.");
        setStep("when");
        throw new Error("missing schedule");
      }
      scheduledFor = scheduledDateTime.toISOString();
    }

    const room = await createRoom({
      persistence: planMeta.persistence,
      package: planMeta.package,
      scheduled_for: scheduledFor,
      greeting_headline: headline.trim() || null,
      greeting_subtext: subtext.trim() || null,
      curated_activity_ids: curatedActivities,
    });

    saveRoomPlanFromServer(room.id, {
      package: room.package,
      curated_activity_ids: room.curated_activity_ids ?? curatedActivities,
    });

    await updateRoom(room.id, { background_id: lobbyAmbiance });

    saveInvitedGuestName(room.id, guestName);

    await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
    await queryClient.invalidateQueries({ queryKey: ["invite-card", room.code] });
    navigate(`/rooms/${room.id}/pre`, {
      state: { guestName, connectionIntent },
    });
  }

  async function handleCreate() {
    const guestName = recipientName.trim();
    if (!guestName) {
      toast.error("Add their name.");
      setStep("recipient");
      return;
    }

    if (purchaseRequired(selectedPlan, entitlement)) {
      if (!billingConfig) {
        toast.error("Loading billing — try again in a moment.");
        return;
      }
      sessionStorage.setItem(CREATE_CHECKOUT_STORAGE_KEY, selectedPlan);
      setPaymentIntent("confirm");
      setPaymentOpen(true);
      return;
    }

    setCreating(true);
    try {
      await createRoomAfterPlan();
    } catch (e) {
      if (e instanceof Error && e.message === "missing guest") return;
      if (e instanceof Error && e.message === "missing schedule") return;
      if (e instanceof ApiError && e.status === 402) {
        toast.message("This room needs an active credit.");
        navigate("/paywall");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not create room.");
    } finally {
      setCreating(false);
    }
  }

  async function handlePaymentComplete() {
    setPaymentOpen(false);
    try {
      await refreshBilling();
      if (paymentIntent === "confirm") {
        setCreating(true);
        await createRoomAfterPlan();
      } else {
        next();
      }
    } catch (e) {
      if (e instanceof Error && (e.message === "missing guest" || e.message === "missing schedule")) {
        return;
      }
      if (e instanceof ApiError && e.status === 402) {
        toast.message("This room needs an active credit.");
        navigate("/paywall");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not continue.");
    } finally {
      setCreating(false);
    }
  }

  const inputClass =
    "w-full rounded-xl px-4 py-3.5 bg-black/25 border border-white/[0.08] text-cream placeholder:text-muted-foreground/45 focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary/25 transition text-sm shadow-inner";

  const greetingInputClass =
    "w-full rounded-xl px-4 py-3.5 bg-secondary/90 border border-white/[0.22] text-cream placeholder:text-muted-foreground/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/45 transition text-sm";

  function openPickerInput(ref: RefObject<HTMLInputElement | null>) {
    const el = ref.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  const pickerInputClass = cn(
    inputClass,
    "text-base py-4 pr-14 [color-scheme:dark]",
    "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none",
  );

  function scheduleGreetingBlurClear(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nextTarget = e.relatedTarget as HTMLElement | null;
    if (nextTarget?.id === "greeting-headline" || nextTarget?.id === "greeting-subtext") return;
    if (greetingBlurClearRef.current) clearTimeout(greetingBlurClearRef.current);
    greetingBlurClearRef.current = setTimeout(() => {
      greetingBlurClearRef.current = null;
      const active = document.activeElement as HTMLElement | null;
      if (active?.id !== "greeting-headline" && active?.id !== "greeting-subtext") {
        setGreetingFocus(null);
      }
    }, 80);
  }

  return (
    <PageShell>
      <header className="sticky top-0 z-40 glass-subtle backdrop-blur-xl border-b border-white/[0.05]">
        <div
          className={cn(
            "mx-auto px-6 h-[3.75rem] flex items-center justify-between gap-3",
            shellMaxWidth(step),
          )}
        >
          <button
            type="button"
            onClick={handleBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-cream hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={stepIndex === 0 ? "Back to home" : "Previous step"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center min-w-0">
            <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground truncate max-w-[200px]">
              Create a room
            </span>
            <span className="text-xs font-medium text-cream/90 truncate">{STEP_LABELS[stepIndex]}</span>
          </div>
          <span className="tabular-nums text-[11px] uppercase tracking-[0.2em] text-muted-foreground w-10 text-right shrink-0">
            {stepIndex + 1}/{STEPS.length}
          </span>
        </div>
        <div className={cn("h-1 bg-black/30 mx-auto px-6", shellMaxWidth(step))}>
          <div className="h-full rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary/90 to-champagne transition-[width] duration-500 ease-out shadow-[0_0_16px_rgba(212,130,106,0.35)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto px-6 pt-10 pb-28 relative z-10 animate-fade-in",
          mainMaxWidth(step),
        )}
      >
        {step === "plan" && (
          <div>
            <StepEyebrow stepIndex={stepIndex} />
            <h1 className="font-serif italic text-3xl md:text-4xl text-cream mb-3 tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
              Pick a plan
            </h1>
            <p className="text-muted-foreground text-sm mb-4 md:mb-5 leading-relaxed max-w-2xl">
              Try a free session, spend a pack credit, or open a room that stays with you both.
            </p>
            {entitlement || billingConfig ? (
              <div className="mb-8 md:mb-10 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Your plan · {currentTierLabel}
              </div>
            ) : (
              <div className="mb-8 md:mb-10 h-7 w-36 animate-pulse rounded-full bg-white/[0.06]" aria-hidden />
            )}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {PLANS.map((opt) => {
                const badge = badgeFor(opt.id);
                const isCurrent = isCurrentPlan(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handlePlanSelect(opt.id)}
                    className={cn(
                      "h-full min-h-[10.5rem] w-full text-left rounded-[1.75rem] p-5 md:p-6 transition-all duration-300 border relative overflow-hidden group",
                      "bg-gradient-to-br from-card/90 via-card/45 to-transparent backdrop-blur-md",
                      "shadow-[0_14px_48px_rgba(0,0,0,0.28)]",
                      isCurrent
                        ? "border-primary/45 ring-1 ring-primary/25 shadow-[0_20px_56px_rgba(212,130,106,0.22)]"
                        : "border-white/[0.08] hover:border-primary/30 hover:shadow-[0_20px_56px_rgba(0,0,0,0.38)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                    )}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(ellipse_at_top_right,rgba(212,130,106,0.12),transparent_55%)]"
                      aria-hidden
                    />
                    <div className="relative flex h-full flex-col gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/25 text-2xl shadow-inner">
                          {opt.icon}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-cream font-semibold text-[15px] tracking-tight">{opt.title}</p>
                            <span className="text-sm font-semibold tabular-nums text-primary">
                              {formatTierPrice(
                                opt.id,
                                billingProductForTier(opt.id, billingConfig?.products),
                              )}
                            </span>
                            {isCurrent ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-200">
                                <Check className="h-3 w-3" aria-hidden />
                                Current plan
                              </span>
                            ) : null}
                            {badge ? (
                              <span className="rounded-full border border-rosegold/25 bg-rosegold/10 px-2 py-0.5 text-[10px] font-semibold text-rosegold">
                                {badge}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
                            {opt.desc}
                            {tierPricingMeta(opt.id).unit && opt.id !== "try"
                              ? ` · ${tierPricingMeta(opt.id).unit}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <p className="mt-auto text-[11px] uppercase tracking-[0.22em] text-primary font-semibold opacity-90 flex items-center gap-1">
                        {isCurrent ? "Use this plan" : "Continue"}{" "}
                        <ArrowRight className="w-3 h-3" aria-hidden />
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "recipient" && (
          <div>
            <StepEyebrow stepIndex={stepIndex} />
            <h1 className="font-serif italic text-3xl md:text-4xl text-cream mb-3 tracking-tight">
              Who&apos;s joining you?
            </h1>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed max-w-2xl">
              They&apos;ll receive your lobby link with your greeting and a gentle countdown when it&apos;s almost time.
            </p>
            <div className="rounded-[1.75rem] border border-white/[0.08] bg-card/35 backdrop-blur-md p-5 md:p-7 shadow-[0_14px_48px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.04]">
              <label className="block text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-4">
                <User className="w-3 h-3 inline mr-2 opacity-70 align-middle" aria-hidden />
                Their first name
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Alex"
                autoComplete="given-name"
                className={cn(inputClass, "mb-6 text-base py-4")}
              />
              <button
                type="button"
                onClick={next}
                disabled={!recipientName.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 rounded-[1.15rem] disabled:opacity-45 shadow-[0_12px_40px_rgba(212,130,106,0.25)] font-medium tracking-wide"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === "when" && (
          <div>
            <StepEyebrow stepIndex={stepIndex} />
            <h1 className="font-serif italic text-3xl md:text-4xl text-cream mb-3 tracking-tight">
              When should it start?
            </h1>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed max-w-2xl">
              Right away, or lock in a moment you&apos;re both free.
            </p>
            <div className="mb-6 grid gap-4 md:grid-cols-2 md:gap-5">
              {(
                [
                  {
                    id: "now" as const,
                    label: "Right now",
                    desc: "They can join as soon as they open the link.",
                    icon: <Sparkles className="w-5 h-5" />,
                  },
                  {
                    id: "later" as const,
                    label: "Schedule it",
                    desc: "Pick a date & time — they'll see an elegant countdown.",
                    icon: <Calendar className="w-5 h-5" />,
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScheduledType(opt.id)}
                  className={cn(
                    "min-h-[8.5rem] w-full text-left rounded-[1.75rem] p-5 md:p-6 transition-all duration-300 flex flex-col gap-4 border backdrop-blur-md",
                    scheduledType === opt.id
                      ? "border-primary/45 bg-gradient-to-br from-primary/18 via-primary/8 to-transparent shadow-[0_12px_40px_rgba(212,130,106,0.15)] ring-1 ring-primary/20"
                      : "border-white/[0.08] bg-card/30 hover:border-primary/22 hover:bg-white/[0.03]",
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ring-1 transition-colors",
                      scheduledType === opt.id
                        ? "bg-primary/25 text-primary ring-primary/35"
                        : "bg-primary/10 text-primary ring-primary/15",
                    )}
                  >
                    {opt.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-cream text-[15px] font-semibold tracking-tight">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {scheduledType === "later" && (
              <div className="mb-6 grid gap-4 rounded-[1.75rem] border border-white/[0.08] bg-card/35 p-5 backdrop-blur-md ring-1 ring-white/[0.04] shadow-inner md:grid-cols-2 md:gap-5 md:p-6">
                <div>
                  <label
                    htmlFor="create-room-scheduled-date"
                    className="mb-3 block text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
                  >
                    <Calendar className="mr-2 inline h-3 w-3 align-middle opacity-70" aria-hidden />
                    Date
                  </label>
                  <div className="relative">
                    <input
                      ref={scheduledDateInputRef}
                      id="create-room-scheduled-date"
                      type="date"
                      value={scheduledDatePart}
                      onChange={(e) => setScheduledDatePart(e.target.value)}
                      aria-label="Choose date for your date room"
                      className={pickerInputClass}
                    />
                    <button
                      type="button"
                      onClick={() => openPickerInput(scheduledDateInputRef)}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                      aria-label="Open date picker"
                    >
                      <Calendar className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="create-room-scheduled-time"
                    className="mb-3 block text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
                  >
                    <Clock className="mr-2 inline h-3 w-3 align-middle opacity-70" aria-hidden />
                    Time
                  </label>
                  <div className="relative">
                    <input
                      ref={scheduledTimeInputRef}
                      id="create-room-scheduled-time"
                      type="time"
                      value={scheduledTimePart}
                      onChange={(e) => setScheduledTimePart(e.target.value)}
                      aria-label="Choose time for your date room"
                      className={pickerInputClass}
                    />
                    <button
                      type="button"
                      onClick={() => openPickerInput(scheduledTimeInputRef)}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                      aria-label="Open time picker"
                    >
                      <Clock className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={next}
                disabled={scheduledType === "later" && !scheduleComplete}
                className="btn-primary w-full md:w-[calc((100%-1.25rem)/2)] flex items-center justify-center gap-2 py-4 rounded-[1.15rem] disabled:opacity-45 shadow-[0_12px_40px_rgba(212,130,106,0.25)] font-medium tracking-wide"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === "experience" && (
          <div>
            <StepEyebrow stepIndex={stepIndex} />
            <h1 className="font-serif italic text-3xl md:text-4xl text-cream mb-3 tracking-tight">
              Curate your date
            </h1>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed max-w-2xl">
              Choose what you can do together once you&apos;re in the room. You can always open
              fewer — these just set what&apos;s on the menu.
            </p>

            {isTryPackage(planMeta.package) && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/[0.07] px-4 py-3.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="text-xs leading-relaxed text-cream/85">
                  <span className="font-semibold text-cream">Try plan:</span> Watch party, Music and
                  21 Questions are included. Unlock the full library — games, deeper decks and more —
                  with a Date Pack, Long Pack, or Together.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {CURATABLE_ACTIVITIES.map((a) => {
                const available = availableActivityIds.has(a.id);
                const selected = available && curatedActivities.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleActivity(a.id)}
                    disabled={!available}
                    aria-pressed={selected}
                    className={cn(
                      "relative flex items-start gap-4 rounded-[1.5rem] border p-4 md:p-5 text-left transition-all duration-300",
                      !available
                        ? "cursor-not-allowed border-white/[0.06] bg-card/20 opacity-60"
                        : selected
                          ? "border-primary/50 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent ring-1 ring-primary/25 shadow-[0_10px_36px_rgba(212,130,106,0.14)]"
                          : "border-white/[0.08] bg-card/30 hover:border-primary/25 hover:bg-white/[0.03]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ring-1",
                        selected ? "bg-primary/15 ring-primary/30" : "bg-white/[0.04] ring-white/10",
                      )}
                      aria-hidden
                    >
                      {a.emoji}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-cream">
                        {a.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.tagline}</p>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
                        !available
                          ? "border-white/15 text-muted-foreground/70"
                          : selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-white/20 text-transparent",
                      )}
                      aria-hidden
                    >
                      {!available ? (
                        <Lock className="h-3 w-3" />
                      ) : selected ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {curatedActivities.length} selected
            </p>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={next}
                disabled={curatedActivities.length === 0}
                className="btn-primary w-full md:w-[calc((100%-1rem)/2)] flex items-center justify-center gap-2 py-4 rounded-[1.15rem] disabled:opacity-45 shadow-[0_12px_40px_rgba(212,130,106,0.25)] font-medium tracking-wide"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === "greeting" && (
          <div className="space-y-8">
            <StepEyebrow stepIndex={stepIndex} />
            <div className="flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-start lg:gap-x-10 xl:grid-cols-[1fr_400px] xl:gap-x-12">
              <div className="flex min-h-0 min-w-0 flex-col">
                <h1 className="mb-2 font-serif text-2xl italic tracking-tight text-cream md:text-3xl lg:text-[2rem]">
                  Set the mood{" "}
                  <span className="font-sans text-base font-normal not-italic text-muted-foreground md:text-lg">
                    (optional)
                  </span>
                </h1>
                <p className="mb-5 max-w-lg text-sm leading-relaxed text-muted-foreground md:mb-6">
                  <span className="font-medium text-cream/95">{recipientName.trim() || "Your guest"}</span> sees this
                  while they wait. On phones we show their lobby first — scroll down to write; on desktop your editor
                  stays beside the preview.
                </p>

                <div className="mb-6 space-y-3 md:mb-7">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Lobby atmosphere</p>
                  <p className="text-xs leading-relaxed text-muted-foreground/90">
                    Pick a vibe — the preview swaps art and lighting to match.
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {AMBIANCE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setLobbyAmbiance(p.id)}
                        aria-pressed={lobbyAmbiance === p.id}
                        className={cn(
                          "flex flex-col rounded-2xl border px-3 py-3 text-left transition-all min-h-[5.75rem]",
                          lobbyAmbiance === p.id
                            ? "border-primary/55 bg-primary/15 shadow-[0_0_24px_rgba(212,130,106,0.14)] ring-2 ring-primary/28"
                            : "border-white/[0.14] bg-card/35 hover:border-white/22 hover:bg-card/45",
                        )}
                      >
                        <span className="text-lg leading-none" aria-hidden>
                          {p.emoji}
                        </span>
                        <span className="mt-2 text-sm font-medium text-cream">{p.label}</span>
                        <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{p.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6 space-y-6 rounded-[1.75rem] border border-white/[0.14] bg-gradient-to-b from-card/70 to-card/40 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.08] backdrop-blur-md md:p-6 lg:mb-8">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label
                        className={cn(
                          "flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em]",
                          greetingFocus === "headline" ? "text-primary" : "text-cream/75",
                        )}
                        htmlFor="greeting-headline"
                      >
                        <Pen className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                        Headline
                      </label>
                      <span className="tabular-nums text-[10px] text-muted-foreground">{headline.length}/100</span>
                    </div>
                    <input
                      id="greeting-headline"
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      onFocus={() => setGreetingFocus("headline")}
                      onBlur={(e) => scheduleGreetingBlurClear(e)}
                      placeholder="e.g. I've been looking forward to this."
                      className={greetingInputClass}
                      maxLength={100}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label
                        className={cn(
                          "text-[11px] font-medium uppercase tracking-[0.22em]",
                          greetingFocus === "subtext" ? "text-primary" : "text-cream/75",
                        )}
                        htmlFor="greeting-subtext"
                      >
                        Subtext
                      </label>
                      <span className="tabular-nums text-[10px] text-muted-foreground">{subtext.length}/280</span>
                    </div>
                    <textarea
                      id="greeting-subtext"
                      value={subtext}
                      onChange={(e) => setSubtext(e.target.value)}
                      onFocus={() => setGreetingFocus("subtext")}
                      onBlur={(e) => scheduleGreetingBlurClear(e)}
                      placeholder="e.g. Pour yourself something nice. The door opens soon."
                      rows={4}
                      className={cn(greetingInputClass, "min-h-[6.25rem] resize-y")}
                      maxLength={280}
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 z-30 mt-auto -mx-6 border-t border-white/[0.1] bg-background/95 px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/88 lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-0 lg:backdrop-blur-none supports-[backdrop-filter]:lg:bg-transparent">
                  <button
                    type="button"
                    onClick={next}
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-4 font-semibold tracking-wide shadow-[0_12px_40px_rgba(212,130,106,0.3)]"
                  >
                    {headline || subtext ? "Continue" : "Skip"} <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              <aside className="relative mx-auto w-full max-w-[380px] space-y-3 lg:mx-0 lg:max-w-none lg:sticky lg:top-28 xl:top-32">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
                      <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Their lobby</p>
                      <p className="truncate text-xs font-medium text-cream/90">
                        {recipientName.trim() ? `${recipientName}'s preview` : "Guest preview"}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Live
                  </span>
                </div>
                <LobbyGreetingPreview
                  headline={headline}
                  subtext={subtext}
                  guestLabel={recipientName.trim() || "your guest"}
                  scheduledPreview={lobbyScheduledPreviewLabel}
                  startsNow={scheduledType === "now"}
                  highlightField={greetingFocus}
                  ambiance={lobbyAmbiance}
                />
              </aside>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div>
            <StepEyebrow stepIndex={stepIndex} />
            <h1 className="font-serif italic text-3xl md:text-4xl text-cream mb-6 md:mb-8 tracking-tight">
              Looks good?
            </h1>
            <div className="mb-8 grid gap-5 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
              <div className="flex flex-col rounded-[1.75rem] border border-white/[0.08] bg-card/35 p-5 md:p-6 lg:p-7 backdrop-blur-md shadow-[0_14px_48px_rgba(0,0,0,0.22)]">
                <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-primary" aria-hidden />
                  Tonight&apos;s connection vibe
                </p>
                <p className="mb-5 text-xs text-muted-foreground leading-relaxed">
                  Shapes prompts &amp; deepening tips in your room — not the visuals. Guests see the same vibe.
                </p>
                <div className="grid flex-1 grid-cols-2 gap-3 md:gap-4">
                  {(
                    [
                      { id: "playful" as const, emoji: "✨", t: "Playful", d: "Light, funny, curiosity." },
                      { id: "heartfelt" as const, emoji: "🫂", t: "Heartfelt", d: "Tender honesty & depth." },
                      { id: "electric" as const, emoji: "🔥", t: "Electric", d: "Chemistry-forward (mutual)." },
                      { id: "reconnect" as const, emoji: "🌿", t: "Repair", d: "Soft reset after drift." },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setConnectionIntent(opt.id)}
                      className={cn(
                        "flex h-full min-h-[6.5rem] flex-col gap-2.5 rounded-2xl border px-4 py-4 text-left transition md:min-h-[7rem] md:px-5 md:py-5",
                        connectionIntent === opt.id
                          ? "border-primary/45 bg-primary/15 ring-1 ring-primary/25 shadow-[0_8px_32px_rgba(212,130,106,0.12)]"
                          : "border-white/10 hover:border-primary/30 bg-secondary/20",
                      )}
                    >
                      <span className="text-2xl leading-none" aria-hidden>
                        {opt.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-cream">{opt.t}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{opt.d}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-card/95 via-card/50 to-primary/[0.06] backdrop-blur-xl p-5 md:p-6 lg:p-7 shadow-[0_24px_70px_rgba(0,0,0,0.38)] ring-1 ring-white/[0.06]">
                <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/18 blur-3xl" aria-hidden />
                <p className="relative mb-4 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                  Your room
                </p>
                <dl className="relative flex flex-1 flex-col divide-y divide-white/[0.07] text-sm">
                  {(
                    [
                      { label: "Plan", value: planMeta.title },
                      { label: "Guest", value: recipientName || "—" },
                      {
                        label: "When",
                        value:
                          scheduledType === "now"
                            ? "Now"
                            : scheduledDateTime?.toLocaleString() ?? "—",
                      },
                      { label: "Lobby atmosphere", value: ambianceMeta(lobbyAmbiance).label },
                      {
                        label: "Activities",
                        value:
                          curatedActivities.length === 0
                            ? "—"
                            : curatedActivities.map((id) => activityMeta(id).label).join(", "),
                      },
                      { label: "Vibe", value: connectionIntentLabel(connectionIntent) },
                      ...(headline
                        ? [{ label: "Greeting", value: `“${headline}”`, italic: true }]
                        : []),
                      { label: "Price", value: priceSummary(), accent: true },
                    ] as const
                  ).map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-6 py-3.5 first:pt-0 last:pb-0">
                      <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                      <dd
                        className={cn(
                          "min-w-0 text-right font-medium leading-snug",
                          "accent" in row && row.accent ? "text-champagne" : "text-cream",
                          "italic" in row && row.italic ? "italic" : "",
                        )}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 rounded-[1.15rem] text-base disabled:opacity-50 shadow-[0_14px_44px_rgba(212,130,106,0.28)] font-semibold tracking-wide"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Creating your room…
                </>
              ) : (
                <>
                  {ctaLabel()} <Sparkles className="w-4 h-4 opacity-90" aria-hidden />
                </>
              )}
            </button>
          </div>
        )}
      </main>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="border-white/10 bg-card/95 text-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif italic text-xl">
              {paymentDialogTitle(selectedPlan)}
            </DialogTitle>
          </DialogHeader>
          {billingConfig ? (
            <PaymentCheckout
              config={billingConfig}
              product={productForPlan(selectedPlan)}
              label={paymentLabelForPlan(selectedPlan)}
              returnPaths={stripeReturnPaths(selectedPlan)}
              onConfigRefresh={refreshBilling}
              onComplete={handlePaymentComplete}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading checkout…</p>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
