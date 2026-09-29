/**
 * /squad: the "Request access" page behind the public Squad (beta) slot.
 *
 * Squad rooms open to a few friend groups first. A signed-in person answers
 * three short questions (city, how many of you, what you'd do) and waits for
 * the team to let the group in from the admin queue. Once granted, this page
 * says so; the room itself ships later behind the same gate.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, MapPin, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { ApiError } from "@/lib/api";
import {
  SQUAD_GROUP_SIZES,
  SQUAD_PLAN_OPTIONS,
  applySquadBeta,
  canSendSquadRequest,
  getSquadBeta,
  toggleSquadPlan,
  type SquadBetaRequest,
  type SquadBetaState,
} from "@/lib/squad";
import { cn } from "@/lib/utils";

const EMPTY: SquadBetaRequest = { city: "", group_size: 4, plans: [], note: "" };

export default function SquadRequest() {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ["squad-beta"], queryFn: getSquadBeta });
  const [editing, setEditing] = useState(false);

  const status = state.data?.status;
  const showForm = status === "none" || editing;

  return (
    <PageShell className="px-5 pb-16 pt-8 sm:px-6">
      <div className="mx-auto max-w-lg">
        <Link
          to="/home"
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Home
        </Link>

        <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-primary/85">Squad · Beta</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight text-cream">
          A room for your people
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Film nights, game nights and long catch-ups for 2 to 5 friends, wherever each of you is.
          We&apos;re opening it to a few groups first.
        </p>

        <div className="mt-10">
          {state.isLoading && (
            <div className="editorial-card flex items-center justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          )}
          {state.isError && (
            <p className="editorial-card p-6 text-sm text-muted-foreground">
              We couldn&apos;t load your request just now. Refresh to try again.
            </p>
          )}
          {state.data && showForm && (
            <RequestForm
              initial={state.data}
              onSent={(next) => {
                qc.setQueryData(["squad-beta"], next);
                setEditing(false);
              }}
            />
          )}
          {state.data && !showForm && <StatusCard state={state.data} onEdit={() => setEditing(true)} />}
        </div>
      </div>
    </PageShell>
  );
}

function StatusCard({ state, onEdit }: { state: SquadBetaState; onEdit: () => void }) {
  if (state.status === "granted") {
    return (
      <div className="editorial-card space-y-3 p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
          <Check className="h-5 w-5 text-primary" aria-hidden />
        </span>
        <h2 className="font-serif text-2xl text-cream">You&apos;re in</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your squad is part of the beta. Open your room and your first night is on us.
        </p>
        <Link to="/squad/new" className="btn-primary focus-ring inline-block rounded-full px-5 py-2.5 text-sm font-semibold">
          Open your squad room
        </Link>
      </div>
    );
  }
  if (state.status === "declined") {
    return (
      <div className="editorial-card space-y-3 p-6">
        <h2 className="font-serif text-2xl text-cream">Not this round</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We&apos;re keeping the first beta small. You&apos;re welcome to ask again, and we&apos;ll
          look at it next time we open places.
        </p>
        <button type="button" onClick={onEdit} className="btn-primary focus-ring rounded-full px-5 py-2.5 text-sm font-semibold">
          Ask again
        </button>
      </div>
    );
  }
  // pending
  const plans = SQUAD_PLAN_OPTIONS.filter((o) => state.plans.includes(o.id)).map((o) => o.label.toLowerCase());
  return (
    <div className="editorial-card space-y-4 p-6">
      <h2 className="font-serif text-2xl text-cream">You&apos;re on the list</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We pick a spread of groups by hand. If yours is picked, you&apos;ll get an email and this page
        will say you&apos;re in.
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-white/[0.03] p-3">
          <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Where</dt>
          <dd className="mt-1 text-cream">{state.city}</dd>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">How many</dt>
          <dd className="mt-1 text-cream">{state.group_size} of you</dd>
        </div>
        {plans.length > 0 && (
          <div className="col-span-2 rounded-xl bg-white/[0.03] p-3">
            <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">For</dt>
            <dd className="mt-1 text-cream">{plans.join(", ")}</dd>
          </div>
        )}
      </dl>
      <button type="button" onClick={onEdit} className="focus-ring rounded-lg text-sm text-primary hover:underline">
        Change my answers
      </button>
    </div>
  );
}

function RequestForm({ initial, onSent }: { initial: SquadBetaState; onSent: (s: SquadBetaState) => void }) {
  const [form, setForm] = useState<SquadBetaRequest>(EMPTY);

  // Editing a pending request starts from what was sent.
  useEffect(() => {
    if (initial.status === "pending") {
      setForm({
        city: initial.city ?? "",
        group_size: initial.group_size ?? EMPTY.group_size,
        plans: initial.plans,
        note: "",
      });
    }
  }, [initial]);

  const send = useMutation({
    mutationFn: () => applySquadBeta({ ...form, city: form.city.trim(), note: form.note.trim() }),
    onSuccess: onSent,
  });
  const error =
    send.error instanceof ApiError && send.error.status === 422
      ? "Something in the form didn't look right. Check your answers and try again."
      : send.error
        ? "We couldn't send that. Check your connection and try again."
        : null;

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSendSquadRequest(form)) send.mutate();
      }}
    >
      <section className="space-y-1.5">
        <label
          htmlFor="squad-city"
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
        >
          <MapPin className="h-3 w-3" aria-hidden /> Your city
        </label>
        <input
          id="squad-city"
          type="text"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="Nairobi, Lagos, Casablanca, Houston..."
          maxLength={80}
          autoComplete="address-level2"
          className="auth-input focus-ring"
          required
        />
      </section>

      <fieldset className="space-y-2.5">
        <legend className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          <Users className="h-3 w-3" aria-hidden /> How many of you, you included
        </legend>
        <div className="grid grid-cols-4 gap-2.5">
          {SQUAD_GROUP_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={form.group_size === n}
              onClick={() => setForm({ ...form, group_size: n })}
              className={cn(
                "focus-ring h-14 rounded-2xl border text-lg font-semibold transition-colors",
                form.group_size === n
                  ? "border-primary/60 bg-primary/15 text-cream"
                  : "border-white/[0.08] bg-card/30 text-cream/80 hover:border-primary/25",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2.5">
        <legend className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          What would you do together?
        </legend>
        <div className="flex flex-wrap gap-2">
          {SQUAD_PLAN_OPTIONS.map((o) => {
            const on = form.plans.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => setForm({ ...form, plans: toggleSquadPlan(form.plans, o.id) })}
                className={cn(
                  "focus-ring min-h-[44px] rounded-full border px-4 text-sm transition-colors",
                  on
                    ? "border-primary/60 bg-primary/15 text-cream"
                    : "border-white/[0.08] bg-card/30 text-cream/80 hover:border-primary/25",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <section className="space-y-1.5">
        <label htmlFor="squad-note" className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          Anything else? <span className="normal-case tracking-normal text-muted-foreground/70">(optional)</span>
        </label>
        <textarea
          id="squad-note"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Where are the others? How often do you get together?"
          maxLength={500}
          rows={3}
          className="auth-input focus-ring resize-none"
        />
      </section>

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSendSquadRequest(form) || send.isPending}
        className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-4 font-semibold disabled:opacity-40"
      >
        {send.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {initial.status === "pending" ? "Update my request" : "Request access"}
      </button>
    </form>
  );
}
