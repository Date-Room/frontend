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
  Pen,
  Sparkles,
  Loader2,
  Check,
  Lock,
} from "lucide-react";
import { LobbyGreetingPreview } from "@/components/LobbyGreetingPreview";
import { PageShell } from "@/components/PageShell";
import { AMBIANCE_PRESETS, PLAIN_MOOD } from "@/lib/ambiance";
import type { LobbyMood } from "@/lib/ambiance";
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
import { ApiError } from "@/lib/api";
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
import { cn } from "@/lib/utils";

type Plan = "try" | "date_pack" | "long_pack" | "together" | "crew";

type PlanGroup = "pack" | "subscription";

type PlanMeta = {
  id: Plan;
  title: string;
  desc: string;
  icon: string;
  persistence: RoomPersistence;
  package: RoomPackage;
  priceHint: string;
  group: PlanGroup;
  /** Bullet list shown on the package card. */
  features: string[];
  /** Static "recommended" ribbon for the standout plan in its group. */
  highlight?: boolean;
};

const PLANS: PlanMeta[] = [
  {
    id: "try",
    title: "Try",
    desc: "A first date, on us.",
    icon: "🕯️",
    persistence: "session",
    package: "single_pass",
    priceHint: "Free",
    group: "pack",
    features: ["One 20-minute session", "All core date activities", "No card required"],
  },
  {
    id: "date_pack",
    title: "Date Pack",
    desc: "For the early matches.",
    icon: "💌",
    persistence: "session",
    package: "date_pack",
    priceHint: "Uses a Date Pack credit",
    group: "pack",
    highlight: true,
    features: ["Three sessions", "1 hour each", "Every activity included"],
  },
  {
    id: "long_pack",
    title: "Long Pack",
    desc: "For the ones with potential.",
    icon: "🌙",
    persistence: "session",
    package: "long_pack",
    priceHint: "Uses a Long Pack credit",
    group: "pack",
    features: ["Five sessions", "2 hours each", "Best value per session"],
  },
  {
    id: "together",
    title: "Together",
    desc: "A room that stays open for two.",
    icon: "🏠",
    persistence: "persistent",
    package: "subscription",
    priceHint: "Together subscription",
    group: "subscription",
    highlight: true,
    features: ["Persistent room, same code", "Vision board & bookshelf", "Watch party up to 12", "Recap timeline"],
  },
  {
    id: "crew",
    title: "Crew",
    desc: "A room for the whole group.",
    icon: "🎬",
    persistence: "persistent",
    package: "subscription",
    priceHint: "Crew subscription",
    group: "subscription",
    features: ["Persistent group room", "Vision board & bookshelf", "Group watch parties", "Up to 12 people"],
  },
];

type Step = "plan" | "when" | "experience" | "greeting";
const STEPS: Step[] = ["plan", "when", "experience", "greeting"];
const STEP_LABELS = ["Plan", "When", "Experience", "Lobby mood"] as const;
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

// One consistent container width for every step so the layout never jumps
// between steps 1…N.
const STEP_MAX_WIDTH = "max-w-3xl lg:max-w-4xl";

function shellMaxWidth(_step: Step): string {
  return STEP_MAX_WIDTH;
}

