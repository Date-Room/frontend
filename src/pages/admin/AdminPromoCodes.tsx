import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { createPromoCode, listPromoCodes, updatePromoCode, type PromoCode } from "@/lib/admin";
import { cn } from "@/lib/utils";

const PRESETS = [
  {
    label: "Launch Together",
    code: "TOGETHER30",
    kind: "tier_grant",
    tier_product: "together",
    subscription_days: 30,
  },
  {
    label: "Influencer Crew",
    code: "CREW90",
    kind: "tier_grant",
    tier_product: "crew",
    subscription_days: 90,
  },
  {
    label: "Free Date Pack",
    code: "DATENIGHT",
    kind: "tier_grant",
    tier_product: "date_pack",
  },
  {
    label: "50% off Date Pack",
    code: "HALFOFF",
    kind: "percent_off",
    tier_product: "date_pack",
    percent_off: 50,
  },
] as const;

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const detail = err.body && typeof err.body === "object" && "detail" in err.body
      ? (err.body as { detail: unknown }).detail
      : null;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item === "object" && item && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : String(item),
        )
        .join("; ");
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Create failed";
}

async function copyPromoCode(code: string) {
  const trimmed = code.trim();
  if (!trimmed) {
    toast.error("Enter a code first.");
    return;
  }
  try {
    await navigator.clipboard.writeText(trimmed);
    toast.success(`Copied ${trimmed}`);
  } catch {
    toast.error("Could not copy — try selecting the code manually.");
  }
}

function CopyCodeButton({
  code,
  label = "Copy code",
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void copyPromoCode(code)}
      title={label}
      aria-label={label}
      className={cn(
        "admin-copy-btn",
        className,
      )}
    >
      <Copy className="h-4 w-4" aria-hidden />
    </button>
  );
}

export default function AdminPromoCodes() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-promo"],
    queryFn: listPromoCodes,
  });

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: "",
    label: "",
    description: "",
    kind: "tier_grant" as "tier_grant" | "percent_off" | "fixed_off",
    tier_product: "together" as string,
    subscription_days: 30,
    percent_off: 20,
    max_redemptions: 100,
    max_per_user: 1,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim();
    const label = form.label.trim();
    if (code.length < 3) {
      toast.error("Code must be at least 3 characters.");
      return;
    }
    if (label.length < 2) {
      toast.error("Label must be at least 2 characters.");
      return;
    }
    if (form.max_redemptions < 1) {
      toast.error("Max redemptions must be at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      await createPromoCode({
        code,
        label,
        description: form.description.trim() || null,
        kind: form.kind,
        tier_product:
          form.kind === "tier_grant" || form.kind === "percent_off" ? form.tier_product : null,
        percent_off: form.kind === "percent_off" ? form.percent_off : null,
        subscription_days:
          form.kind === "tier_grant" &&
          (form.tier_product === "together" || form.tier_product === "crew")
            ? form.subscription_days
            : null,
        max_redemptions: form.max_redemptions,
        max_per_user: form.max_per_user,
      });
      toast.success("Promo code created");
      setForm((f) => ({ ...f, code: "", label: "", description: "" }));
      void qc.invalidateQueries({ queryKey: ["admin-promo"] });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: PromoCode) {
    try {
      await updatePromoCode(row.id, { is_active: !row.is_active });
      void qc.invalidateQueries({ queryKey: ["admin-promo"] });
    } catch {
      toast.error("Update failed");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">Promo codes</h2>
        <p className="text-slate-400 text-sm mt-1">
          Coupons users redeem in Settings — tier grants apply instantly.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.code}
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                code: p.code,
                label: p.label,
                kind: p.kind as typeof f.kind,
                tier_product: ("tier_product" in p ? p.tier_product : f.tier_product) as string,
                subscription_days: ("subscription_days" in p ? p.subscription_days : 30) as number,
                percent_off: ("percent_off" in p ? p.percent_off : 20) as number,
              }))
            }
            className="admin-preset-chip"
          >
            {p.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 grid sm:grid-cols-2 gap-4 max-w-2xl"
      >
        <div>
          <Label className="admin-field-label">Code</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={cn("admin-input font-mono admin-code-text flex-1")}
              required
            />
            <CopyCodeButton code={form.code} label="Copy code from field" />
          </div>
        </div>
        <div>
          <Label className="admin-field-label">Label</Label>
          <Input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="mt-1.5 admin-input"
            required
          />
        </div>
        <div>
          <Label className="admin-field-label">Kind</Label>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as typeof form.kind })}>
            <SelectTrigger className="mt-1.5 admin-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tier_grant">Instant tier grant</SelectItem>
              <SelectItem value="percent_off">Percent off (pack credit)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="admin-field-label">Product</Label>
          <Select
            value={form.tier_product}
            onValueChange={(v) => setForm({ ...form, tier_product: v })}
          >
            <SelectTrigger className="mt-1.5 admin-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_pack">Date Pack</SelectItem>
              <SelectItem value="long_pack">Long Pack</SelectItem>
              <SelectItem value="together">Together</SelectItem>
              <SelectItem value="crew">Crew</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="admin-field-label">Max redemptions</Label>
          <Input
            type="number"
            min={1}
            value={form.max_redemptions}
            onChange={(e) =>
              setForm({ ...form, max_redemptions: Math.max(1, Number(e.target.value) || 1) })
            }
            className="mt-1.5 admin-input"
          />
        </div>
        {(form.tier_product === "together" || form.tier_product === "crew") &&
          form.kind === "tier_grant" && (
            <div>
              <Label className="admin-field-label">Subscription days</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.subscription_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    subscription_days: Math.min(365, Math.max(1, Number(e.target.value) || 30)),
                  })
                }
                className="mt-1.5 admin-input"
              />
            </div>
          )}
        <div className="sm:col-span-2 pt-2">
          <button type="submit" disabled={submitting} className="admin-btn-save">
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save promo code"
            )}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Benefit</th>
              <th className="px-4 py-3">Used</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No promo codes yet — create one above.
                </td>
              </tr>
            )}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <p className="admin-code-text">{row.code}</p>
                      <p className="text-xs text-slate-400">{row.label}</p>
                    </div>
                    <CopyCodeButton code={row.code} label={`Copy ${row.code}`} className="mt-0.5" />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {row.kind}
                  {row.tier_product && ` → ${row.tier_product}`}
                  {row.percent_off && ` (${row.percent_off}%)`}
                </td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">
                  {row.redemption_count}
                  {row.max_redemptions != null && ` / ${row.max_redemptions}`}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void toggleActive(row)}
                    className={cn(
                      "text-xs uppercase tracking-wider",
                      row.is_active ? "text-emerald-400" : "text-slate-500",
                    )}
                  >
                    {row.is_active ? "Active" : "Paused"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
