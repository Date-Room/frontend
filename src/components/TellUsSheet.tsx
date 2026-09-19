/**
 * "Tell us": one of four kinds and a line, sent from wherever it was opened.
 * The beta runs on this. It knows the surface and the activity on screen so
 * the team does not have to ask "where were you"; it never sends anything
 * about the call itself.
 */
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import { FEEDBACK_KINDS, submitFeedback, type FeedbackKind, type FeedbackSurface } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export function TellUsSheet({
  open,
  onClose,
  surface,
  activityId,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  surface: FeedbackSurface;
  activityId?: string | null;
  roomId?: string | null;
}) {
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const signedIn = Boolean(authClient.getSession());

  if (!open) return null;

  async function send() {
    if (!kind) return;
    setBusy(true);
    try {
      await submitFeedback({ surface, activity_id: activityId ?? null, kind, text: text.trim(), room_id: roomId ?? null });
      setSent(true);
      setTimeout(() => {
        onClose();
        setSent(false);
        setKind(null);
        setText("");
      }, 1200);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not send that just now");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Feedback"
        className="w-full space-y-4 rounded-t-3xl border border-white/10 bg-card/95 p-5 shadow-2xl backdrop-blur-xl sm:mx-4 sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl leading-tight text-cream">Feedback</h2>
            <p className="mt-1 text-body text-muted-foreground">
              One tap and a line. It goes to the people building this, with nothing about your call.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="focus-ring -mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:text-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!signedIn ? (
          <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-body text-muted-foreground">
            Sign in to send feedback, so we can reply.
          </p>
        ) : sent ? (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 text-body text-cream">Got it. Thank you.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="What kind">
              {FEEDBACK_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "focus-ring rounded-2xl border px-4 py-3 text-left transition",
                    kind === k.id ? "border-primary/60 bg-primary/[0.12]" : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
                  )}
                >
                  <span className="block text-body font-semibold text-cream">{k.label}</span>
                  <span className="block text-label text-muted-foreground">{k.hint}</span>
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What happened, in your words (optional)"
              className="focus-ring w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-body text-cream placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              disabled={!kind || busy}
              onClick={() => void send()}
              className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-3.5 font-semibold disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send
            </button>
          </>
        )}
      </div>
    </div>
  );
}