function mainMaxWidth(step: Step): string {
  // Greeting needs extra bottom room for its floating preview on mobile.
  return step === "greeting" ? `${STEP_MAX_WIDTH} pb-36 lg:pb-28` : STEP_MAX_WIDTH;
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
  const [scheduledType, setScheduledType] = useState<"now" | "later">("now");
  const [scheduledDatePart, setScheduledDatePart] = useState("");
  const [scheduledTimePart, setScheduledTimePart] = useState("");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [lobbyAmbiance, setLobbyAmbiance] = useState<LobbyMood>("candlelit");
  const [greetingFocus, setGreetingFocus] = useState<"headline" | "subtext" | null>(null);
  const [creating, setCreating] = useState(false);
  const greetingBlurClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledDateInputRef = useRef<HTMLInputElement>(null);
  const scheduledTimeInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const planMeta = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0];

  // Plans the user can actually use right now — the free Try session plus any
  // credits/subscription they already own. Buying more happens in the profile,
  // so the create flow never doubles as a store.
  const usablePlans = useMemo(() => {
    const byId = (id: Plan) => PLANS.find((p) => p.id === id)!;
    const list: { meta: PlanMeta; status: string }[] = [
      { meta: byId("try"), status: "Free · one 20-min session" },
    ];
    const e = entitlement;
    if (e) {
      if (e.date_pack_remaining > 0) {
        list.push({
          meta: byId("date_pack"),
          status: `1 hour each · ${e.date_pack_remaining} left`,
        });
      }
      if (e.long_pack_remaining > 0) {
        list.push({
          meta: byId("long_pack"),
          status: `2 hours each · ${e.long_pack_remaining} left`,
        });
      }
      if (e.has_active_subscription) {
        // A real paid subscription unlocks unlimited persistent rooms.
        if (e.account_tier === "crew") {
          list.push({ meta: byId("crew"), status: "Subscription active · group room" });
        } else {
          list.push({ meta: byId("together"), status: "Subscription active · room for two" });
        }
      } else {
        // Promo/granted Together/Crew credits — counted, one room each.
        if ((e.together_remaining ?? 0) > 0) {
          list.push({ meta: byId("together"), status: `Persistent room · ${e.together_remaining} left` });
        }
        if ((e.crew_remaining ?? 0) > 0) {
          list.push({ meta: byId("crew"), status: `Group room · ${e.crew_remaining} left` });
        }
      }
    }
    return list;
  }, [entitlement]);

  function goManagePlans() {
    navigate("/home?tab=profile");
  }

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
      case "crew":
        // A persistent room needs a real subscription OR a counted
        // Together/Crew credit (create_room debits whichever exists).
        return (
          !e.has_active_subscription &&
          (e.together_remaining ?? 0) <= 0 &&
          (e.crew_remaining ?? 0) <= 0
        );
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
          setStep("when");
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
    // No guest name is collected here — the person joining sets their own name
    // (their profile name if signed in, or a typed name if anonymous).
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

    await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
    await queryClient.invalidateQueries({ queryKey: ["invite-card", room.code] });
    navigate(`/rooms/${room.id}/pre`);
  }

  async function handleCreate() {
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
      if (e instanceof Error && e.message === "missing schedule") {
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
    "focus-ring w-full rounded-xl px-4 py-3.5 bg-secondary/60 border border-transparent text-cream placeholder:text-muted-foreground/70 focus:border-primary/30 transition text-sm";

  const greetingInputClass = inputClass;

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
          {/* Spacer to keep the title centered opposite the back button —
              the progress bar below is the single progress indicator. */}
          <span className="w-10 shrink-0" aria-hidden />
        </div>
        <div className={cn("mx-auto flex items-center gap-3 px-6", shellMaxWidth(step))}>
          <div className="h-1 flex-1 bg-black/30">
            <div className="h-full rounded-full bg-border/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-primary/90 to-champagne transition-[width] duration-500 ease-out shadow-[0_0_16px_rgba(212,130,106,0.35)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 tabular-nums text-[11px] font-medium text-muted-foreground">
            {stepIndex + 1}/{STEPS.length}
          </span>
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
            <h1 className="font-serif text-3xl md:text-4xl font-semibold leading-tight text-cream mb-6 tracking-tight">
              Choose a plan
            </h1>
            {entitlement ? (
              <div className="editorial-card divide-y divide-white/[0.05] overflow-hidden">
                {usablePlans.map(({ meta, status }) => {
                  const isSelected = selectedPlan === meta.id;
                  return (
                    <button
                      key={meta.id}
                      type="button"
                      onClick={() => handlePlanSelect(meta.id)}
                      className={cn(
                        "focus-ring group flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-white/[0.025]",
                        isSelected && "bg-primary/[0.06]",
                      )}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-xl ring-1 ring-primary/20">
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-cream">{meta.title}</p>
                        <p className="text-xs text-muted-foreground">{status}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-cream" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="editorial-card space-y-3 p-4">
                {[0, 1].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-xl bg-white/[0.05]" />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={goManagePlans}
              className="focus-ring mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm text-muted-foreground transition-colors hover:text-cream"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Buy a plan
            </button>
          </div>
        )}

        {step === "when" && (
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-semibold leading-tight text-cream mb-3 tracking-tight">
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
                      ? "border-primary/45 bg-gradient-to-br from-primary/18 via-primary/8 to-transparent ring-1 ring-primary/20"
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
              <div className="editorial-card mb-6 grid gap-4 p-5 md:grid-cols-2 md:gap-5 md:p-6">
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
                className="btn-primary w-full md:w-[calc((100%-1.25rem)/2)] flex items-center justify-center gap-2 py-4 rounded-[1.15rem] disabled:opacity-45 font-medium tracking-wide"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === "experience" && (
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-semibold leading-tight text-cream mb-3 tracking-tight">
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
                          ? "border-primary/50 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent ring-1 ring-primary/25"
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
                className="btn-primary w-full md:w-[calc((100%-1rem)/2)] flex items-center justify-center gap-2 py-4 rounded-[1.15rem] disabled:opacity-45 font-medium tracking-wide"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === "greeting" && (
          <div className="space-y-8">
            <div className="flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-start lg:gap-x-10 xl:grid-cols-[1fr_400px] xl:gap-x-12">
              <div className="flex min-h-0 min-w-0 flex-col">
                <h1 className="mb-3 font-serif text-3xl md:text-4xl font-semibold leading-tight tracking-tight text-cream">
                  Set the mood{" "}
                  <span className="font-sans text-base font-normal text-muted-foreground md:text-lg">
                    (optional)
                  </span>
                </h1>
                <p className="mb-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  What your guest sees while they wait.
                </p>

                <div className="mb-6 space-y-3 md:mb-7">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Lobby atmosphere</p>
                  <div className="flex flex-wrap gap-2">
                    {[...AMBIANCE_PRESETS, { id: PLAIN_MOOD, label: "Plain", emoji: "⬜" }].map((p) => {
                      const selected = lobbyAmbiance === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          // Click the selected mood again to clear it → plain room.
                          onClick={() =>
                            setLobbyAmbiance((cur) =>
                              cur === p.id && p.id !== PLAIN_MOOD ? PLAIN_MOOD : p.id,
                            )
                          }
                          aria-pressed={selected}
                          title={"hint" in p ? p.hint : "No background"}
                          className={cn(
                            "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition",
                            selected
                              ? "border-primary/45 bg-primary/15 text-cream ring-1 ring-primary/25"
                              : "border-white/[0.08] bg-card/30 text-cream/80 hover:border-primary/25 hover:text-cream",
                          )}
                        >
                          <span className="text-base leading-none" aria-hidden>
                            {p.emoji}
                          </span>
                          <span className="font-medium">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="editorial-card mb-6 space-y-6 p-5 md:p-6 lg:mb-8">
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
                    onClick={handleCreate}
                    disabled={creating}
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-4 font-semibold tracking-wide disabled:opacity-50"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Creating your room…
                      </>
                    ) : (
                      <>
                        {ctaLabel()} <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
                      </>
                    )}
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
                        Guest preview
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
                  guestLabel="your guest"
                  scheduledPreview={lobbyScheduledPreviewLabel}
                  startsNow={scheduledType === "now"}
                  highlightField={greetingFocus}
                  ambiance={lobbyAmbiance}
                />
              </aside>
            </div>
          </div>
        )}
      </main>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="border-white/10 bg-card/95 text-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-semibold">
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
