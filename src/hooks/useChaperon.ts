import { useCallback, useEffect, useRef, useState } from "react";
import {
  admitSignal,
  createChaperonSession,
  dismissCurrent,
  endChaperonSession,
  initGate,
  sendChaperonFeedback,
  type ChaperonMode,
  type ChaperonDataTier,
  type ChaperonSession,
  type ChaperonSignal,
  type GateState,
} from "@/lib/chaperon";

// "connecting" = the session is open but the server agent hasn't checked in yet
// (or has gone quiet). We never fake "watching" in that gap — the indicators
// tell the truth so you can see when the agent isn't actually on the case.
export type ChaperonStatus = "off" | "connecting" | "watching" | "degraded";

/** Per-participant transcription liveness, from the agent's heartbeat. `null`
 *  until the agent has reported on that track. */
export type TrackStatus = {
  subscribed: boolean;
  receivingAudio: boolean;
  turns: number;
  lastTurnSecAgo: number | null;
} | null;

/** Everything the in-call indicators render — the real state of each pipeline
 *  stage, reported by the server agent (never inferred from the browser). */
export type AgentStatus = {
  connected: boolean; // heartbeats arriving
  judgeOk: boolean; // the coaching/safety judge is producing, not erroring
  you: TrackStatus; // is the agent hearing YOUR mic
  them: TrackStatus; // is the agent hearing the other person
  lastError: string | null; // last judge error, for the diagnostics drawer
};

const DISCONNECTED_AGENT: AgentStatus = {
  connected: false,
  judgeOk: false,
  you: null,
  them: null,
  lastError: null,
};

/** A whisper as it landed, for the running rail + end-of-call recap. */
export type WhisperLogEntry = {
  id: string;
  signal: ChaperonSignal;
  at: number; // wall-clock ms
  elapsedSec: number; // seconds into the call, for a stable "0:32" label
};

/** Alerts (safety's sharp end) stay until the user dismisses them; coaching
 *  auto-hides, but at a readable pace — not the old 6s flash. */
const COACH_DISPLAY_MS = 10_000;
function isPersistentSeverity(sev: ChaperonSignal["severity"]): boolean {
  return sev === "alert" || sev === "warn";
}

export type ChaperonStartConfig = {
  mode: ChaperonMode;
  checks: string[];
  announcePresence: boolean;
  dataTier: ChaperonDataTier;
};

// The server agent heartbeats every ~8s. If none arrives for this long, treat
// the agent as not responding and say so (status -> "connecting"), rather than
// leaving a stale green dot.
const AGENT_SILENCE_MS = 20_000;

function toTrackStatus(raw: unknown): TrackStatus {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    subscribed: r.subscribed === true,
    receivingAudio: r.receiving_audio === true,
    turns: typeof r.turns === "number" ? r.turns : 0,
    lastTurnSecAgo: typeof r.last_turn_sec_ago === "number" ? r.last_turn_sec_ago : null,
  };
}

/**
 * Drives a chaperon session for the room. The SERVER AGENT is the only
 * transcription + judgement engine: it hears both mics over LiveKit, evaluates,
 * and pushes whispers + health heartbeats to this viewer. This hook opens the
 * session, renders what the agent reports (whispers + per-stage status), and
 * never runs any browser-side speech recognition of its own. Renders nothing —
 * components read its state.
 */
