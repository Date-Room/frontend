/**
 * Purchases & gifts: everything a person paid for or was given, newest
 * first, with M-Pesa receipts and any payment still confirming. The same
 * list serves the profile and, read-only, the admin user view.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_LABEL,
  formatMoney,
  formatPaidTotals,
  getPurchaseHistory,
  itemSubline,
  recheckMyPayment,
  type PurchaseHistory as History,
  type PurchaseItem,
} from "@/lib/purchases";
import { cn } from "@/lib/utils";

const TONE: Record<PurchaseItem["status"], string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  gift: "border-primary/30 bg-primary/10 text-primary",
  confirming: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  failed: "border-white/15 bg-white/[0.04] text-muted-foreground",
  waiting: "border-primary/30 bg-primary/10 text-primary",
};

const PREVIEW = 6;

function Row({ item, onCheck, checking }: { item: PurchaseItem; onCheck?: () => void; checking: boolean }) {
  const gift = item.kind === "gift";
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05]">
        {gift ? <Gift className="h-4 w-4 text-primary" aria-hidden /> : <Receipt className="h-4 w-4 text-cream/70" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-body font-medium text-cream">{item.title}</p>
          {item.amount != null && item.currency && (
            <p className={cn("text-body tabular-nums", item.status === "failed" ? "text-muted-foreground line-through" : "text-cream")}>
              {formatMoney(item.amount, item.currency)}
            </p>
          )}
        </div>
        <p className="mt-0.5 text-label text-muted-foreground">{itemSubline(item)}</p>
        {item.detail && <p className="mt-0.5 text-label text-muted-foreground/80">{item.detail}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 text-label font-semibold", TONE[item.status])}>
            {STATUS_LABEL[item.status]}
          </span>
          {item.status === "confirming" && onCheck && (
            <button
              type="button"
              onClick={onCheck}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-0.5 text-label text-cream/90 transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              {checking && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              I've paid, check now
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function PurchaseHistory({
  queryKey = ["purchase-history"],
  fetcher = getPurchaseHistory,
  readOnly = false,
  className,
}: {
  queryKey?: unknown[];
  fetcher?: () => Promise<History>;
  readOnly?: boolean;
  className?: string;
}) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const history = useQuery({ queryKey, queryFn: fetcher });
  const check = useMutation({
    mutationFn: recheckMyPayment,
    onSuccess: (r) => {
      toast.message(
        r.status === "completed"
          ? "Payment confirmed. It's been added."
          : "Not confirmed yet. If you've paid, it'll be added automatically.",
      );
      void qc.invalidateQueries();
    },
    onError: () => toast.error("Couldn't check right now. Try again in a moment."),
  });

  const data = history.data;
  const items = data?.items ?? [];
  const shown = showAll ? items : items.slice(0, PREVIEW);

  return (
    <section className={cn("editorial-card overflow-hidden", className)}>
      <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <p className="text-label font-bold uppercase tracking-[0.22em] text-primary/85">Purchases &amp; gifts</p>
        {data && (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-body">
            <span className="text-muted-foreground">
              Paid <span className="text-cream tabular-nums">{formatPaidTotals(data.paid_totals)}</span>
            </span>
            <span className="text-muted-foreground">
              Gifts <span className="text-cream tabular-nums">{data.gifts}</span>
            </span>
            {data.confirming > 0 && (
              <span className="text-amber-200">{data.confirming} confirming</span>
            )}
          </div>
        )}
      </div>
      <div className="px-5 sm:px-6">
        {history.isLoading && <p className="py-5 text-body text-muted-foreground">Loading…</p>}
        {history.isError && <p className="py-5 text-body text-muted-foreground">Couldn't load your purchases. Refresh to try again.</p>}
        {data && items.length === 0 && (
          <p className="py-5 text-body text-muted-foreground">Nothing here yet. What you buy or get as a gift will show up here.</p>
        )}
        {shown.length > 0 && (
          <ul className="divide-y divide-white/[0.06]">
            {shown.map((item, i) => (
              <Row
                key={`${item.at}-${i}`}
                item={item}
                checking={check.isPending && check.variables === item.transaction_id}
                onCheck={!readOnly && item.transaction_id ? () => check.mutate(item.transaction_id as string) : undefined}
              />
            ))}
          </ul>
        )}
        {items.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mb-4 mt-1 text-label font-semibold text-primary hover:underline"
          >
            {showAll ? "Show less" : `Show all ${items.length}`}
          </button>
        )}
      </div>
    </section>
  );
}
