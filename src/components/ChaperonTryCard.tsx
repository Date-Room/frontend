/**
 * "Want to see what I do?" — the first-timer's probe. Shown once per browser
 * on the first chaperoned date, under the shield. The person says a scripted
 * money ask; "I said it" opens the try-me window on the server so the catch
 * is tagged a test (never a flag on their date) and the review names it as
 * theirs. Also a recall probe for the corpus: a known money ask through a
 * real mic, accent and network.
 */
import { useEffect, useState } from "react";
import { useChaperonController } from "@/context/ChaperonContext";
import { PROBE_LINE } from "@/lib/chaperon";
import { cn } from "@/lib/utils";

const TRIED_KEY = "dr_chaperon_tried";

export function hasTriedChaperon(): boolean {
  try {
    return localStorage.getItem(TRIED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTriedChaperon(): void {
  try {
    localStorage.setItem(TRIED_KEY, "1");
  } catch {
    /* ignore */
  }
}

const CAUGHT_LINGER_MS = 6_000;

export function ChaperonTryCard({ partnerName }: { partnerName: string | null }) {
  const ctrl = useChaperonController();
  const [visible, setVisible] = useState(() => !hasTriedChaperon());
  const probe = ctrl?.probe ?? "idle";
  const them = partnerName?.trim() || "them";

  // Once Protect has caught it, linger long enough to read, then leave for good.
  useEffect(() => {
    if (probe !== "caught") return;
    markTriedChaperon();
    const t = window.setTimeout(() => setVisible(false), CAUGHT_LINGER_MS);
    return () => window.clearTimeout(t);
  }, [probe]);

  if (!ctrl || !ctrl.active || !visible) return null;

  const skip = () => {
    markTriedChaperon();
    ctrl.cancelProbe();
    setVisible(false);
  };

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto w-full rounded-2xl border px-3.5 py-3 text-[12px] leading-relaxed text-cream/90 shadow-lg backdrop-blur-xl",
        probe === "caught"
          ? "border-emerald-400/40 bg-emerald-500/[0.12]"
          : "border-white/10 bg-black/60",
      )}
    >
      {probe === "caught" ? (
        <p>
          <span className="font-semibold text-emerald-300">Caught it.</span> Set aside as your
          test. Your review will say so.
        </p>
      ) : probe === "armed" ? (
        <>
          <p className="font-semibold">Listening for it…</p>
          <p className="mt-1 text-cream/70">
            I should whisper within a minute. Only you will see it.
          </p>
          <button
            type="button"
            onClick={skip}
            className="focus-ring mt-2 rounded-full border border-white/15 px-3 py-1 text-[11px] text-cream/80 hover:bg-white/10"
          >
            Never mind
          </button>
        </>
      ) : (
        <>
          <p className="font-semibold">Want to see what I do?</p>
          <p className="mt-1 text-cream/70">
            Say this to {them}, as a joke if you like. Only you will see what I make of it.
          </p>
          <p className="mt-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-serif text-[13px] italic text-cream">
            &ldquo;{PROBE_LINE}&rdquo;
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void ctrl.startProbe()}
              className="btn-primary focus-ring rounded-full px-3 py-1.5 text-[11px] font-semibold"
            >
              I said it
            </button>
            <button
              type="button"
              onClick={skip}
              className="focus-ring rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-cream/80 hover:bg-white/10"
            >
              Skip
            </button>
          </div>
        </>
      )}
    </div>
  );
}
