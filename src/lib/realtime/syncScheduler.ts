/**
 * Near-perfect co-playback sync (Teleparty / Syncplay-style).
 *
 * How the big streaming-sync tools do it, and what we do:
 *  - Teleparty: a control action (play/pause/seek) is sent with the media
 *    timestamp; peers apply it and periodically drift-correct. Simple, but the
 *    play/resume moment can be tens–hundreds of ms apart.
 *  - Syncplay: peers exchange position + measured latency and the coordinator
 *    schedules everyone, accounting for network delay ("ready" gating).
 *
 * We combine both. For the PLAY/RESUME moment (the one a human notices) we
 * schedule a SHARED FUTURE INSTANT: the initiator picks a small lead Δ, both
 * sides start playing exactly Δ after the initiator committed — the follower
 * subtracts the transit time already spent so the two fire together. No absolute
 * clock sync is needed: Δ is a relative delay and we only need the one-way
 * transit estimate, which we measure with a ping/echo probe over the channel.
 * PAUSE is applied immediately and both seek to the same frame (identical end
 * state), and continuous drift is still corrected by the caller's heartbeat.
 */

import type { RoomChannel } from "@/lib/realtime/roomChannel";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Minimum lead time for a scheduled start, and the floor/ceiling for Δ. */
const MIN_LEAD_MS = 450;
const MAX_LEAD_MS = 1500;
const PROBE_INTERVAL_MS = 5000;

export type ScheduledAction = { videoTime: number };

export class SyncScheduler {
  private oneWay = 120; // ms, updated by probes; conservative default
  private probeTimer: number | null = null;
  private offBroadcast: (() => void) | null = null;
  private timers = new Set<number>();
  private readonly pending = new Map<string, number>(); // probeId → sentAt

  constructor(
    private readonly channel: RoomChannel,
    private readonly activityId: string,
    private readonly selfId: string,
  ) {}

  /** Current best one-way latency estimate (ms). */
  get oneWayMs(): number {
    return this.oneWay;
  }

  /**
   * Begin listening for the peer's scheduled starts + running the latency probe.
   * `onStart(videoTime)` fires at the shared instant for a peer-initiated play.
   */
  start(onStart: (videoTime: number) => void): () => void {
    this.offBroadcast = this.channel.onBroadcast((e) => {
      const d = e.payload as Record<string, unknown>;
      if (d.activity_id !== this.activityId) return;

      if (e.kind === "sync_probe") {
        // Echo back so the sender can measure RTT.
        if (d.from === this.selfId) return;
        void this.channel.broadcast("sync_probe_ack", {
          activity_id: this.activityId,
          from: this.selfId,
          to: d.from,
          probe_id: d.probe_id,
        });
        return;
      }
      if (e.kind === "sync_probe_ack") {
        if (d.to !== this.selfId) return;
        const sent = this.pending.get(String(d.probe_id));
        if (sent == null) return;
        this.pending.delete(String(d.probe_id));
        const rtt = now() - sent;
        // EWMA smoothing; one-way ≈ rtt/2, clamped to something sane.
        const sample = Math.min(Math.max(rtt / 2, 10), 800);
        this.oneWay = Math.round(this.oneWay * 0.6 + sample * 0.4);
        return;
      }
      if (e.kind === "sync_start") {
        if (d.from === this.selfId) return;
        const videoTime = typeof d.video_time === "number" ? d.video_time : 0;
        const lead = typeof d.lead_ms === "number" ? d.lead_ms : MIN_LEAD_MS;
        const senderOneWay = typeof d.one_way_ms === "number" ? d.one_way_ms : this.oneWay;
        // The message spent ~senderOneWay in transit; fire the remaining time so
        // both sides land on the initiator's chosen instant.
        const wait = Math.max(0, lead - senderOneWay);
        // Account for playback that will have advanced by the time we start.
        const target = videoTime + wait / 1000;
        this.runAfter(wait, () => onStart(target));
        return;
      }
    });

    this.probeTimer = window.setInterval(() => this.sendProbe(), PROBE_INTERVAL_MS);
    this.sendProbe();

    return () => this.dispose();
  }

  /**
   * Schedule a synchronized start. Returns the local delay (ms) after which the
   * caller should actually start playback at `localTarget` seconds — call the
   * returned run() or use the `onLocalStart` callback. Both sides fire together.
   */
  scheduleStart(videoTime: number, onLocalStart: (videoTime: number) => void): void {
    const lead = Math.min(Math.max(MIN_LEAD_MS, this.oneWay * 3), MAX_LEAD_MS);
    void this.channel.broadcast("sync_start", {
      activity_id: this.activityId,
      from: this.selfId,
      video_time: videoTime,
      lead_ms: lead,
      one_way_ms: this.oneWay,
    });
    // Local side waits the full lead (it didn't pay transit).
    const target = videoTime + lead / 1000;
    this.runAfter(lead, () => onLocalStart(target));
  }

  private sendProbe() {
    const id = `${this.selfId}:${Math.round(now())}`;
    this.pending.set(id, now());
    // Bound the pending map.
    if (this.pending.size > 8) {
      const oldest = this.pending.keys().next().value;
      if (oldest) this.pending.delete(oldest);
    }
    void this.channel.broadcast("sync_probe", {
      activity_id: this.activityId,
      from: this.selfId,
      probe_id: id,
    });
  }

  private runAfter(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private dispose() {
    this.offBroadcast?.();
    this.offBroadcast = null;
    if (this.probeTimer !== null) {
      window.clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    this.pending.clear();
  }
}