export function useChaperon(opts: {
  roomId: string;
  participantId?: string;
  enabled: boolean;
}) {
  const { roomId, enabled } = opts;

  const [status, setStatus] = useState<ChaperonStatus>("off");
  const [agent, setAgent] = useState<AgentStatus>(DISCONNECTED_AGENT);
  const [session, setSession] = useState<ChaperonSession | null>(null);
  const [currentWhisper, setCurrentWhisper] = useState<ChaperonSignal | null>(null);
  // The running whisper log (newest first) + a badge count for whispers that
  // landed since the user last looked at the rail.
  const [whisperLog, setWhisperLog] = useState<WhisperLogEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const runningRef = useRef(false);
  const sessionRef = useRef<ChaperonSession | null>(null);
  const gateRef = useRef<GateState>(initGate());
  const startedAtRef = useRef(0);
  const dismissTimerRef = useRef<number | undefined>(undefined);
  const agentWatchdogRef = useRef<number | undefined>(undefined);

  const clearDismissTimer = () => {
    if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = undefined;
  };

  const dismiss = useCallback(() => {
    clearDismissTimer();
    gateRef.current = dismissCurrent(gateRef.current);
    setCurrentWhisper(null);
  }, []);

  const showWhisper = useCallback(
    (signal: ChaperonSignal) => {
      clearDismissTimer();
      setCurrentWhisper(signal);
      const elapsedSec = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
      const entry: WhisperLogEntry = {
        id: signal.event_id ?? `${signal.check_id}-${Date.now()}`,
        signal,
        at: Date.now(),
        elapsedSec,
      };
      setWhisperLog((log) => [entry, ...log]);
      setUnreadCount((n) => n + 1);
      // Alerts persist until dismissed; coaching auto-hides at a readable pace.
      if (!isPersistentSeverity(signal.severity)) {
        dismissTimerRef.current = window.setTimeout(dismiss, COACH_DISPLAY_MS);
      }
    },
    [dismiss],
  );

  /** The rail is being looked at — clear the unread badge. */
  const markRailSeen = useCallback(() => setUnreadCount(0), []);

  // If the agent goes quiet, stop claiming it's connected — the indicators must
  // reflect reality so a dead agent is visible, not hidden behind a green dot.
  const armAgentWatchdog = useCallback(() => {
    if (agentWatchdogRef.current) window.clearTimeout(agentWatchdogRef.current);
    agentWatchdogRef.current = window.setTimeout(() => {
      if (!runningRef.current) return;
      setAgent((a) => ({ ...a, connected: false }));
      setStatus("connecting");
    }, AGENT_SILENCE_MS);
  }, []);

  /** Handle a targeted message from the server agent (whisper or health).
   *  Called by the in-room DataReceived bridge. Input is off the wire, so it's
   *  narrowed defensively. */
  const ingestAgentMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (!runningRef.current || typeof msg?.type !== "string") return;
      armAgentWatchdog(); // any message means the agent is alive right now

      if (msg.type === "chaperon.health") {
        const judgeOk = msg.healthy === true;
        setAgent({
          connected: true,
          judgeOk,
          you: toTrackStatus(msg.you),
          them: toTrackStatus(msg.them),
          lastError: typeof msg.last_error === "string" ? msg.last_error : null,
        });
        setStatus(judgeOk ? "watching" : "degraded");
      } else if (
        msg.type === "chaperon.whisper" &&
        typeof msg.check_id === "string" &&
        typeof msg.severity === "string"
      ) {
        setAgent((a) => (a.connected ? a : { ...a, connected: true }));
        const signal: ChaperonSignal = {
          event_id: typeof msg.event_id === "string" ? msg.event_id : null,
          check_id: msg.check_id,
          severity: msg.severity as ChaperonSignal["severity"],
          whisper: typeof msg.whisper === "string" ? msg.whisper : "",
          confidence: typeof msg.confidence === "number" ? msg.confidence : 0,
        };
        const { state, show } = admitSignal(gateRef.current, signal, Date.now());
        gateRef.current = state;
        if (show) showWhisper(show);
      }
    },
    [armAgentWatchdog, showWhisper],
  );

  const start = useCallback(
    async (cfg: ChaperonStartConfig) => {
      if (!enabled || runningRef.current) return;
      let sess: ChaperonSession;
      try {
        sess = await createChaperonSession({
          room_id: roomId,
          mode: cfg.mode,
          checks: cfg.checks,
          announce_presence: cfg.announcePresence,
          data_tier: cfg.dataTier,
        });
      } catch {
        // e.g. 402 when Coach isn't entitled — stay off rather than half-start.
        return;
      }
      sessionRef.current = sess;
      setSession(sess);
      gateRef.current = initGate();
      startedAtRef.current = Date.now();
      runningRef.current = true;
      // Open in "connecting": the agent joins and heartbeats within a few
      // seconds, which flips us to watching. We never pretend to watch first.
      setStatus("connecting");
      setAgent(DISCONNECTED_AGENT);
      setWhisperLog([]);
      setUnreadCount(0);
      armAgentWatchdog();
    },
    [enabled, roomId, armAgentWatchdog],
  );

  const stop = useCallback(async () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    if (agentWatchdogRef.current) window.clearTimeout(agentWatchdogRef.current);
    clearDismissTimer();
    const sess = sessionRef.current;
    setStatus("off");
    setAgent(DISCONNECTED_AGENT);
    setCurrentWhisper(null);
    setSession(null);
    sessionRef.current = null;
    if (sess) await endChaperonSession(sess.id).catch(() => {});
  }, []);

  // Rate a whisper. Defaults to the currently-visible one (the toast buttons),
  // but the rail passes an explicit event_id so any past whisper is rateable.
  const sendFeedback = useCallback((helpful: boolean, eventId?: string) => {
    const sess = sessionRef.current;
    const id = eventId ?? gateRef.current.current?.event_id ?? null;
    if (!sess || !id) return;
    void sendChaperonFeedback(sess.id, { event_id: id, helpful }).catch(() => {});
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (agentWatchdogRef.current) window.clearTimeout(agentWatchdogRef.current);
      clearDismissTimer();
    };
  }, []);

  return {
    status,
    agent,
    active: runningRef.current,
    session,
    currentWhisper,
    whisperLog,
    unreadCount,
    markRailSeen,
    start,
    stop,
    dismiss,
    sendFeedback,
    ingestAgentMessage,
  };
}
