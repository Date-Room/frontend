import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Sparkles } from "lucide-react";
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
import {
  createPromoCode,
  generatePromoCodes,
  listPromoCodes,
  updatePromoCode,
  type PromoCode,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

type PromoKind = "tier_grant" | "percent_off" | "fixed_off";

type BenefitForm = {
  label: string;
  description: string;
  kind: PromoKind;
  tier_product: string;
  subscription_days: number;
  /** Together/Crew grants are counted rooms (credits), not days. */
  pass_units: number;
  percent_off: number;
  max_redemptions: number;
  max_per_user: number;
};

type GenerateForm = BenefitForm & {
  count: number;
  prefix: string;
  code_length: number;
};

type CustomForm = BenefitForm & {
  code: string;
};

const PRESETS = [
  {
    label: "Launch Together",
    prefix: "TOGETHER",
    kind: "tier_grant" as const,
    tier_product: "together",
    subscription_days: 30,
  },
  {
    label: "Influencer Crew",
    prefix: "CREW",
    kind: "tier_grant" as const,
    tier_product: "crew",
    subscription_days: 90,
  },
  {
    label: "Free Date Pack",
    prefix: "DATE",
    kind: "tier_grant" as const,
    tier_product: "date_pack",
  },
  {
    label: "50% off Date Pack",
    prefix: "HALF",
    kind: "percent_off" as const,
    tier_product: "date_pack",
    percent_off: 50,
  },
] as const;

const DEFAULT_BENEFIT: BenefitForm = {
  label: "",
  description: "",
  kind: "tier_grant",
  tier_product: "together",
  subscription_days: 30,
  pass_units: 1,
  percent_off: 20,
  max_redemptions: 1,
  max_per_user: 1,
};

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
  return err instanceof Error ? err.message : "Request failed";
}

async function copyText(text: string, successMessage: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    toast.error("Nothing to copy.");
    return;
  }
  try {
    await navigator.clipboard.writeText(trimmed);
    toast.success(successMessage);
  } catch {
    toast.error("Could not copy — try selecting the text manually.");
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
      onClick={() => void copyText(code, `Copied ${code.trim()}`)}
      title={label}
      aria-label={label}
      className={cn("admin-copy-btn", className)}
    >
      <Copy className="h-4 w-4" aria-hidden />
    </button>
  );
}

function benefitPayload(form: BenefitForm) {
  return {
    label: form.label.trim(),
    description: form.description.trim() || null,
    kind: form.kind,
    tier_product:
      form.kind === "tier_grant" || form.kind === "percent_off" ? form.tier_product : null,
    percent_off: form.kind === "percent_off" ? form.percent_off : null,
    // Together/Crew grants are counted rooms (credits) now — send pass_units,
    // not subscription_days.
    pass_units:
      form.kind === "tier_grant" &&
      (form.tier_product === "together" || form.tier_product === "crew")
        ? form.pass_units
        : null,
    subscription_days: null,
    max_redemptions: form.max_redemptions,
    max_per_user: form.max_per_user,
  };
}

function BenefitFields({
  form,
  setForm,
  idPrefix,
}: {
  form: BenefitForm;
  setForm: React.Dispatch<React.SetStateAction<BenefitForm>>;
  idPrefix: string;
}) {
  return (
    <>
      <div>
        <Label className="admin-field-label" htmlFor={`${idPrefix}-label`}>
          Campaign label
        </Label>
        <Input
          id={`${idPrefix}-label`}
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="mt-1.5 admin-input"
          placeholder="e.g. Launch week giveaway"
          required
        />
      </div>
      <div>
        <Label className="admin-field-label" htmlFor={`${idPrefix}-kind`}>
          Kind
        </Label>
        <Select
          value={form.kind}
          onValueChange={(v) => setForm({ ...form, kind: v as PromoKind })}
        >
          <SelectTrigger id={`${idPrefix}-kind`} className="mt-1.5 admin-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tier_grant">Instant tier grant</SelectItem>
            <SelectItem value="percent_off">Percent off (pack credit)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="admin-field-label" htmlFor={`${idPrefix}-product`}>
          Product
        </Label>
        <Select
          value={form.tier_product}
          onValueChange={(v) => setForm({ ...form, tier_product: v })}
        >
          <SelectTrigger id={`${idPrefix}-product`} className="mt-1.5 admin-input">
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
        <Label className="admin-field-label" htmlFor={`${idPrefix}-max`}>
          Max redemptions per code
        </Label>
        <Input
          id={`${idPrefix}-max`}
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
            <Label className="admin-field-label" htmlFor={`${idPrefix}-rooms`}>
              Rooms (credits)
            </Label>
            <Input
              id={`${idPrefix}-rooms`}
              type="number"
              min={1}
              max={20}
              value={form.pass_units}
              onChange={(e) =>
                setForm({
                  ...form,
                  pass_units: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                })
              }
              className="mt-1.5 admin-input"
            />
          </div>
        )}
      {form.kind === "percent_off" && (
        <div>
          <Label className="admin-field-label" htmlFor={`${idPrefix}-percent`}>
            Percent off
          </Label>
          <Input
            id={`${idPrefix}-percent`}
            type="number"
            min={1}
            max={100}
            value={form.percent_off}
            onChange={(e) =>
              setForm({
                ...form,
                percent_off: Math.min(100, Math.max(1, Number(e.target.value) || 20)),
              })
            }
            className="mt-1.5 admin-input"
          />
        </div>
      )}
    </>
  );
}

