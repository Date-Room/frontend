import { useCallback, useEffect, useRef, useState } from "react";
import {
  admitSignal,
  createChaperonSession,
  dismissCurrent,
  endChaperonSession,
  evaluateChaperon,
  initGate,
  sendChaperonFeedback,
  type ChaperonMode,
  type ChaperonDataTier,
  type ChaperonSession,
  type ChaperonSignal,
  type ChaperonTranscriptTurn,
  type GateState,
} from "@/lib/chaperon";

export type ChaperonStatus = "off" | "watching" | "degraded";

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

// Health rule (spec §6.2): show the degraded state after 2 consecutive
// failures, not on the first blip. Conservative retry when unhealthy.
const FAILURE_THRESHOLD = 2;
const DEGRADED_RETRY_MS = 15_000;

// When the server-side agent is present it becomes the brain (it hears BOTH
// mics accurately). If its heartbeats stop for this long, fall back to the
// browser's own loop. Must be > the agent's ~8s heartbeat interval.
const AGENT_SILENCE_MS = 20_000;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Drives a chaperon session for the room: opens the backend session, captures
 * the local transcript (Web Speech, v1), evaluates on the SERVER-driven cadence
 * (`next_eval_ms`, never a fixed client interval), and surfaces one whisper at
 * a time through the gate. Renders nothing itself — components read its state.
 */
