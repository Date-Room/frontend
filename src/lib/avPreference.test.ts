// Come back the way you left.
//
// George: "If I'm muted on the web, and I refresh my window, it should
// stay muted.. Same with video on/off"
//
// <LiveKitRoom audio video> was unconditional, so every reload came
// back with both live — mute yourself, refresh, and you are talking.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  joinWithCamera,
  joinWithMic,
  rememberCamera,
  rememberMic,
} from "@/lib/avPreference";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe("joining with mic and camera", () => {
  let s: MemoryStorage;
  beforeEach(() => {
    s = new MemoryStorage();
  });

  it("mic on, camera off when nothing has been chosen", () => {
    // George: "Can we make dateroom calls by default video off?... Calls
    // need to be obvious IMO."
    //
    // The mic IS the call, so it starts on; joining muted would be
    // joining to listen. The camera starts off, because a call that
    // opens with your camera live is a call you have to be ready for,
    // and the hesitation that buys is what stops people pressing the
    // button at all. Audio first, video if you want it.
    expect(joinWithMic(s)).toBe(true);
    expect(joinWithCamera(s)).toBe(false);
  });

  it("but a camera turned on is remembered on", () => {
    // The default is only the answer for someone who has never said.
    rememberCamera(true, s);
    expect(joinWithCamera(s)).toBe(true);
  });

  it("stays muted across a reload", () => {
    rememberMic(false, s);
    expect(joinWithMic(s)).toBe(false);
  });

  it("and stays camera-off across a reload", () => {
    rememberCamera(false, s);
    expect(joinWithCamera(s)).toBe(false);
  });

  it("comes back on once you turn it back on", () => {
    rememberMic(false, s);
    rememberMic(true, s);
    expect(joinWithMic(s)).toBe(true);
  });

  it("keeps mic and camera independent", () => {
    rememberCamera(true, s);
    rememberMic(false, s);
    expect(joinWithCamera(s)).toBe(true);
    rememberCamera(false, s);
    rememberMic(true, s);
    expect(joinWithCamera(s)).toBe(false);
    expect(joinWithMic(s)).toBe(true);
  });

  it("shares the pre-room's own keys, so the lobby and the call agree", () => {
    // Turning the mic off in the pre-room and then joining must not
    // arrive unmuted; these are one preference, not two.
    s.setItem("dr_pre_mic_enabled", "false");
    s.setItem("dr_pre_camera_enabled", "false");
    expect(joinWithMic(s)).toBe(false);
    expect(joinWithCamera(s)).toBe(false);
  });

  it("falls back to on when storage is unavailable", () => {
    expect(joinWithMic(null)).toBe(true);
    expect(() => rememberMic(false, null)).not.toThrow();
  });
});

describe("the wiring that makes it stick", () => {
  // Source-level: RoomVideo needs a live LiveKit room to render, and
  // what matters is structural.
  const src = readFileSync("src/components/RoomVideo.tsx", "utf8");

  it("publishes the mic even when joining muted, then mutes it", () => {
    // `audio={false}` would be undone: MicKeepAlive turns the mic on
    // whenever no track is published, by design. A published-but-muted
    // track is the one shape it leaves alone.
    expect(src).toMatch(/\n {6}audio\n/);
    expect(src).toContain("<JoinAsYouLeftIt mic={joinMic} />");
    expect(src).toContain("setMicrophoneEnabled(false)");
    // The camera has no keep-alive, so it can be honoured outright —
    // and a remembered-off camera then never lights up at all.
    expect(src).toContain("video={joinCamera}");
  });

  it("reads the preference once, not on every render", () => {
    // These are LiveKitRoom props; a changing value renegotiates the
    // connection mid-call.
    expect(src).toContain("const [joinMic] = useState(joinWithMic);");
    expect(src).toContain("const [joinCamera] = useState(joinWithCamera);");
  });
});
