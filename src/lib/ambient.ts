/**
 * Ambient/idle mode — pure state machine.
 *
 * Persistent rooms are always-on video; when nobody is engaged we drop
 * the local camera to a poster frame (audio stays live) to cut bitrate,
 * and restore instantly on any activity. This module is the pure core;
 * `AmbientController` wires it to LiveKit, the realtime channel, and DOM
 * signals. Kept dependency-free so it's trivially unit-testable.
 *
 * Convergence rule: ACTIVE wins. A client enters AMBIENT only via its own
 * idle timer; any local wake re-broadcasts "active" so peers restore
 * together, while a peer's "active" wakes us without echoing (no loops).
 */

export type AmbientMode = "active" | "ambient";

export type AmbientEvent =
  // Local speech, interaction, activity event, or tab refocus.
  | { type: "local-activity"; at: number }
  // A peer told us they're active (via the realtime channel).
  | { type: "peer-active"; at: number }
  // Periodic check against the idle threshold.
  | { type: "tick"; at: number };

export type AmbientMachine = {
  mode: AmbientMode;
  /** ms epoch of the last activity that kept/made us active. */
  lastActivityAt: number;
};

export type AmbientConfig = { idleMs: number };

export type AmbientResult = {
  next: AmbientMachine;
  /** True when `mode` changed — the controller applies the LiveKit action. */
  changed: boolean;
  /** Set when we should broadcast our new state to peers. */
  broadcast?: AmbientMode;
};

export function initAmbient(now: number): AmbientMachine {
  return { mode: "active", lastActivityAt: now };
}

export function ambientReducer(
  m: AmbientMachine,
  ev: AmbientEvent,
  cfg: AmbientConfig,
): AmbientResult {
  switch (ev.type) {
    case "local-activity":
    case "peer-active": {
      const next: AmbientMachine = { mode: "active", lastActivityAt: ev.at };
      const changed = m.mode !== "active";
      // Only a LOCAL wake re-broadcasts (so peers restore); a peer-active
      // that woke us must not echo, to avoid a broadcast loop.
      const broadcast =
        changed && ev.type === "local-activity" ? ("active" as const) : undefined;
      return { next, changed, broadcast };
    }
    case "tick": {
      if (m.mode === "ambient") return { next: m, changed: false };
      const idle = ev.at - m.lastActivityAt >= cfg.idleMs;
      if (!idle) return { next: m, changed: false };
      return {
        next: { mode: "ambient", lastActivityAt: m.lastActivityAt },
        changed: true,
        broadcast: "ambient",
      };
    }
  }
}
