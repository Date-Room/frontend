/**
 * M-Pesa payments that automatic recovery couldn't settle. Two views of the
 * same problem: our orders still waiting on an answer, and money on the
 * PokeaPay statement that no order holds. Crediting is always a person's
 * call, against a real receipt, and is audited server-side.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  creditPayment,
  listRecentPayments,
  listStuckPayments,
  listUnmatchedPayments,
  recheckPayment,
  type StuckPayment,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

/** Pure: a person-facing label for a payment's status. */
export function paymentStatusLabel(status: string): string {
  if (status === "completed") return "Received";
  if (status === "failed") return "Didn't go through";
  return "Confirming";
}

const PAYMENT_TONE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-white/[0.08] text-cream/60",
  pending: "bg-amber-400/15 text-amber-200",
  unconfirmed: "bg-rose-500/15 text-rose-300",
};

/** Pure: a short human status for a stuck order. */
export function stuckLabel(row: Pick<StuckPayment, "status" | "result_description">): string {
  if (row.status === "unconfirmed") return "No answer in 72h";
  if (row.status === "failed") return "Failed by the old 1-hour cut-off";
  return "Waiting on M-Pesa";
}

const TONE: Record<string, string> = {
  unconfirmed: "bg-rose-500/15 text-rose-300",
  failed: "bg-fuchsia-500/15 text-fuchsia-300",
  pending: "bg-white/[0.08] text-cream/70",
};

const small = "rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50";
const btn = cn(small, "border-white/[0.14] bg-card text-cream/80 hover:bg-white/[0.08]");
const btnPrimary = cn(small, "border-primary/60 bg-primary/[0.12] text-primary hover:bg-primary/20");

const when = (iso: string) => new Date(iso).toLocaleString();
const money = (amount: number, currency = "KES") => `${currency} ${amount.toLocaleString()}`;

function CreditForm({ id, initial, onDone }: { id: string; initial?: string; onDone: () => void }) {
  const [receipt, setReceipt] = useState(initial ?? "");
  const credit = useMutation({
    mutationFn: () => creditPayment(id, receipt.trim()),
    onSuccess: () => {
      toast.success("Credited. The customer has what they paid for.");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't credit."),
  });
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        credit.mutate();
      }}
    >
      <input
        value={receipt}
        onChange={(e) => setReceipt(e.target.value.toUpperCase())}
        placeholder="M-Pesa receipt"
        aria-label="M-Pesa receipt"
        className="h-7 w-32 rounded-full border border-white/[0.14] bg-black/30 px-3 font-mono text-xs text-cream placeholder:text-muted-foreground/50"
      />
      <button type="submit" className={btnPrimary} disabled={receipt.trim().length < 8 || credit.isPending}>
        {credit.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Credit"}
      </button>
    </form>
  );
}

