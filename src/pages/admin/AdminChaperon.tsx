import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Minus, Plus, ShieldCheck, Sparkles, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  COACH_BETA_MAX_GRANT,
  getChaperonConfig,
  getProtectConfig,
  getSttConfig,
  grantCoachBeta,
  listCoachBetaApplications,
  setChaperonConfig,
  setProtectMetering,
  setSttConfig,
  testChaperonProvider,
  testSttProvider,
  type ChaperonConfig,
  type ChaperonProviderInfo,
  type ChaperonTestResult,
  type CoachBetaApplication,
  type SttTestResult,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, string> = {
  mock: "Mock (offline, deterministic)",
  anthropic: "Anthropic (Claude)",
  gemini: "Gemini (Google)",
  openai: "OpenAI",
  openai_compat: "OpenAI-compatible (self-hosted / custom)",
};

const STT_LABELS: Record<string, string> = {
  mock: "Mock (offline, deterministic)",
  deepgram: "Deepgram (Nova-3)",
  assemblyai: "AssemblyAI (Universal-Streaming)",
};

const CUSTOM_MODEL = "__custom__";

export default function AdminChaperon() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-chaperon-config"],
    queryFn: getChaperonConfig,
  });

  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ChaperonTestResult | null>(null);

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
    setTestResult(null);
  }

  const knownModels = selected?.models ?? [];
  const isCustomModel = model !== "" && !knownModels.includes(model);

  async function test() {
    if (!selectedConfigured) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testChaperonProvider({ provider, model: model.trim() });
      setTestResult(res);
    } catch (e) {
      setTestResult({
        ok: false,
        error: e instanceof ApiError ? e.message : "Test failed.",
        latency_ms: null,
        signals: 0,
        sample_whisper: null,
      });
    } finally {
      setTesting(false);
    }
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
          {knownModels.length > 0 ? (
            <select
              id="chaperon-model"
              value={isCustomModel ? CUSTOM_MODEL : model}
              onChange={(e) => {
                const v = e.target.value;
                setModel(v === CUSTOM_MODEL ? "" : v);
                setTestResult(null);
              }}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
            >
              {knownModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={CUSTOM_MODEL}>Custom…</option>
            </select>
          ) : null}
          {(knownModels.length === 0 || isCustomModel) && (
            <input
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setTestResult(null);
              }}
              placeholder={selected?.default_model || "model id"}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
            />
          )}
          {provider === "openai_compat" && (
            <p className="text-xs text-slate-500">
              Custom endpoint — set <code>CHAPERON_OPENAI_BASE_URL</code> + key in the
              server env.
            </p>
          )}
        </section>
      )}

      {/* Verify the provider actually responds (not just "key present"). */}
      {selectedConfigured && (
        <section className="space-y-2">
          <button
            type="button"
            disabled={testing}
            onClick={() => void test()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Test provider
          </button>
          {testResult && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
                testResult.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200",
              )}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                {testResult.ok ? (
                  <>
                    <p>
                      Responded in {testResult.latency_ms}ms · {testResult.signals} signal
                      {testResult.signals === 1 ? "" : "s"}.
                    </p>
                    {testResult.sample_whisper && (
                      <p className="mt-0.5 text-xs text-emerald-300/80">
                        e.g. "{testResult.sample_whisper}"
                      </p>
                    )}
                  </>
                ) : (
                  <p className="break-words">{testResult.error}</p>
                )}
              </div>
            </div>
          )}
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
        {dirty && <span className="text-xs text-slate-500">Unsaved changes</span>}
      </div>

      <SttSection />
      <ProtectMeteringSection />
      <CoachBetaSection />
    </div>
  );
}

/** Protect is free for everyone until this is switched on. When on, each
 *  account gets one free Protect date, then needs credits (admin-granted per
 *  user on the Users page, paid later). */
