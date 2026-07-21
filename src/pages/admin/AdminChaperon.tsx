import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  getChaperonConfig,
  setChaperonConfig,
  type ChaperonConfig,
  type ChaperonProviderInfo,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, string> = {
  mock: "Mock (offline, deterministic)",
  anthropic: "Anthropic (Claude)",
  openai_compat: "OpenAI-compatible (OpenAI / Gemini / self-hosted)",
};

export default function AdminChaperon() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-chaperon-config"],
    queryFn: getChaperonConfig,
  });

  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Sync form to the server state once loaded / after a save.
  useEffect(() => {
    if (data) {
      setProvider(data.provider);
      setModel(data.model);
    }
  }, [data]);

  const providers = data?.providers ?? [];
  const selected = providers.find((p) => p.id === provider);
  const selectedConfigured = selected?.configured ?? false;
  const dirty = data ? provider !== data.provider || model !== data.model : false;

  function pickProvider(p: ChaperonProviderInfo) {
    if (!p.configured) return;
    setProvider(p.id);
    // Prefill the provider's suggested model when switching.
    setModel(p.default_model);
  }

  async function save() {
    if (!selectedConfigured) return;
    setSaving(true);
    try {
      await setChaperonConfig({ provider, model: model.trim() });
      toast.success("Chaperon provider updated.");
      await refetch();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Couldn't update the provider.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-emerald-400" />
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Chaperon AI</h1>
          <p className="text-sm text-slate-400">
            Which model the whisper rail uses. Keys are set in the server env; this
            only picks the active provider.
          </p>
        </div>
      </header>

      <StatsStrip data={data} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Provider
        </h2>
        <ul className="space-y-2">
          {providers.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={!p.configured}
                onClick={() => pickProvider(p)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
                  provider === p.id
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-900/40 hover:bg-slate-900",
                  !p.configured && "cursor-not-allowed opacity-50",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {PROVIDER_LABELS[p.id] ?? p.id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.configured
                      ? p.default_model
                        ? `Suggested model: ${p.default_model}`
                        : "No model needed"
                      : "No API key configured on the server"}
                  </p>
                </div>
                {provider === p.id && (
                  <span className="text-xs font-semibold uppercase text-emerald-400">
                    Selected
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {provider !== "mock" && (
        <section className="space-y-2">
          <label
            htmlFor="chaperon-model"
            className="text-sm font-semibold uppercase tracking-wide text-slate-400"
          >
            Model
          </label>
          <input
            id="chaperon-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={selected?.default_model || "model id"}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <p className="text-xs text-slate-500">
            For Gemini via OpenAI-compat, e.g. <code>gemini-2.0-flash</code> (needs
            CHAPERON_OPENAI_BASE_URL + key in the server env).
          </p>
        </section>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || !selectedConfigured || saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        {dirty && (
          <span className="text-xs text-slate-500">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}

function StatsStrip({ data }: { data: ChaperonConfig }) {
  const s = data.stats;
  const tiles = [
    { label: "Sessions today", value: s.sessions_today },
    { label: "Signals today", value: s.signals_today },
    {
      label: "Thumbs-up",
      value: s.thumbs_up_pct == null ? "—" : `${s.thumbs_up_pct}%`,
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
        >
          <p className="text-xs text-slate-500">{t.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{t.value}</p>
        </div>
      ))}
    </div>
  );
}
