/**
 * Self-hosted YouTube player controller — a drop-in replacement for the
 * youtube.com/iframe_api script, which privacy-hardened browsers block
 * outright (live-tested: Safari's tracking protection killed the script,
 * so `new YT.Player` never existed and no iframe was ever created, in
 * every surface at once).
 *
 * We build the embed iframe ourselves (youtube-nocookie.com, which loads
 * fine even under those blockers) and speak the embed's postMessage
 * protocol directly: send {event:"listening"} to start the feed, then
 * {event:"command", func, args}; receive onReady / onStateChange /
 * infoDelivery. Same architecture as the SoundCloud widget, which is why
 * SC never broke. `ensureYtShim()` installs a `window.YT` with the same
 * constructor shape the components already use, so call sites don't
 * change and no external script is ever loaded.
 */
import type {
  YoutubeIframeApiPlayer,
  YoutubePlayerConstructorOptions,
} from "@/types/youtubeIframeApi";

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

const DEFAULT_HOST = "https://www.youtube-nocookie.com";

let nextId = 1;

type InfoDelivery = {
  currentTime?: number;
  duration?: number;
  playerState?: number;
  muted?: boolean;
  volume?: number;
  videoData?: { video_id?: string; title?: string };
};

class EmbedPlayer implements YoutubeIframeApiPlayer {
  private iframe: HTMLIFrameElement;
  private host: string;
  private ready = false;
  private destroyed = false;
  private handshakeTimer: number | undefined;
  private readonly widgetId = `dr-yt-${nextId++}`;
  private readonly onMessage: (e: MessageEvent) => void;
  private events: YoutubePlayerConstructorOptions["events"];

  // Cached state fed by infoDelivery; getCurrentTime extrapolates between
  // deliveries while playing so 500ms UI polls stay smooth.
  private state: number = YT_STATE.UNSTARTED;
  private time = 0;
  private timeAt = Date.now();
  private duration = 0;
  private mutedFlag: boolean;
  private videoData: { video_id?: string; title?: string } = {};

  constructor(element: HTMLElement | null, options: YoutubePlayerConstructorOptions) {
    this.host = (options.host ?? DEFAULT_HOST).replace(/\/$/, "");
    this.events = options.events;
    if (options.videoId) this.videoData = { video_id: options.videoId };
    const vars = options.playerVars ?? {};
    this.mutedFlag = String(vars.mute) === "1";

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(vars)) params.set(k, String(v));
    params.set("enablejsapi", "1");
    params.set("origin", window.location.origin);
    params.set("widgetid", this.widgetId);
    if (String(vars.autoplay ?? "") === "") params.delete("autoplay");

    const iframe = document.createElement("iframe");
    iframe.src = `${this.host}/embed/${options.videoId ?? ""}?${params.toString()}`;
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("frameborder", "0");
    iframe.width = String(options.width ?? 640);
    iframe.height = String(options.height ?? 360);
    this.iframe = iframe;
    // Mirror the real API: the given element is replaced by the iframe.
    if (element?.parentNode) element.replaceWith(iframe);

    this.onMessage = (e: MessageEvent) => {
      if (this.destroyed || e.source !== this.iframe.contentWindow) return;
      if (typeof e.data !== "string") return;
      let msg: { event?: string; info?: unknown } | null = null;
      try {
        msg = JSON.parse(e.data) as { event?: string; info?: unknown };
      } catch {
        return;
      }
      if (!msg?.event) return;
      if (!this.ready) {
        // First message from the frame = handshake complete. Register for
        // event streams too (harmless where already implicit).
        this.ready = true;
        window.clearInterval(this.handshakeTimer);
        for (const func of ["onReady", "onStateChange"]) {
          try {
            this.iframe.contentWindow?.postMessage(
              JSON.stringify({ event: "addEventListener", func, id: this.widgetId, channel: "widget" }),
              this.host,
            );
          } catch {
            /* ignore */
          }
        }
      }
      if (msg.event === "onReady") {
        this.events?.onReady?.({ target: this });
        return;
      }
      if (msg.event === "onStateChange") {
        const data = typeof msg.info === "number" ? msg.info : YT_STATE.UNSTARTED;
        this.applyState(data);
        return;
      }
      if (msg.event === "infoDelivery" || msg.event === "initialDelivery") {
        const info = (msg.info ?? {}) as InfoDelivery;
        if (typeof info.currentTime === "number") {
          this.time = info.currentTime;
          this.timeAt = Date.now();
        }
        if (typeof info.duration === "number" && info.duration > 0) this.duration = info.duration;
        if (typeof info.muted === "boolean") this.mutedFlag = info.muted;
        if (info.videoData) this.videoData = info.videoData;
        // Live-probed: the embed does NOT reliably emit discrete
        // onStateChange messages, but every infoDelivery carries
        // playerState — so state-change callbacks are synthesized here.
        if (typeof info.playerState === "number") this.applyState(info.playerState);
      }
    };
    window.addEventListener("message", this.onMessage);

