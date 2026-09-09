import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronRight, Lightbulb, Loader2, ShieldCheck, Sparkles } from "lucide-react";
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
} from "@/lib/activities/activityState";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import { getChaperonDebrief, type ChaperonDebriefResponse } from "@/lib/chaperon";
import {
  getBillingConfig,
  getEntitlement,
  type BillableProduct,
  type Entitlement,
} from "@/lib/billing";
import { buildNight, NIGHT_NAMES } from "@/lib/recapNight";
import { claimRoom, promoteRoom } from "@/lib/rooms";
import {
  billingProductForTier,
  formatTierPrice,
  tierPricingMeta,
} from "@/lib/tierPricing";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Tonight — the end-of-call recap, rebuilt as something a couple would read
 * together instead of a raw feed: three figures, the shape of the night in
 * proportion, one result card per room with what-was-said folded away, the
 * chaperon's debrief, the lines worth keeping, and the two decisions given
 * room to breathe. The full log survives behind one toggle.
 */

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
  if (!entitlement) return false;
  return (
    entitlement.has_active_subscription === true ||
    (entitlement.together_remaining ?? 0) > 0 ||
    (entitlement.crew_remaining ?? 0) > 0
  );
}

function stripeReturnPaths(roomId: string, product: BillableProduct) {
  return {
    successPath: `/room/${roomId}/recap?checkout=success&plan=${product}&session_id={CHECKOUT_SESSION_ID}`,
    cancelPath: `/room/${roomId}/recap?checkout=cancel&plan=${product}`,
  };
}

function eventLabel(e: ActivityEventResponse): string {
  const t = e.event_type.replace(/_/g, " ");
  const payloadText = typeof e.payload?.text === "string" ? ` — ${e.payload.text as string}` : "";
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

/** Pull the recap-invite token out of the URL fragment (`#k=<token>`). */
function readInviteToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.location.hash;
  if (!raw) return undefined;
  const params = new URLSearchParams(raw.startsWith("#") ? raw.slice(1) : raw);
  const t = params.get("k");
  return t && t.length > 10 ? t : undefined;
}

