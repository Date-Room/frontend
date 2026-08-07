import { useState } from "react";
import { Check, ChevronRight, Loader2, Minus, X } from "lucide-react";
import type { AgentStatus, ChaperonStatus, TrackStatus } from "@/hooks/useChaperon";
import { cn } from "@/lib/utils";

// Beta shows the per-stage detail expanded by default so the team can see
// exactly what's working. At scale, flip this to false and the everyday UI is
// just the dot with this detail one tap away (nothing is removed). One line.
export const CHAPERON_STATUS_DEFAULT_OPEN = true;

type RowState = "ok" | "bad" | "pending" | "unknown";

function Indicator({ state }: { state: RowState }) {
  if (state === "ok")
    return <Check className="h-3.5 w-3.5 text-emerald-400" aria-label="working" />;
  if (state === "bad") return <X className="h-3.5 w-3.5 text-rose-400" aria-label="not working" />;
  if (state === "pending")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber" aria-label="connecting" />;
  return <Minus className="h-3.5 w-3.5 text-white/30" aria-label="unknown" />;
}

function Row({ label, state }: { label: string; state: RowState }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span
        className={cn(
          "text-[11px]",
          state === "bad" ? "text-rose-200" : "text-white/70",
        )}
      >
        {label}
      </span>
      <Indicator state={state} />
    </div>
  );
}

/** A track is "ok" when audio is flowing, "bad" when the agent subscribed but
 *  no audio is arriving (the real fault — the other person can hear you but the
 *  agent can't), "pending" while we haven't heard about it yet. */
function trackState(track: TrackStatus, agentConnected: boolean): RowState {
  if (!agentConnected) return "unknown";
  if (track === null) return "pending";
  if (track.receivingAudio) return "ok";
  return track.subscribed ? "bad" : "pending";
}

/**
 * The honest in-call status: one row per pipeline stage, so you can see at a
 * glance which part is working and, when something breaks, exactly where — per
 * person. A tap opens a diagnostics drawer with counts and the last error, so a
 * problem is self-service to read out instead of pulling server logs.
 */
export function ChaperonStatusPanel({
  status,
  agent,
  remoteName = "them",
}: {
  status: ChaperonStatus;
  agent: AgentStatus;
  remoteName?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(CHAPERON_STATUS_DEFAULT_OPEN);

  const agentState: RowState = agent.connected ? "ok" : "pending";
  const judgeState: RowState = !agent.connected
    ? "unknown"
    : agent.judgeOk
      ? "ok"
      : "bad";

  return (
    <div className="w-56 rounded-xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur">
      <Row label={agent.connected ? "Agent connected" : "Connecting to agent…"} state={agentState} />
      <Row label="Hearing you" state={trackState(agent.you, agent.connected)} />
      <Row label={`Hearing ${remoteName}`} state={trackState(agent.them, agent.connected)} />
      <Row label="Coaching" state={judgeState} />

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="mt-1 flex w-full items-center gap-1 border-t border-white/10 pt-1 text-[10px] text-white/40 transition hover:text-white/70"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", detailsOpen && "rotate-90")} />
        Details
      </button>

      {detailsOpen && (
        <div className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-white/45">
          <DetailLine label="you" track={agent.you} />
          <DetailLine label={remoteName} track={agent.them} />
          {status === "connecting" && !agent.connected && (
            <div className="text-amber/80">Waiting for the agent to join…</div>
          )}
          {agent.lastError && (
            <div className="text-rose-300/80">Last judge error: {agent.lastError}</div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailLine({ label, track }: { label: string; track: TrackStatus }) {
  if (track === null) return <div>{label}: no report yet</div>;
  const audio = track.receivingAudio ? "audio ✓" : track.subscribed ? "no audio" : "not subscribed";
  const turns = `${track.turns} turn${track.turns === 1 ? "" : "s"}`;
  const last = track.lastTurnSecAgo === null ? "" : ` · last ${track.lastTurnSecAgo}s ago`;
  return (
    <div>
      {label}: {audio} · {turns}
      {last}
    </div>
  );
}
