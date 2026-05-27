/** Runtime shape returned by `new window.YT.Player(...)` (iframe API script). */

export type YoutubeIframeApiPlayer = {
  destroy?: () => void;
  setVolume?: (volume: number) => void;
  getVideoData?: () => { video_id?: string };
  loadVideoById?: (videoId: string) => void;
  playVideo?: () => unknown;
  pauseVideo?: () => unknown;
  mute?: () => void;
  unMute?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime?: () => number;
  getPlayerState?: () => number;
  isMuted?: () => boolean;
  getVolume?: () => number;
};

export type YoutubePlayerConstructorOptions = {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event?: { target: YoutubeIframeApiPlayer }) => void;
    onStateChange?: (event: YoutubePlayerStateChangeEvent) => void;
  };
};

export type YoutubePlayerStateChangeEvent = {
  target?: YoutubeIframeApiPlayer;
  data: number;
};

export type YoutubePlayerStateMap = {
  UNSTARTED: number;
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
  BUFFERING: number;
  CUED: number;
};

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement | null, options: YoutubePlayerConstructorOptions) => YoutubeIframeApiPlayer;
      PlayerState: YoutubePlayerStateMap;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};
