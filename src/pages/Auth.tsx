import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ChevronLeft, MailCheck } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { authClient, authConfigured } from "@/lib/authClient";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";

const REDIRECT_KEY = "post_auth_redirect";

/** Where to land after auth completes. Validated to be a same-origin path. */
function intendedRedirect(params: URLSearchParams): string {
  const next = params.get("redirect");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

/**
 * Two-stage sign-in: enter email → request OTP → enter 6-digit code from
 * the email → done. The same email also contains a same-device magic
 * link (handled by AuthCallback.tsx). Cross-device users (open the email
 * on a phone instead of this browser) fall back to the code path here.
 */
export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!authConfigured()) {
      toast.error("Sign-in isn't configured yet (missing API URL).");
      return;
    }
    setLoading(true);
    try {
      sessionStorage.setItem(REDIRECT_KEY, intendedRedirect(searchParams));
    } catch {
      /* ignore */
    }
    try {
      await authClient.requestOtp(email.trim());
      setStep("code");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await authClient.verifyOtp(email.trim(), code);
      // Where to land — same as AuthCallback.
      let dest = "/home";
      try {
        const stashed = sessionStorage.getItem(REDIRECT_KEY);
        if (stashed && stashed.startsWith("/") && !stashed.startsWith("//")) dest = stashed;
        sessionStorage.removeItem(REDIRECT_KEY);
      } catch {
        /* ignore */
      }
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Code is incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell className="flex items-center justify-center px-6 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="/lobby-hero.png"
          alt=""
          className="w-full h-full object-cover opacity-30 scale-110 blur-sm"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/80 to-transparent" />
      </div>

      <Link
        to="/"
        className="fixed z-30 top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] sm:top-8 sm:left-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-background/70 px-4 py-2.5 text-sm font-medium text-cream shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors hover:border-white/35 hover:bg-background/85 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosegold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background group"
      >
        <ChevronLeft
          className="h-4 w-4 shrink-0 text-rosegold group-hover:-translate-x-0.5 transition-transform"
          aria-hidden
        />
        <span className="tracking-wide">Back to site</span>
      </Link>

      <div className="relative z-10 w-full max-w-lg animate-fade-in sm:max-w-xl">
        <div className="grain card-shadow rounded-[2rem] px-8 py-7 glass-strong sm:rounded-[2.25rem] sm:px-10 sm:py-8">
          <div className="mb-4 flex justify-center sm:mb-5">
            <div className="h-2 w-2 animate-pulse-glow rounded-full bg-rosegold" />
          </div>

          {step === "code" ? (
            <div className="space-y-5">
              <div className="text-center space-y-1.5">
                <MailCheck className="mx-auto h-10 w-10 text-rosegold" aria-hidden />
                <h1 className="font-serif text-3xl italic leading-tight tracking-tight text-cream">
                  Check your email
                </h1>
                <p className="mx-auto max-w-md text-sm font-light leading-relaxed text-muted-foreground">
                  We sent a 6-digit code to <span className="text-cream">{email.trim()}</span>.
                  Type it below — or tap the link in the email if you're on this device.
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="auth-code" className="block text-sm text-muted-foreground/90">
                    6-digit code
                  </label>
                  <input
                    id="auth-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="auth-input tracking-[0.5em] text-center text-lg"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="btn-primary mt-1 flex w-full items-center justify-center gap-3 rounded-xl py-4 font-semibold text-primary-foreground shadow-[0_12px_40px_rgba(212,130,106,0.22)] disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-[1.15rem]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              <button
                type="button"
                className="auth-mode-switch"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-1.5 text-center sm:mb-7">
                <h1 className="font-serif text-3xl italic leading-tight tracking-tight text-cream">
                  Welcome to {BRAND_NAME}
                </h1>
                <p className="mx-auto max-w-md text-sm font-light leading-relaxed text-muted-foreground">
                  Virtual date rooms for two. Enter your email and we'll send a 6-digit code.
                </p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="auth-email" className="block text-sm text-muted-foreground/90">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="auth-input"
                    required
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="btn-primary mt-1 flex w-full items-center justify-center gap-3 rounded-xl py-4 font-semibold text-primary-foreground shadow-[0_12px_40px_rgba(212,130,106,0.22)] disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-[1.15rem]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send sign-in code"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[10px] font-light leading-relaxed tracking-[0.25em] text-muted-foreground/30">
          By continuing you confirm you are 18 or older.
        </p>
      </div>
    </PageShell>
  );
}