function ProtectMeteringSection() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-protect-config"],
    queryFn: getProtectConfig,
  });
  const [saving, setSaving] = useState(false);

  if (isLoading || !data) return null;

  async function toggle(enabled: boolean) {
    setSaving(true);
    try {
      await setProtectMetering(enabled);
      toast.success(enabled ? "Protect metering on." : "Protect metering off — free for all.");
      await refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't update metering.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-slate-800 pt-8">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-400" />
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Protect metering
          </h2>
          <p className="text-xs text-slate-500">
            Off = Protect is free on every date. On = one free date per account, then
            credits (grant per user on the Users page). Leave off until STT cost is live.
          </p>
        </div>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={data.metering_enabled}
            disabled={saving}
            onChange={(e) => void toggle(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          <span className="text-sm text-slate-200">
            {data.metering_enabled ? "Metered" : "Free for all"}
          </span>
        </label>
      </header>
    </section>
  );
}

/** Which speech-to-text vendor transcribes calls. Same shape as the AI
 *  provider picker: pick the active vendor, Test that its key really works.
 *  Keys are env-only; the live audio pipeline plugs into this choice. */
function SttSection() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-stt-config"],
    queryFn: getSttConfig,
  });
  const [provider, setProvider] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SttTestResult | null>(null);

  useEffect(() => {
    if (data) setProvider(data.provider);
  }, [data]);

  if (isLoading || !data) return null;

  const providers = data.providers;
  const selected = providers.find((p) => p.id === provider);
  const configured = selected?.configured ?? false;
  const dirty = provider !== data.provider;

  async function test() {
    if (!configured) return;
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testSttProvider({ provider }));
    } catch (e) {
      setTestResult({
        ok: false,
        error: e instanceof ApiError ? e.message : "Test failed.",
        latency_ms: null,
        sample_transcript: null,
      });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!configured) return;
    setSaving(true);
    try {
      await setSttConfig({ provider });
      toast.success("STT vendor updated.");
      await refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't update the vendor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-slate-800 pt-8">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Speech-to-text
        </h2>
        <p className="text-xs text-slate-500">
          Which vendor transcribes the call audio. Keys are set in the server env;
          this only picks the active vendor. (The live audio pipeline is a separate
          build — this switch is ready for it.)
        </p>
      </header>

      <ul className="space-y-2">
        {providers.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={!p.configured}
              onClick={() => {
                if (!p.configured) return;
                setProvider(p.id);
                setTestResult(null);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
                provider === p.id
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-900/40 hover:bg-slate-900",
                !p.configured && "cursor-not-allowed opacity-50",
              )}
            >
              <div>
                <p className="text-sm font-medium text-slate-100">{STT_LABELS[p.id] ?? p.id}</p>
                <p className="text-xs text-slate-500">
                  {p.configured ? "Key configured" : "No API key configured on the server"}
                </p>
              </div>
              {provider === p.id && (
                <span className="text-xs font-semibold uppercase text-emerald-400">Selected</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {configured && (
        <div className="space-y-2">
          <button
            type="button"
            disabled={testing}
            onClick={() => void test()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Test vendor
          </button>
          {testResult && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
                testResult.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200",
              )}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                {testResult.ok ? (
                  <>
                    <p>Transcribed a sample in {testResult.latency_ms}ms.</p>
                    {testResult.sample_transcript && (
                      <p className="mt-0.5 text-xs text-emerald-300/80">
                        e.g. "{testResult.sample_transcript}"
                      </p>
                    )}
                  </>
                ) : (
                  <p className="break-words">{testResult.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || !configured || saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        {dirty && <span className="text-xs text-slate-500">Unsaved changes</span>}
      </div>
    </section>
  );
}

/** Coach is a gated beta: users apply, an admin grants a small quota of
 *  Coach-active date sessions. Protect stays free and never appears here. */
function CoachBetaSection() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-coach-beta-applications"],
    queryFn: listCoachBetaApplications,
  });

  return (
    <section className="space-y-3 border-t border-slate-800 pt-8">
      <header className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-400" />
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Coach beta — applications
          </h2>
          <p className="text-xs text-slate-500">
            Grant a small quota of Coach date sessions. One call is spent per date;
            Protect is always free and never listed here.
          </p>
        </div>
        {data && data.pending_count > 0 && (
          <span className="ml-auto rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
            {data.pending_count} pending
          </span>
        )}
      </header>

      {isLoading || !data ? (
        <div className="flex h-24 items-center justify-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : data.items.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
          No pending applications.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((app) => (
            <CoachBetaApplicationRow
              key={app.id}
              app={app}
              onGranted={() => void refetch()}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CoachBetaApplicationRow({
  app,
  onGranted,
}: {
  app: CoachBetaApplication;
  onGranted: () => void;
}) {
  const [calls, setCalls] = useState(1);
  const [granting, setGranting] = useState(false);

  async function grant() {
    setGranting(true);
    try {
      const res = await grantCoachBeta({ user_id: app.user_id, calls });
      toast.success(
        `Granted ${calls} call${calls === 1 ? "" : "s"} to ${app.display_name || app.email} (now ${res.calls_remaining}).`,
      );
      onGranted();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't grant Coach beta.");
    } finally {
      setGranting(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">
          {app.display_name || "—"}{" "}
          <span className="font-normal text-slate-500">· {app.email}</span>
        </p>
        {app.reason && (
          <p className="mt-0.5 text-xs italic text-slate-400">“{app.reason}”</p>
        )}
        <p className="mt-0.5 text-[11px] text-slate-600">
          Applied {new Date(app.created_at).toLocaleDateString()} · has{" "}
          {app.calls_remaining} call{app.calls_remaining === 1 ? "" : "s"} now
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Stepper value={calls} onChange={setCalls} min={1} max={COACH_BETA_MAX_GRANT} />
        <button
          type="button"
          disabled={granting}
          onClick={() => void grant()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
        >
          {granting && <Loader2 className="h-4 w-4 animate-spin" />}
          Grant
        </button>
      </div>
    </li>
  );
}

/** A +/- stepper — no free text, so a slip can't grant a thousand sessions. */
function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900">
      <button
        type="button"
        aria-label="Fewer calls"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="p-2 text-slate-300 transition hover:text-white disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums text-slate-100">
        {value}
      </span>
      <button
        type="button"
        aria-label="More calls"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="p-2 text-slate-300 transition hover:text-white disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
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