export default function AdminPromoCodes() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-promo"],
    queryFn: listPromoCodes,
  });

  const [generating, setGenerating] = useState(false);
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<PromoCode[]>([]);
  const [generateForm, setGenerateForm] = useState<GenerateForm>({
    ...DEFAULT_BENEFIT,
    count: 10,
    prefix: "",
    code_length: 8,
  });
  const [customForm, setCustomForm] = useState<CustomForm>({
    ...DEFAULT_BENEFIT,
    code: "",
  });

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setGenerateForm((f) => ({
      ...f,
      label: preset.label,
      kind: preset.kind,
      tier_product: preset.tier_product,
      subscription_days: ("subscription_days" in preset ? preset.subscription_days : 30) as number,
      percent_off: ("percent_off" in preset ? preset.percent_off : 20) as number,
      prefix: preset.prefix,
      max_redemptions: 1,
    }));
  }

  async function submitGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generateForm.label.trim().length < 2) {
      toast.error("Campaign label must be at least 2 characters.");
      return;
    }
    if (generateForm.count < 1) {
      toast.error("Generate at least 1 code.");
      return;
    }

    setGenerating(true);
    try {
      const result = await generatePromoCodes({
        count: generateForm.count,
        prefix: generateForm.prefix.trim().toUpperCase(),
        code_length: generateForm.code_length,
        ...benefitPayload(generateForm),
      });
      setGeneratedCodes(result.items);
      toast.success(
        result.items.length === 1
          ? `Generated ${result.items[0].code}`
          : `Generated ${result.items.length} codes`,
      );
      void qc.invalidateQueries({ queryKey: ["admin-promo"] });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    const label = customForm.label.trim();
    if (label.length < 2) {
      toast.error("Label must be at least 2 characters.");
      return;
    }

    setCustomSubmitting(true);
    try {
      const code = customForm.code.trim();
      const created = await createPromoCode({
        ...(code ? { code } : { prefix: "PROMO", code_length: 8 }),
        ...benefitPayload(customForm),
      });
      toast.success(code ? `Created ${created.code}` : `Created ${created.code} (auto-generated)`);
      setCustomForm((f) => ({ ...f, code: "", label: "", description: "" }));
      void qc.invalidateQueries({ queryKey: ["admin-promo"] });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setCustomSubmitting(false);
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

  const generatedCodesText = generatedCodes.map((row) => row.code).join("\n");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">Promo codes</h2>
        <p className="text-slate-400 text-sm mt-1">
          Generate single-use codes in batches, or create a custom code by hand.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="admin-preset-chip"
          >
            {p.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => void submitGenerate(e)}
        className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 space-y-4 max-w-2xl"
      >
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-amber-300" aria-hidden />
          <h3 className="font-medium">Generate codes</h3>
        </div>
        <p className="text-sm text-slate-400">
          The system mints unique codes automatically. Each code is single-use by default.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="admin-field-label" htmlFor="gen-count">
              How many
            </Label>
            <Input
              id="gen-count"
              type="number"
              min={1}
              max={100}
              value={generateForm.count}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  count: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                })
              }
              className="mt-1.5 admin-input"
            />
          </div>
          <div>
            <Label className="admin-field-label" htmlFor="gen-prefix">
              Prefix (optional)
            </Label>
            <Input
              id="gen-prefix"
              value={generateForm.prefix}
              onChange={(e) =>
                setGenerateForm({ ...generateForm, prefix: e.target.value.toUpperCase() })
              }
              className="mt-1.5 admin-input font-mono"
              placeholder="LAUNCH"
              maxLength={12}
            />
          </div>
          <div>
            <Label className="admin-field-label" htmlFor="gen-length">
              Random length
            </Label>
            <Input
              id="gen-length"
              type="number"
              min={4}
              max={16}
              value={generateForm.code_length}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  code_length: Math.min(16, Math.max(4, Number(e.target.value) || 8)),
                })
              }
              className="mt-1.5 admin-input"
            />
          </div>
          <BenefitFields
            form={generateForm}
            setForm={setGenerateForm}
            idPrefix="gen"
          />
        </div>

        <button type="submit" disabled={generating} className="admin-btn-save">
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Generating…
            </>
          ) : (
            `Generate ${generateForm.count} code${generateForm.count === 1 ? "" : "s"}`
          )}
        </button>
      </form>

      {generatedCodes.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-emerald-200">
              Latest batch · {generatedCodes.length} code{generatedCodes.length === 1 ? "" : "s"}
            </h3>
            <button
              type="button"
              onClick={() =>
                void copyText(
                  generatedCodesText,
                  `Copied ${generatedCodes.length} code${generatedCodes.length === 1 ? "" : "s"}`,
                )
              }
              className="admin-preset-chip"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy all
            </button>
          </div>
          <textarea
            readOnly
            value={generatedCodesText}
            rows={Math.min(8, Math.max(3, generatedCodes.length))}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 font-mono text-sm text-slate-200"
          />
        </div>
      )}

      <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 max-w-2xl">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          Custom code (manual)
        </summary>
        <form onSubmit={(e) => void submitCustom(e)} className="mt-4 grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="admin-field-label" htmlFor="custom-code">
              Code
            </Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="custom-code"
                value={customForm.code}
                onChange={(e) =>
                  setCustomForm({ ...customForm, code: e.target.value.toUpperCase() })
                }
                className={cn("admin-input font-mono admin-code-text flex-1")}
                placeholder="Leave blank to auto-generate"
              />
              <CopyCodeButton code={customForm.code} label="Copy code from field" />
            </div>
          </div>
          <BenefitFields
            form={customForm}
            setForm={setCustomForm}
            idPrefix="custom"
          />
          <div className="sm:col-span-2">
            <button type="submit" disabled={customSubmitting} className="admin-btn-save">
              {customSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save custom code"
              )}
            </button>
          </div>
        </form>
      </details>

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
                  No promo codes yet — generate a batch above.
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
