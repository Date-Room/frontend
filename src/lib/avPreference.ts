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

/** What you get when nothing is remembered. */
function read(key: string, s: Storage | null, fallback: boolean): boolean {
  if (!s) return fallback;
  try {
    const held = s.getItem(key);
    return held === null ? fallback : held !== "false";
  } catch {
    return fallback;
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

/** The mic is the call: joining muted is joining to listen. */
export function joinWithMic(s: Storage | null = store()): boolean {
  return read(MIC_KEY, s, true);
}

/**
 * The camera starts OFF.
 *
 * George: "Can we make dateroom calls by default video off? This way,
 * we can use the phone call emoji instead of video, and make it fixed
 * green. Calls need to be obvious IMO."
 *
 * Which is a product decision with a mechanical consequence worth
 * naming: a call that opens with your camera live is a call you have to
 * be ready for, and the hesitation that buys is the thing that stops
 * people pressing the button at all. Audio first is what every app
 * people actually use does — a call, then video if you want it — and
 * turning the camera on afterwards is one tap that you choose.
 *
 * Still remembered: turn it on once and it stays on, which is the whole
 * point of this file. This only changes the answer for someone who has
 * never said.
 */
export function joinWithCamera(s: Storage | null = store()): boolean {
  return read(CAMERA_KEY, s, false);
}

export function rememberMic(on: boolean, s: Storage | null = store()): void {
  write(MIC_KEY, on, s);
}

export function rememberCamera(on: boolean, s: Storage | null = store()): void {
  write(CAMERA_KEY, on, s);
}
