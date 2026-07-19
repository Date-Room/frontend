/**
 * Media-device helpers — enumerate/group capture+output devices and
 * remember the user's preferred one per kind. Pure and side-effect-light
 * (localStorage reads/writes are guarded) so the resolution logic is
 * unit-testable. Never hard-fails on a missing device: an unplugged
 * preference resolves to `undefined` = browser/system default.
 */

export type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

const STORAGE_KEYS: Record<DeviceKind, string> = {
  audioinput: "dr_device_audioinput",
  videoinput: "dr_device_videoinput",
  audiooutput: "dr_device_audiooutput",
};

// The browser's magic id for "system default" — we never persist it (an
// empty/removed preference already means default).
const DEFAULT_ID = "default";

export type GroupedDevices = Record<DeviceKind, MediaDeviceInfo[]>;

export function groupDevices(list: MediaDeviceInfo[]): GroupedDevices {
  const grouped: GroupedDevices = { audioinput: [], videoinput: [], audiooutput: [] };
  for (const d of list) {
    if (d.kind === "audioinput" || d.kind === "videoinput" || d.kind === "audiooutput") {
      grouped[d.kind].push(d);
    }
  }
  return grouped;
}

export function loadDevicePreference(kind: DeviceKind): string | undefined {
  try {
    const v = localStorage.getItem(STORAGE_KEYS[kind]);
    return v && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Persist a preference. `null` or the default id clears it (= system default). */
export function saveDevicePreference(kind: DeviceKind, deviceId: string | null): void {
  try {
    if (deviceId && deviceId !== DEFAULT_ID) {
      localStorage.setItem(STORAGE_KEYS[kind], deviceId);
    } else {
      localStorage.removeItem(STORAGE_KEYS[kind]);
    }
  } catch {
    /* ignore — device preference is best-effort */
  }
}

/** The saved id iff still present in `available`; else undefined (default). */
export function pickDevice(
  saved: string | undefined,
  available: MediaDeviceInfo[],
): string | undefined {
  if (!saved) return undefined;
  return available.some((d) => d.deviceId === saved) ? saved : undefined;
}

/** Resolve the persisted preference against the currently available devices. */
export function resolveDevice(
  kind: DeviceKind,
  available: MediaDeviceInfo[],
): string | undefined {
  return pickDevice(loadDevicePreference(kind), available);
}

/** A display name for a device — its label, or a "Microphone 2"-style
 *  fallback when the browser hides labels (pre-permission). */
export function deviceLabel(
  device: MediaDeviceInfo | undefined,
  index: number,
  kind: DeviceKind,
): string {
  if (device?.label) return device.label;
  const noun =
    kind === "videoinput" ? "Camera" : kind === "audiooutput" ? "Speaker" : "Microphone";
  return `${noun} ${index + 1}`;
}

/** Human noun for a kind, for toasts/section headers. */
export function deviceKindNoun(kind: DeviceKind): string {
  return kind === "videoinput" ? "Camera" : kind === "audiooutput" ? "Speaker" : "Microphone";
}

/** Speaker (audiooutput) routing works only where the browser supports
 *  `setSinkId` (Chromium). Safari/Firefox hide the speaker section. */
export function speakerSelectionSupported(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}
