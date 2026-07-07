import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { CardPage } from "@/components/CardPage";
import { PaymentCheckout } from "@/components/PaymentCheckout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getRoomRecap,
  type ActivityEventResponse,
  type ActivityStateResponse,
} from "@/lib/activities/activityState";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import {
  getBillingConfig,
  getEntitlement,
  type BillableProduct,
  type Entitlement,
} from "@/lib/billing";
import { claimRoom, promoteRoom } from "@/lib/rooms";
import {
  billingProductForTier,
  formatTierPrice,
  tierPricingMeta,
} from "@/lib/tierPricing";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RECAP_PROMOTE_STORAGE_KEY = "dateroom:recap:promote-room";

const PERSISTENT_TIERS = [
  {
    product: "together" as const,
    title: "Together",
    desc: "Persistent room for two — vision board, bookshelf, watch party.",
    emoji: "🏠",
  },
  {
    product: "crew" as const,
    title: "Crew",
    desc: "Group watch parties and a room that stays for your crew.",
    emoji: "🎬",
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function canPromoteWithoutPayment(entitlement: Entitlement | undefined): boolean {
  return entitlement?.has_active_subscription === true;
}

function stripeReturnPaths(roomId: string, product: BillableProduct) {
  return {
    successPath: `/room/${roomId}/recap?checkout=success&plan=${product}&session_id={CHECKOUT_SESSION_ID}`,
    cancelPath: `/room/${roomId}/recap?checkout=cancel&plan=${product}`,
  };
}

const ACTIVITY_LABELS: Record<string, string> = {
  questions: "21 Questions",
  watch: "Watch",
  dj: "DJ",
  chat: "Chat",
  this_or_that: "This or That",
  the_36: "The 36",
  "2_truths": "Two Truths and a Lie",
  truth_or_dare: "Truth or Dare",
  capture: "Captures",
};

/** A one-line human summary of an activity's persisted state. */
function summarize(a: ActivityStateResponse): string {
  const s = a.state ?? {};
  switch (a.activity_id) {
    case "chat": {
      const n = Array.isArray(s.messages) ? s.messages.length : 0;
      return `${n} message${n === 1 ? "" : "s"}`;
    }
    case "this_or_that": {
      const i = typeof s.prompt_index === "number" ? s.prompt_index : 0;
      return `${i + 1} round${i === 0 ? "" : "s"}`;
    }
    case "watch":
      return s.video_id ? "Watched a video together" : "Opened";
    case "dj": {
      const np = s.now_playing as { title?: string } | null;
      return np?.title ? `Last track: ${np.title}` : "Took turns on the aux";
    }
    case "questions":
      return typeof s.phase === "string" ? `Phase: ${s.phase}` : "Played";
    default:
      return "Saved";
  }
}

/** One-line label for a timeline event. Activities own their event
 *  vocab; we render a sensible default and let the payload show
 *  through if it has a `text` field. */
function eventLabel(e: ActivityEventResponse): string {
  const t = e.event_type.replace(/_/g, " ");
  const payloadText =
    typeof e.payload?.text === "string" ? ` — ${e.payload.text as string}` : "";
  return `${t}${payloadText}`;
}

function formatRelativeTime(then: string): string {
  const ms = Date.now() - new Date(then).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Pull the recap-invite token out of the URL fragment (`#k=<token>`).
 * Fragment, not query, so the JWT never lands in server access logs /
 * Referer headers when the user clicks an outbound link. */
function readInviteToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.location.hash;
  if (!raw) return undefined;
  const params = new URLSearchParams(raw.startsWith("#") ? raw.slice(1) : raw);
  const t = params.get("k");
  return t && t.length > 10 ? t : undefined;
}

export default function Recap() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const participantId = params.get("participant_id") ?? undefined;
  const inviteToken = useMemo(() => readInviteToken(), []);
  const [claiming, setClaiming] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeProduct, setUpgradeProduct] = useState<BillableProduct | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recap", id, inviteToken ?? ""],
    enabled: !!id,
    queryFn: () => getRoomRecap(id as string, participantId, inviteToken),
  });

  const { data: entitlement } = useQuery({
    queryKey: ["entitlement"],
    queryFn: getEntitlement,
    enabled: Boolean(authClient.getSession()),
  });

  const { data: billingConfig } = useQuery({
    queryKey: ["billing-config"],
    queryFn: getBillingConfig,
    enabled: Boolean(authClient.getSession()),
  });

  const refreshBilling = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entitlement"] }),
      queryClient.invalidateQueries({ queryKey: ["billing-config"] }),
    ]);
  }, [queryClient]);

  const promoteRoomNow = useCallback(async () => {
    if (!id) return;
    setPromoting(true);
    setPromoteError(null);
    try {
      await promoteRoom(id);
      queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["my-connections"] });
      toast.success("This room is now forever");
      navigate("/home");
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setUpgradeOpen(true);
        setUpgradeProduct(null);
        return;
      }
      setPromoteError(e instanceof Error ? e.message : "Couldn't save this room.");
    } finally {
      setPromoting(false);
    }
  }, [id, navigate, queryClient]);

  useEffect(() => {
    const checkout = params.get("checkout");
    if (!checkout || !id) return;

    let cancelled = false;
    void (async () => {
      const storedRoomId = sessionStorage.getItem(RECAP_PROMOTE_STORAGE_KEY);

      if (checkout === "success" && storedRoomId === id) {
        await refreshBilling();
        let e = await getEntitlement();
        for (let i = 0; i < 6 && !canPromoteWithoutPayment(e); i += 1) {
          await sleep(2000);
          if (cancelled) return;
          e = await getEntitlement();
        }
        if (!cancelled && canPromoteWithoutPayment(e)) {
          toast.success("Payment received — saving your room forever.");
          await promoteRoomNow();
        } else if (!cancelled) {
          toast.message("Payment received — tap Make this room forever to finish.");
          setUpgradeOpen(false);
        }
      } else if (checkout === "cancel") {
        toast.message("Checkout cancelled.");
      }

      sessionStorage.removeItem(RECAP_PROMOTE_STORAGE_KEY);
      navigate(`/room/${id}/recap`, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [id, navigate, params, promoteRoomNow, refreshBilling]);

  // Post-auth claim. If we have a token AND we're signed in AND we
  // haven't already claimed this room (idempotent server-side, so
  // re-runs are cheap), POST /claim once. After that the room shows
  // up on the Recap tab without any further hops.
  useEffect(() => {
    if (!id || !inviteToken || claiming) return;
    const session = authClient.getSession();
    if (!session) return;
    setClaiming(true);
    void claimRoom(id, inviteToken)
      .then(() => queryClient.invalidateQueries({ queryKey: ["my-rooms"] }))
      .catch(() => null)
      .finally(() => setClaiming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, inviteToken]);

  const activities = (data?.activities ?? []).filter((a) => ACTIVITY_LABELS[a.activity_id]);
  const events = data?.events ?? [];

  // Personalisation: pull distinct actor names off the events log so
  // the header reads 'Tonight with Sasha' instead of just 'Tonight'.
  // Falls back to generic when no events (the user hasn't played
  // anything) or when only one name appears (solo session).
  const actorNames = Array.from(
    new Set(
      events
        .map((e) => e.actor_display_name?.trim())
        .filter((n): n is string => !!n && n.length > 0),
    ),
  );
  const partnerName = actorNames.length >= 2 ? actorNames[actorNames.length - 1] : null;

  async function handleMakeForever() {
    if (canPromoteWithoutPayment(entitlement)) {
      await promoteRoomNow();
      return;
    }
    setPromoteError(null);
    setUpgradeProduct(null);
    setUpgradeOpen(true);
  }

  async function handleUpgradeComplete() {
    await refreshBilling();
    setUpgradeOpen(false);
    setUpgradeProduct(null);
    await promoteRoomNow();
  }

  function handlePickUpgrade(product: BillableProduct) {
    if (id) sessionStorage.setItem(RECAP_PROMOTE_STORAGE_KEY, id);
    setUpgradeProduct(product);
  }

  const upgradeTitle =
    upgradeProduct === "crew"
      ? "Subscribe to Crew"
      : upgradeProduct === "together"
        ? "Subscribe to Together"
        : "Make this room forever";

  return (
    <CardPage
      maxWidth="sm:max-w-2xl lg:max-w-3xl"
      headerRight={
        <button
          type="button"
          onClick={() => {
            // Close the recap and go back where the user was —
            // matters when they reached this from the Recap tab,
            // Home, or a partner's deep link. Falls back to /home
            // only when there's no history to pop (e.g. cold-loaded
            // the recap URL directly).
            if (window.history.length > 1) navigate(-1);
            else navigate("/home");
          }}
          className="btn-ghost focus-ring text-sm"
        >
          Done
        </button>
      }
    >
      <div className="text-center mb-10 animate-float-up">
        <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
        <h1 className="font-serif text-3xl sm:text-4xl text-cream italic mb-2">
          {partnerName ? `Tonight with ${partnerName}` : "Tonight"}
        </h1>
        <p className="text-muted-foreground text-sm">A look back at what you did together</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
        </div>
      ) : activities.length === 0 && events.length === 0 ? (
        <div className="editorial-card p-8 text-center text-sm text-muted-foreground italic mb-8">
          No activity was saved for this room yet.
        </div>
      ) : (
        <>
          {/* Per-activity summary cards */}
          {activities.length > 0 && (
            <section className="space-y-3 mb-10 stagger-children">
              <p className="px-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Activities</p>
              {activities.map((a) => (
                <div key={a.activity_id} className="editorial-card hover-lift flex items-center gap-4 p-5">
                  <div className="w-10 h-10 rounded-xl bg-rosegold/10 border border-rosegold/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-rosegold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-cream">{ACTIVITY_LABELS[a.activity_id]}</p>
                    <p className="text-xs text-muted-foreground">{summarize(a)}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Chronological timeline — sourced from the events log. */}
          {events.length > 0 && (
            <section className="mb-10">
              <p className="mb-4 px-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Timeline</p>
              <ol className="relative ml-3 border-l border-white/[0.08] pl-5 space-y-4">
                {events.map((e) => (
                  <li key={e.id} className="relative animate-float-up">
                    <span
                      className="absolute -left-[1.55rem] top-1.5 h-2 w-2 rounded-full bg-primary/60 ring-4 ring-background"
                      aria-hidden
                    />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm text-cream">
                        <span className="text-cream/80">{e.actor_display_name || "Guest"}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-muted-foreground/90">{eventLabel(e)}</span>
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                        {ACTIVITY_LABELS[e.activity_id] ?? e.activity_id} · {formatRelativeTime(e.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {/* Promote-to-persistent CTA. Signed-in only; server enforces
       *  the rest (must be a session room in grace, partner must
       *  have an account, etc.). On success the (now-forever) room
       *  goes to home — there's no separate Our Room view anymore
       *  (persistent rooms render as plain tiles in the unified list). */}
      {authClient.getSession() && id && (
        <button
          type="button"
          disabled={promoting}
          onClick={() => void handleMakeForever()}
          className="mb-4 w-full rounded-[1.5rem] border border-primary/30 bg-gradient-to-br from-primary/[0.12] to-transparent shadow-[0_22px_60px_-20px_rgba(212,130,106,0.35)] flex items-center gap-4 p-5 focus-ring hover-lift-strong disabled:opacity-60 disabled:cursor-wait"
        >
          <div className="w-10 h-10 rounded-xl bg-rosegold/15 border border-rosegold/25 flex items-center justify-center">
            {promoting ? <Loader2 className="w-5 h-5 text-rosegold animate-spin" /> : <Sparkles className="w-5 h-5 text-rosegold" />}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-cream">Make this room forever</p>
            <p className="text-xs text-muted-foreground">Keep going as a couple — drops the 24h timer.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
        </button>
      )}

      <Dialog
        open={upgradeOpen}
        onOpenChange={(open) => {
          setUpgradeOpen(open);
          if (!open) setUpgradeProduct(null);
        }}
      >
        <DialogContent className="border-white/10 bg-card/95 text-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif font-semibold text-xl">{upgradeTitle}</DialogTitle>
          </DialogHeader>

          {!upgradeProduct ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Persistent rooms need a <span className="text-cream">Together</span> or{" "}
                <span className="text-cream">Crew</span> subscription. Pick a plan to keep
                this room — no 24h timer.
              </p>
              <ul className="space-y-3">
                {PERSISTENT_TIERS.map((tier) => {
                  const meta = billingProductForTier(tier.product, billingConfig?.products);
                  const price = formatTierPrice(tier.product, meta);
                  const unit = tierPricingMeta(tier.product).unit;
                  return (
                    <li key={tier.product}>
                      <button
                        type="button"
                        onClick={() => handlePickUpgrade(tier.product)}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-[1.25rem] border border-white/[0.08]",
                          "bg-black/20 p-4 text-left transition hover:border-primary/30 hover:bg-primary/[0.06]",
                        )}
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl ring-1 ring-primary/20">
                          {tier.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-cream">{tier.title}</span>
                            <span className="text-sm font-semibold tabular-nums text-primary">
                              {price}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {tier.desc}
                            {unit ? ` · ${unit}` : ""}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : billingConfig ? (
            <PaymentCheckout
              config={billingConfig}
              product={upgradeProduct}
              label={
                upgradeProduct === "crew" ? "Subscribe to Crew" : "Subscribe to Together"
              }
              returnPaths={id ? stripeReturnPaths(id, upgradeProduct) : undefined}
              onConfigRefresh={refreshBilling}
              onComplete={handleUpgradeComplete}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading checkout…</p>
          )}
        </DialogContent>
      </Dialog>

      {promoteError && (
        <p className="mb-4 text-xs text-rose-300">{promoteError}</p>
      )}

      <button
        type="button"
        onClick={() => navigate("/create")}
        className="w-full editorial-card hover-lift focus-ring flex items-center gap-4 p-4"
      >
        <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-amber" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-cream">Schedule the next one</p>
          <p className="text-xs text-muted-foreground">Create a fresh room</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
      </button>
    </CardPage>
  );
}
