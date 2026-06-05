import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CardPage } from "@/components/CardPage";
import { createRoom, type RoomPackage, type RoomPersistence } from "@/lib/rooms";
import {
  createCheckoutSession,
  createPackCheckoutSession,
  getEntitlement,
  type Entitlement,
} from "@/lib/billing";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Plan = "try" | "date_pack" | "long_pack" | "together";

type PlanMeta = {
  id: Plan;
  title: string;
  desc: string;
  icon: string;
  persistence: RoomPersistence;
  package: RoomPackage;
};

const PLANS: PlanMeta[] = [
  {
    id: "try",
    title: "Try",
    desc: "One session, 20 minutes. Free.",
    icon: "🕯️",
    persistence: "session",
    package: "single_pass",
  },
  {
    id: "date_pack",
    title: "Date Pack",
    desc: "Three sessions, 1 hour each.",
    icon: "💌",
    persistence: "session",
    package: "date_pack",
  },
  {
    id: "long_pack",
    title: "Long Pack",
    desc: "Five sessions, 2 hours each.",
    icon: "🌙",
    persistence: "session",
    package: "long_pack",
  },
  {
    id: "together",
    title: "Together",
    desc: "A room that stays open. Monthly.",
    icon: "🏠",
    persistence: "persistent",
    package: "subscription",
  },
];

/**
 * Create Room — four-plan picker matching the landing page and the
 * mobile catalog: Try / Date Pack / Long Pack / Together. The picker
 * reads `/v1/entitlements` to render per-pack balance badges and
 * decides whether to bounce through Stripe Checkout before creating
 * the room when balances are zero.
 */
export default function CreateRoom() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Plan>("try");
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [headline, setHeadline] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  // Pull the entitlement snapshot once on mount so balance badges and
  // CTA copy reflect reality. The webhook updates it asynchronously
  // after Stripe Checkout; we re-fetch on focus to catch that.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const e = await getEntitlement();
        if (!cancelled) setEntitlement(e);
      } catch {
        // Silent — backend will gate on create with 402 if entitlement
        // is missing. The picker just hides badges.
      }
    })();
    const onFocus = async () => {
      try {
        const e = await getEntitlement();
        if (!cancelled) setEntitlement(e);
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

  function purchaseRequired(plan: Plan, e: Entitlement | null): boolean {
    if (e === null) return false;
    switch (plan) {
      case "try":
        return false;
      case "date_pack":
        return e.date_pack_remaining <= 0;
      case "long_pack":
        return e.long_pack_remaining <= 0;
      case "together":
        return !e.has_active_subscription;
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const meta = PLANS.find((p) => p.id === selected);
      if (!meta) return;

      // If this plan needs a purchase first, bounce to Stripe and let
      // the success URL re-enter this page. The user can come back
      // here, balance updates via /entitlements, and they tap Create
      // again — no race because state resets.
      if (purchaseRequired(selected, entitlement)) {
        const { url } =
          selected === "together"
            ? await createCheckoutSession()
            : await createPackCheckoutSession(
                selected === "date_pack" ? "date_pack" : "long_pack",
              );
        window.location.href = url;
        return;
      }

      const room = await createRoom({
        persistence: meta.persistence,
        package: meta.package,
        greeting_headline: headline.trim() || null,
        greeting_subtext: note.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      navigate(`/rooms/${room.id}/pre`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        // Edge case: the entitlement cache disagreed with the backend
        // (race during Stripe webhook materialisation). Send the user
        // to the paywall.
        toast.message("This room needs an active credit.");
        navigate("/paywall");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not create room.");
    } finally {
      setCreating(false);
    }
  }

  function badgeFor(plan: Plan): string | null {
    if (entitlement === null) return null;
    switch (plan) {
      case "date_pack":
        return entitlement.date_pack_remaining > 0
          ? `${entitlement.date_pack_remaining} left`
          : null;
      case "long_pack":
        return entitlement.long_pack_remaining > 0
          ? `${entitlement.long_pack_remaining} left`
          : null;
      case "together":
        return entitlement.has_active_subscription ? "Active" : null;
      case "try":
        return null;
    }
  }

  function ctaLabel(): string {
    if (!purchaseRequired(selected, entitlement)) return "Create room";
    switch (selected) {
      case "together":
        return "Subscribe & create";
      case "date_pack":
        return "Buy Date Pack & create";
      case "long_pack":
        return "Buy Long Pack & create";
      case "try":
        return "Create room";
    }
  }

  const charsLeft = 240 - note.length;
  return (
    <CardPage
      title="New room"
      onBack={() => navigate("/home")}
      maxWidth="sm:max-w-xl lg:max-w-2xl"
      bodyClassName="space-y-8 animate-float-up"
    >
      <section className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Pick a plan</p>
        <div className="stagger-children space-y-3">
          {PLANS.map((opt) => {
            const active = selected === opt.id;
            const badge = badgeFor(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                aria-pressed={active}
                className={cn(
                  "focus-ring group w-full text-left rounded-[1.5rem] p-5 border transition-all flex items-start gap-4",
                  active
                    ? "border-primary/55 bg-primary/[0.10] ring-1 ring-primary/25 shadow-[0_18px_60px_-22px_rgba(212,130,106,0.45)]"
                    : "editorial-card hover:border-primary/25 hover:-translate-y-0.5 duration-200",
                )}
              >
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ring-1 transition-colors",
                  active ? "bg-primary/15 ring-primary/35" : "bg-primary/[0.08] ring-primary/15",
                )}>
                  {opt.icon}
                </div>
                <div className="min-w-0 pt-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-cream font-medium">{opt.title}</p>
                    {badge && (
                      <span className="rounded-full border border-rosegold/25 bg-rosegold/10 px-2 py-0.5 text-[10px] font-semibold text-rosegold">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
                <span
                  className={cn(
                    "ml-auto mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-all",
                    active
                      ? "border-primary bg-primary shadow-[0_0_0_4px_rgba(212,130,106,0.18)]"
                      : "border-muted-foreground/40 group-hover:border-primary/40",
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Greeting (optional)</p>
        <div className="editorial-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="cr-headline" className="block text-xs text-muted-foreground">
              Headline
            </label>
            <input
              id="cr-headline"
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Tonight's the night"
              maxLength={60}
              className="auth-input focus-ring"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="cr-note" className="block text-xs text-muted-foreground">
                Note
              </label>
              <span className={cn(
                "text-[10px] tabular-nums",
                charsLeft < 20 ? "text-amber" : "text-muted-foreground/60",
              )}>
                {charsLeft}
              </span>
            </div>
            <textarea
              id="cr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A short note for them — what are we doing, what to expect, anything that sets the tone."
              maxLength={240}
              rows={3}
              className="auth-input focus-ring resize-y"
            />
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        className="btn-primary focus-ring w-full flex items-center justify-center gap-2 py-4 rounded-[1.15rem] font-semibold disabled:opacity-50"
      >
        {creating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Working…
          </>
        ) : (
          ctaLabel()
        )}
      </button>
    </CardPage>
  );
}
