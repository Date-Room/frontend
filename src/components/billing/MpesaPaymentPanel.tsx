/**
 * The one M-Pesa payment panel (see lib/mpesaFlow). Mounted once in App;
 * opens whenever any checkout sends an STK prompt.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Loader2, Smartphone, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  canResend,
  checkNow,
  closePanel,
  flowPhase,
  getFlow,
  resendPrompt,
  subscribe,
} from "@/lib/mpesaFlow";

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

const button =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition disabled:opacity-50";
const primary = `${button} bg-fill text-primary-foreground hover:bg-primary/90`;
const secondary = `${button} border border-white/[0.14] text-cream/90 hover:bg-white/[0.06]`;

export function MpesaPaymentPanel() {
  const flow = useSyncExternalStore(subscribe, getFlow, getFlow);
  const now = useNow(Boolean(flow?.open));
  if (!flow) return null;

  const phase = flowPhase(flow, now);
  const resendOk = canResend(flow, now);
  const resendIn = Math.max(0, Math.ceil((flow.lastPushAt + 45_000 - now) / 1000));

  const copy = {
    waiting: {
      icon: <Smartphone className="h-7 w-7 text-primary" />,
      title: "Check your phone",
      body: `Approve the M-Pesa prompt for your ${flow.label} by entering your M-Pesa PIN.`,
    },
    slow: {
      icon: <Loader2 className="h-7 w-7 animate-spin text-primary" />,
      title: "Still confirming",
      body: `If you've approved it on your phone, your ${flow.label} will be added automatically, even if you close this. M-Pesa can take a few minutes.`,
    },
    failed: {
      icon: <XCircle className="h-7 w-7 text-rose-300" />,
      title: "Payment didn't go through",
      body: flow.failure ?? "M-Pesa didn't complete the payment. Nothing was charged.",
    },
    done: {
      icon: <CheckCircle2 className="h-7 w-7 text-emerald-300" />,
      title: "Payment confirmed",
      body: `Your ${flow.label} has been added.`,
    },
  }[phase];

  return (
    <Dialog open={flow.open} onOpenChange={(open) => !open && closePanel()}>
      <DialogContent className="max-w-sm rounded-3xl border-white/[0.1] bg-card">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
            {copy.icon}
          </div>
          <DialogTitle className="font-serif text-title italic text-cream">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {copy.body}
          </DialogDescription>
          {phase === "waiting" && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" aria-label="Waiting for M-Pesa" />
          )}
          {flow.notice && <p className="text-xs text-muted-foreground/80">{flow.notice}</p>}
        </div>

        {phase !== "done" && (
          <div className="mt-2 flex flex-col gap-2.5">
            {phase === "slow" && (
              <button type="button" className={primary} disabled={flow.checking} onClick={() => void checkNow()}>
                {flow.checking && <Loader2 className="h-4 w-4 animate-spin" />}
                I've paid, check now
              </button>
            )}
            {phase === "waiting" && !resendOk ? (
              <p className="text-center text-xs text-muted-foreground/70">
                Didn't get the prompt? You can send it again in {resendIn}s.
              </p>
            ) : (
              <button
                type="button"
                className={phase === "failed" ? primary : secondary}
                disabled={!resendOk}
                onClick={() => void resendPrompt()}
              >
                {flow.resending && <Loader2 className="h-4 w-4 animate-spin" />}
                {phase === "failed" ? "Try again" : "Send the prompt again"}
              </button>
            )}
            <button type="button" className={`${button} text-muted-foreground hover:text-cream`} onClick={closePanel}>
              Close
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
