/**
 * Whether you join with your microphone and camera on.
 *
 * George: "If I'm muted on the web, and I refresh my window, it should
 * stay muted.. Same with video on/off"
 *
 * `<LiveKitRoom audio video>` was unconditional, so every reload came
 * back with both live. Muting yourself and refreshing put you back on
 * the call talking.
 *
 * These are the keys the pre-room already writes from its own mic and
 * camera switches, deliberately reused: "do I join with these on" is
 * one preference, and having the lobby and the call disagree about it
 * is how you end up muting yourself twice.
 *
 * Not per room. Muting is a habit about where you are sitting, not
 * about who you are talking to.
 */

const MIC_KEY = "dr_pre_mic_enabled";
const CAMERA_KEY = "dr_pre_camera_enabled";

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Default ON: a call you have never configured should just work. */
function read(key: string, s: Storage | null): boolean {
  if (!s) return true;
  try {
    const held = s.getItem(key);
    return held === null ? true : held !== "false";
  } catch {
    return true;
  }
}

function write(key: string, on: boolean, s: Storage | null): void {
  if (!s) return;
  try {
    s.setItem(key, String(on));
  } catch {
    /* storage blocked: no memory, which is how it behaved before */
  }
}

export function joinWithMic(s: Storage | null = store()): boolean {
  return read(MIC_KEY, s);
}

export function joinWithCamera(s: Storage | null = store()): boolean {
  return read(CAMERA_KEY, s);
}

export function rememberMic(on: boolean, s: Storage | null = store()): void {
  write(MIC_KEY, on, s);
}

export function rememberCamera(on: boolean, s: Storage | null = store()): void {
  write(CAMERA_KEY, on, s);
}