export function useChaperon(opts: {
  roomId: string;
  participantId?: string;
  enabled: boolean;
}) {
  const { roomId, enabled } = opts;

  const [status, setStatus] = useState<ChaperonStatus>("off");
  const [session, setSession] = useState<ChaperonSession | null>(null);
  const [currentWhisper, setCurrentWhisper] = useState<ChaperonSignal | null>(null);
  // Observability: is speech recognition actively listening, and how many
  // words has it captured this session (so you can SEE the transcript layer).
  const [listening, setListening] = useState(false);
  const [wordsHeard, setWordsHeard] = useState(0);
  // The running whisper log (newest first) + a badge count for whispers that
  // landed since the user last looked at the rail.
  const [whisperLog, setWhisperLog] = useState<WhisperLogEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const runningRef = useRef(false);
  const sessionRef = useRef<ChaperonSession | null>(null);
  const gateRef = useRef<GateState>(initGate());
  const pendingTurnsRef = useRef<ChaperonTranscriptTurn[]>([]);
  const startedAtRef = useRef(0);
  const failuresRef = useRef(0);
  const tickTimerRef = useRef<number | undefined>(undefined);
  const dismissTimerRef = useRef<number | undefined>(undefined);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inFlightRef = useRef(false);
  // Handover: is the server agent currently the brain? + its silence watchdog.
  const agentModeRef = useRef(false);
  const agentWatchdogRef = useRef<number | undefined>(undefined);

  const transcriptSupported = getSpeechRecognitionCtor() !== null;

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
      // Log it for the rail + end-of-call recap (newest first), and bump the
      // unread badge so a whisper heard while you were talking isn't lost.
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

  const pushTurn = useCallback((text: string, speaker: "local" | "remote" = "local") => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pendingTurnsRef.current.push({ speaker, text: trimmed, at: Date.now() });
    const n = trimmed.split(/\s+/).filter(Boolean).length;
    setWordsHeard((w) => w + n);
  }, []);

  const scheduleTick = useCallback((delayMs: number) => {
    if (!runningRef.current) return;
    if (tickTimerRef.current) window.clearTimeout(tickTimerRef.current);
    tickTimerRef.current = window.setTimeout(() => void runTick(), delayMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runTick = useCallback(async () => {
    const sess = sessionRef.current;
    // In agent mode the server agent drives everything; the browser loop rests.
    if (!runningRef.current || !sess || inFlightRef.current || agentModeRef.current) return;

    const window_ = pendingTurnsRef.current;
    pendingTurnsRef.current = [];
    const elapsedSec = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));

    inFlightRef.current = true;
    try {
      const res = await evaluateChaperon(sess.id, {
        transcript_window: window_,
        elapsed_sec: elapsedSec,
      });
      failuresRef.current = 0;
      setStatus(res.healthy ? "watching" : "degraded");
      const now = Date.now();
      for (const signal of res.signals) {
        const { state, show } = admitSignal(gateRef.current, signal, now);
        gateRef.current = state;
        if (show) {
          showWhisper(show);
          break; // one at a time
        }
      }
      inFlightRef.current = false;
      scheduleTick(res.next_eval_ms);
    } catch {
      inFlightRef.current = false;
      failuresRef.current += 1;
      if (failuresRef.current >= FAILURE_THRESHOLD) setStatus("degraded");
      scheduleTick(DEGRADED_RETRY_MS);
    }
  }, [showWhisper, scheduleTick]);

  /** Inject a line of text as if it were heard — the "type a test line"
   *  debug, so the whisper pipeline is provable without a working mic. */
  const injectText = useCallback(
    (text: string) => {
      pushTurn(text, "local");
      scheduleTick(300); // evaluate it right away for a snappy demo
    },
    [pushTurn, scheduleTick],
  );

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = false;
      // Don't hardcode en-US (prototype defect #8) — let the browser default.
      rec.onresult = (e: unknown) => {
        const ev = e as {
          results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
          resultIndex?: number;
        };
        const results = ev.results;
        if (!results) return;
        const from = ev.resultIndex ?? 0;
        for (let i = from; i < results.length; i += 1) {
          const text = results[i]?.[0]?.transcript;
          if (text) pushTurn(text, "local");
        }
      };
      // Web Speech stops itself after a pause — restart it so it keeps
      // listening for the whole call (prototype defect: it died after one line).
      rec.onend = () => {
        setListening(false);
        if (runningRef.current) {
          try {
            rec.start();
            setListening(true);
          } catch {
            /* will retry on the next onend */
          }
        }
      };
      rec.onerror = () => {
        // "not-allowed" / "audio-capture" — the mic is contended (common
        // during a live call). Reflect it; onend will attempt a restart.
        setListening(false);
      };
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }, [pushTurn]);

  // --- Server-agent handover ------------------------------------------------
  // The agent hears both mics accurately over LiveKit; when it's present it
  // becomes the brain and the browser's local-only Web Speech loop stands down.

  const enterAgentMode = useCallback(() => {
    if (agentModeRef.current) return;
    agentModeRef.current = true;
    if (tickTimerRef.current) window.clearTimeout(tickTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const exitAgentMode = useCallback(() => {
    if (!agentModeRef.current) return;
    agentModeRef.current = false;
    if (!runningRef.current) return;
    // Agent went quiet — resume the browser fallback loop.
    setStatus("degraded");
    startRecognition();
    scheduleTick(1_000);
  }, [startRecognition, scheduleTick]);

  const armAgentWatchdog = useCallback(() => {
    if (agentWatchdogRef.current) window.clearTimeout(agentWatchdogRef.current);
    agentWatchdogRef.current = window.setTimeout(exitAgentMode, AGENT_SILENCE_MS);
  }, [exitAgentMode]);

  /** Handle a targeted message from the server agent (whisper or health).
   *  Called by the in-room DataReceived bridge. Input is off the wire, so it's
   *  narrowed defensively. */
  const ingestAgentMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (!runningRef.current || typeof msg?.type !== "string") return;
      enterAgentMode(); // any agent message means the agent is on the case
      armAgentWatchdog();
      if (msg.type === "chaperon.health") {
        setStatus(msg.healthy ? "watching" : "degraded");
      } else if (
        msg.type === "chaperon.whisper" &&
        typeof msg.check_id === "string" &&
        typeof msg.severity === "string"
      ) {
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
    [enterAgentMode, armAgentWatchdog, showWhisper],
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
      pendingTurnsRef.current = [];
      startedAtRef.current = Date.now();
      failuresRef.current = 0;
      agentModeRef.current = false; // start in browser fallback; agent takes over on its first beat
      runningRef.current = true;
      setStatus("watching");
      setWordsHeard(0);
      setWhisperLog([]);
      setUnreadCount(0);
      startRecognition();
      scheduleTick(1_000); // first tick shortly after start
    },
    [enabled, roomId, startRecognition, scheduleTick],
  );

  const stop = useCallback(async () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    agentModeRef.current = false;
    if (tickTimerRef.current) window.clearTimeout(tickTimerRef.current);
    if (agentWatchdogRef.current) window.clearTimeout(agentWatchdogRef.current);
    clearDismissTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    const sess = sessionRef.current;
    setStatus("off");
    setListening(false);
    setWordsHeard(0);
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
      if (tickTimerRef.current) window.clearTimeout(tickTimerRef.current);
      if (agentWatchdogRef.current) window.clearTimeout(agentWatchdogRef.current);
      clearDismissTimer();
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    status,
    active: runningRef.current,
    session,
    currentWhisper,
    transcriptSupported,
    listening,
    wordsHeard,
    whisperLog,
    unreadCount,
    markRailSeen,
    start,
    stop,
    dismiss,
    sendFeedback,
    injectText,
    ingestAgentMessage,
  };
}