export default function AdminPayments() {
  const qc = useQueryClient();
  const [days, setDays] = useState(7);
  const [recentDays, setRecentDays] = useState(7);
  const recent = useQuery({
    queryKey: ["admin-payments-recent", recentDays],
    queryFn: () => listRecentPayments(recentDays),
  });
  const stuck = useQuery({ queryKey: ["admin-payments-stuck"], queryFn: listStuckPayments });
  const unmatched = useQuery({
    queryKey: ["admin-payments-unmatched", days],
    queryFn: () => listUnmatchedPayments(days),
    retry: false,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-payments-stuck"] });
    void qc.invalidateQueries({ queryKey: ["admin-payments-unmatched"] });
    void qc.invalidateQueries({ queryKey: ["admin-payments-recent"] });
  };
  const recheck = useMutation({
    mutationFn: recheckPayment,
    onSuccess: (r) => {
      toast.message(
        r.outcome === "completed"
          ? "PokeaPay confirms it was paid. Granted."
          : r.outcome === "failed"
            ? "PokeaPay says it wasn't paid."
            : "PokeaPay has no answer for it yet.",
      );
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't reach PokeaPay."),
  });

  const rows = stuck.data?.rows ?? [];
  const credits = unmatched.data?.credits ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-cream">Payments</h2>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Every M-Pesa payment, and the few automatic recovery couldn't settle. Re-check asks PokeaPay; Credit grants
          against a receipt from the PokeaPay statement. Every action is in the audit log.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-cream">Recent payments</h3>
            {recent.data && (
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                Received{" "}
                <span className="tabular-nums text-cream">
                  {recent.data.received.length
                    ? recent.data.received.map((t) => money(t.amount, t.currency)).join(" · ")
                    : "nothing yet"}
                </span>{" "}
                · {recent.data.completed} received · {recent.data.confirming} confirming · {recent.data.failed} didn't go
                through
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 7, 31].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRecentDays(d)}
                className={cn(small, d === recentDays ? "border-primary/60 bg-primary/[0.12] text-primary" : "border-white/[0.14] bg-card text-cream/80 hover:bg-white/[0.08]")}
              >
                {d === 1 ? "Today" : `${d} days`}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-left text-muted-foreground/70">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground/70">Loading…</td></tr>
              )}
              {recent.data && recent.data.rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground/70">No M-Pesa payments in this window.</td></tr>
              )}
              {recent.data?.rows.map((p) => (
                <tr key={p.id} className="border-t border-white/[0.08]">
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground/70">{when(p.at)}</td>
                  <td className="px-4 py-3 text-xs text-cream/90">
                    {p.customer}
                    <span className="ml-1.5 font-mono text-muted-foreground/60">{p.phone_hint}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-cream/90">
                    {p.product}
                    {p.room_name && <span className="text-muted-foreground/70"> · {p.room_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">{money(p.amount, p.currency)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.mpesa_receipt ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      title={p.status === "failed" ? p.result_description ?? undefined : undefined}
                      className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PAYMENT_TONE[p.status] ?? PAYMENT_TONE.pending)}
                    >
                      {paymentStatusLabel(p.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-cream">Orders waiting on an answer</h3>
        <div className="overflow-hidden rounded-xl border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-left text-muted-foreground/70">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {stuck.isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground/70">Loading…</td></tr>
              )}
              {!stuck.isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground/70">Nothing stuck. Every M-Pesa order has an answer.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.08] align-middle">
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground/70">{when(row.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-cream/90">{row.product_kind}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">{money(row.amount, row.currency)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.phone_hint}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[row.status] ?? TONE.pending)}>
                      {stuckLabel(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className={btn}
                        disabled={recheck.isPending && recheck.variables === row.id}
                        onClick={() => recheck.mutate(row.id)}
                      >
                        Re-check
                      </button>
                      <CreditForm id={row.id} onDone={refresh} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-cream">Money with no order</h3>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              On the PokeaPay statement, but on no completed order. Likely orders are listed beside each one.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[3, 7, 31].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(small, d === days ? "border-primary/60 bg-primary/[0.12] text-primary" : "border-white/[0.14] bg-card text-cream/80 hover:bg-white/[0.08]")}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {unmatched.isError && (
          <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs text-amber-200/90">
            Couldn't read the PokeaPay statement: {unmatched.error instanceof Error ? unmatched.error.message : "unknown error"}
          </p>
        )}
        {unmatched.isLoading && <p className="text-xs text-muted-foreground/70">Reading the statement…</p>}
        {unmatched.isSuccess && credits.length === 0 && (
          <p className="rounded-xl border border-white/[0.08] px-4 py-6 text-center text-sm text-muted-foreground/70">
            Every payment on the statement belongs to a completed order.
          </p>
        )}
        <div className="space-y-3">
          {credits.map((c) => (
            <div key={c.receipt} className="rounded-xl border border-white/[0.08] bg-card/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-sm text-cream">{c.receipt}</p>
                <p className="text-sm tabular-nums text-cream">{money(c.amount)}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {when(c.at)} · phone {c.phone_hint || "unknown"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
              {c.candidates.length === 0 ? (
                <p className="mt-3 text-xs text-amber-200/80">No likely order. Possibly not a DateRoom payment; check before refunding.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {c.candidates.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs">
                      <span className="text-cream/90">
                        {o.product_kind} · {when(o.created_at)} · phone {o.phone_hint}
                        {o.phone_hint === c.phone_hint && <span className="ml-2 text-emerald-300">same phone</span>}
                      </span>
                      <CreditForm id={o.id} initial={c.receipt} onDone={refresh} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