    // Announce ourselves until the embed responds (it queues commands after
    // "listening"). The frame needs a moment to boot; retry, don't race.
    const hello = () => {
      try {
        this.iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: this.widgetId, channel: "widget" }),
          this.host,
        );
      } catch {
        /* frame not ready yet */
      }
    };
    iframe.addEventListener("load", hello);
    this.handshakeTimer = window.setInterval(hello, 300);
  }

  /** Update cached state and fire onStateChange exactly once per change. */
  private applyState(next: number) {
    if (next === this.state) return;
    this.state = next;
    if (next === YT_STATE.PLAYING) this.timeAt = Date.now();
    this.events?.onStateChange?.({ target: this, data: next });
  }

  private command(func: string, args: unknown[] = []) {
    try {
      this.iframe.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args, id: this.widgetId, channel: "widget" }),
        this.host,
      );
    } catch {
      /* ignore */
    }
  }

  playVideo() {
    this.command("playVideo");
  }
  pauseVideo() {
    this.command("pauseVideo");
  }
  seekTo(seconds: number, allowSeekAhead: boolean) {
    this.command("seekTo", [seconds, allowSeekAhead]);
    this.time = seconds;
    this.timeAt = Date.now();
  }
  mute() {
    this.command("mute");
    this.mutedFlag = true;
  }
  unMute() {
    this.command("unMute");
    this.mutedFlag = false;
  }
  setVolume(volume: number) {
    this.command("setVolume", [volume]);
  }
  loadVideoById(videoId: string, startSeconds?: number) {
    this.videoData = { video_id: videoId };
    this.command("loadVideoById", startSeconds != null ? [videoId, startSeconds] : [videoId]);
  }
  cueVideoById(videoId: string, startSeconds?: number) {
    this.videoData = { video_id: videoId };
    this.command("cueVideoById", startSeconds != null ? [videoId, startSeconds] : [videoId]);
  }
  getCurrentTime(): number {
    if (this.state === YT_STATE.PLAYING) {
      return this.time + (Date.now() - this.timeAt) / 1000;
    }
    return this.time;
  }
  getDuration(): number {
    return this.duration;
  }
  getPlayerState(): number {
    return this.state;
  }
  isMuted(): boolean {
    return this.mutedFlag;
  }
  getVideoData(): { video_id?: string; title?: string } {
    return this.videoData;
  }
  setSize(width: number, height: number) {
    this.iframe.width = String(width);
    this.iframe.height = String(height);
  }
  getVolume(): number {
    return 100;
  }
  destroy() {
    this.destroyed = true;
    window.clearInterval(this.handshakeTimer);
    window.removeEventListener("message", this.onMessage);
    try {
      this.iframe.remove();
    } catch {
      /* ignore */
    }
  }
}

/** Install the shim as window.YT. Idempotent, synchronous, loads nothing. */
export function ensureYtShim(): Promise<void> {
  window.YT = {
    Player: EmbedPlayer as unknown as NonNullable<Window["YT"]>["Player"],
    PlayerState: { ...YT_STATE },
  };
  return Promise.resolve();
}