const KIND_PILL: Record<string, { word: string; cls: string }> = {
  game: { word: "Played", cls: "border-primary/40 bg-primary/10 text-primary" },
  talk: { word: "Talked", cls: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  shared: { word: "Together", cls: "border-white/20 bg-white/[0.06] text-cream/80" },
};

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
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

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

  const { data: debriefRes } = useQuery<ChaperonDebriefResponse | null>({
    queryKey: ["chaperon-debrief", id],
    enabled: Boolean(id) && Boolean(authClient.getSession()),
    retry: false,
    queryFn: () => getChaperonDebrief(id as string).catch(() => null),
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

  const activities = (data?.activities ?? []).filter((a) => NIGHT_NAMES[a.activity_id]);
  const events = data?.events ?? [];

  const actorNames = Array.from(
    new Set(
      events
        .map((e) => e.actor_display_name?.trim())
        .filter((n): n is string => !!n && n.length > 0),
    ),
  );
  const partnerName = actorNames.length >= 2 ? actorNames[actorNames.length - 1] : null;
  const myUserId =
    ((authClient.getSession() as unknown as { user?: { id?: string } } | null)?.user?.id ?? null);

  const night = useMemo(
    () => buildNight(activities, events, { myUserId, partnerName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, myUserId, partnerName],
  );

  const sortedLog = useMemo(
    () => events.slice().sort((x, y) => x.created_at.localeCompare(y.created_at)),
    [events],
  );

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

  const dateWord = useMemo(() => {
    const first = sortedLog[0]?.created_at;
    const d = first ? new Date(first) : new Date();
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  }, [sortedLog]);

  return (
    <CardPage
      maxWidth="sm:max-w-2xl lg:max-w-3xl"
      headerRight={
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/home");
          }}
          className="btn-ghost focus-ring text-sm"
        >
          Done
        </button>
      }
    >
      <div className="text-center mb-8 animate-float-up">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary mb-2">{dateWord}</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-cream italic mb-2">
          {partnerName ? `Tonight with ${partnerName}` : "Tonight"}
        </h1>
        <p className="text-muted-foreground text-sm">{night.sentence}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
        </div>
      ) : night.cards.length === 0 && events.length === 0 ? (
        <div className="editorial-card p-8 text-center text-sm text-muted-foreground italic mb-8">
          No activity was saved for this room yet.
        </div>
      ) : (
        <>
          {/* Three figures, never more. */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {night.figures.slice(0, 3).map((f, i) => (
              <div key={i} className="editorial-card p-4">
                <p className="font-serif text-2xl text-primary leading-none">{f.value}</p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{f.label}</p>
              </div>
            ))}
          </div>

          {/* The shape of the night — the only chart, hidden for one room. */}
          {night.cards.length > 1 && (
            <div className="mb-8">
              <div className="flex h-9 gap-1" aria-hidden>
                {night.cards.map((c) => (
                  <span
                    key={c.id}
                    className={cn(
                      "flex min-w-0 items-center overflow-hidden rounded-lg border px-2",
                      c.kind === "talk"
                        ? "border-sky-400/30 bg-sky-400/10"
                        : c.kind === "game"
                          ? "border-primary/35 bg-primary/10"
                          : "border-white/15 bg-white/[0.05]",
                    )}
                    style={{ flexGrow: c.minutes }}
                  >
                    <span className="truncate text-[9px] uppercase tracking-[0.12em] text-cream/80">{c.name}</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary/80" /> played
                <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-sky-400/80" /> talked
              </p>
            </div>
          )}

          {/* The chaperon's debrief — yours only; your date has their own. */}
          {debriefRes?.debrief && (
            <section className="mb-8 animate-float-up">
              <div className="editorial-card p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-rosegold" aria-hidden />
                    From your chaperon
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                      debriefRes.debrief.safety === "all_clear"
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-300",
                    )}
                  >
                    {debriefRes.debrief.safety === "all_clear"
                      ? "Nothing needed flagging"
                      : "Something was flagged"}
                  </span>
                </div>
                <h2 className="font-serif text-xl italic leading-snug text-cream">
                  {debriefRes.debrief.headline}
                </h2>
                {debriefRes.debrief.moments.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {debriefRes.debrief.moments.map((m) => (
                      <li key={m} className="flex items-start gap-2.5 text-sm text-cream/85">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rosegold/70" aria-hidden />
                        {m}
                      </li>
                    ))}
                  </ul>
                )}
                {debriefRes.debrief.tip && (
                  <p className="mt-4 flex items-start gap-2 border-t border-white/10 pt-3 text-sm text-muted-foreground">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-rosegold/70" aria-hidden />
                    {debriefRes.debrief.tip}
                  </p>
                )}
              </div>
            </section>
          )}
          {debriefRes && !debriefRes.debrief && debriefRes.ended_at && debriefRes.data_tier === "none" && (
            <p className="mb-8 text-center text-xs italic text-muted-foreground">
              Your chaperon kept no summary — you chose the no-retention setting.
            </p>
          )}

          {/* One card per room, results not statuses. One detail open at a time. */}
          {night.cards.length > 0 && (
            <section className="mb-8">
              <p className="mb-3 px-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">What you did</p>
              <div className="space-y-3">
                {night.cards.map((c) => {
                  const pill = KIND_PILL[c.kind];
                  const isOpen = openCard === c.id;
                  return (
                    <div key={c.id} className={cn("editorial-card p-5", isOpen && "border-primary/30")}>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]", pill.cls)}>
                          {pill.word}
                        </span>
                        <p className="font-serif text-lg text-cream">{c.name}</p>
                        {c.span && <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{c.span}</span>}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-cream/90">{c.outcome}</p>
                      {c.figure && (
                        <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          <span className="mr-1 font-serif text-sm normal-case tracking-normal text-primary">{c.figure.value}</span>
                          {c.figure.label}
                        </p>
                      )}
                      {c.moments.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpenCard(isOpen ? null : c.id)}
                          className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-primary"
                        >
                          {isOpen ? "Hide what was said" : `What was said (${c.moments.length})`}
                        </button>
                      )}
                      {isOpen && (
                        <ul className="mt-3 space-y-2 border-t border-white/[0.08] pt-3">
                          {c.moments.map((m, i) => (
                            <li key={i} className="flex items-baseline gap-2.5 text-sm">
                              <span className="w-14 shrink-0 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{m.who}</span>
                              <span className="flex-1 text-cream/85">{m.text}</span>
                              <span className="text-[10px] text-muted-foreground/70 tabular-nums">{m.at}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* The emotional payload: the lines someone chose to keep. */}
          {night.keepsakes.length > 0 && (
            <section className="mb-8">
              <p className="mb-3 px-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Worth keeping</p>
              <div className="space-y-3">
                {night.keepsakes.map((k, i) => (
                  <blockquote key={i} className="rounded-r-2xl border-l-2 border-primary bg-white/[0.03] p-4">
                    <p className="font-serif text-base italic leading-relaxed text-cream">&ldquo;{k.text}&rdquo;</p>
                    <footer className="mt-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      {k.by} · {k.from}
                    </footer>
                  </blockquote>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Before you go — the two decisions, given room to breathe. */}
      <p className="mb-3 px-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Before you go</p>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {authClient.getSession() && id && (
          <button
            type="button"
            disabled={promoting}
            onClick={() => void handleMakeForever()}
            className="rounded-[1.5rem] border border-primary/30 bg-gradient-to-br from-primary/[0.12] to-transparent p-5 text-left focus-ring hover-lift-strong disabled:opacity-60 disabled:cursor-wait"
          >
            <p className="flex items-center gap-2 font-serif text-lg text-cream">
              {promoting ? <Loader2 className="h-4 w-4 animate-spin text-rosegold" /> : <Sparkles className="h-4 w-4 text-rosegold" />}
              Make this room forever
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Keep going as a couple. Drops the 24-hour timer, and everything above stays.
            </p>
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate("/create")}
          className="editorial-card hover-lift focus-ring p-5 text-left"
        >
          <p className="flex items-center gap-2 font-serif text-lg text-cream">
            <Calendar className="h-4 w-4 text-amber" />
            Schedule the next one
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            A fresh room and a date in the diary. Anything banked picks up where you left it.
          </p>
        </button>
      </div>

      {promoteError && <p className="mb-4 text-xs text-rose-300">{promoteError}</p>}

      {/* The old feed, folded away. */}
      {sortedLog.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-primary"
          >
            {showLog ? "Hide the full log" : `Show the full log (${sortedLog.length} entries)`}
          </button>
          {showLog && (
            <ol className="relative mb-6 ml-3 space-y-3 border-l border-white/[0.08] pl-5">
              {sortedLog.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[1.55rem] top-1.5 h-2 w-2 rounded-full bg-primary/60 ring-4 ring-background" aria-hidden />
                  <p className="text-sm text-cream">
                    <span className="text-cream/80">{e.actor_display_name || "Guest"}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground/90">{eventLabel(e)}</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                    {NIGHT_NAMES[e.activity_id]?.name ?? e.activity_id} · {formatRelativeTime(e.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        Make it forever and everything here stays with the room.
      </p>

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
                            <span className="text-sm font-semibold tabular-nums text-primary">{price}</span>
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
              label={upgradeProduct === "crew" ? "Subscribe to Crew" : "Subscribe to Together"}
              returnPaths={id ? stripeReturnPaths(id, upgradeProduct) : undefined}
              onConfigRefresh={refreshBilling}
              onComplete={handleUpgradeComplete}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading checkout…</p>
          )}
        </DialogContent>
      </Dialog>
    </CardPage>
  );
}
