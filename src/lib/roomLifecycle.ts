/**
 * Everything a resting room says and shows, derived from the Room row.
 *
 * The server owns the rules (`lapse_stage`, `capabilities`, `closes_at`);
 * this module only turns them into words, a colour and a progress bar.
 * Copy mirrors the backend's `lapse_copy.py` so the banner and the email
 * never drift. The room speaks for itself: never "account", "frozen" or
 * "non-payment", one warm ramp losing light, one renew verb.
 */

import { ALL_CAPABILITIES, type Room, type RoomCapabilities } from "@/lib/rooms";

export type LifecycleTone = "notice" | "quiet" | "keepsake" | "closing" | "closed";

export type LifecycleView = {
  tone: LifecycleTone;
  /** Small tracked-caps line above the headline; user-facing facts only. */
  eyebrow: string;
  headline: string;
  body: string;
  /** 0..1 of the way from day 0 to the close date; null when no clock runs. */
  progress: number | null;
  closesAt: Date | null;
  showKeep: boolean;
  showSaveCopy: boolean;
  showSnooze: boolean;
  /** Closing window only. */
  closing: {
    requestedByMe: boolean;
    confirmed: boolean;
  } | null;
};

export function roomCapabilities(room: Pick<Room, "capabilities"> | undefined): RoomCapabilities {
  return room?.capabilities ?? ALL_CAPABILITIES;
}

/** A persistent room that is dimming, closing or closed. */
export function isResting(room: Room | undefined): boolean {
  if (!room || room.persistence !== "persistent") return false;
  return room.state === "sub_lapsed" || room.state === "closing" || room.state === "purged";
}

export function roomLabel(room: Pick<Room, "greeting_headline" | "code">): string {
  return room.greeting_headline?.trim() || `your room ${room.code}`;
}

/** "Friday nights'" not "Friday nights's". */
function possessive(label: string): string {
  return /s$/i.test(label) ? `${label}'` : `${label}'s`;
}

/** "19 Oct" in the viewer's zone. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "soon";
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString(undefined, { month: "short" })}`;
}

function daysUntil(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n ? n.split(/\s+/)[0] : "Your partner";
}

/**
 * The banner for this room, or null when it is healthy.
 * `meId` decides which side of a closing window the viewer is on;
 * `partnerName` is only used in closing copy.
 */
export function lifecycleView(
  room: Room | undefined,
  opts: { meId?: string | null; partnerName?: string | null; now?: number } = {},
): LifecycleView | null {
  if (!room || room.persistence !== "persistent") return null;
  const now = opts.now ?? Date.now();
  const label = roomLabel(room);
  const closesAt = room.closes_at ? new Date(room.closes_at) : null;
  const closeDate = shortDate(room.closes_at);

  const progress = (() => {
    if (!room.lapsed_at || !room.closes_at) return null;
    const start = new Date(room.lapsed_at).getTime();
    const end = new Date(room.closes_at).getTime();
    if (end <= start) return 1;
    return Math.min(1, Math.max(0, (now - start) / (end - start)));
  })();

  if (room.state === "purged") {
    return {
      tone: "closed",
      eyebrow: "Closed",
      headline: `${label} closed on ${closeDate}`,
      body: "Thanks for the nights you spent here. If you'd like a new room, it's one tap away.",
      progress: null,
      closesAt,
      showKeep: false,
      showSaveCopy: false,
      showSnooze: false,
      closing: null,
    };
  }

  if (room.state === "closing" && room.closing) {
    const requestedByMe = !!opts.meId && room.closing.requested_by === opts.meId;
    const who = requestedByMe ? "You" : firstName(opts.partnerName);
    const hours = room.closing.ends_at
      ? Math.max(0, Math.round((new Date(room.closing.ends_at).getTime() - now) / 3_600_000))
      : null;
    return {
      tone: "closing",
      eyebrow: hours === null ? "Closing" : `Closing · ${hours}h left`,
      headline: `${who} asked to close ${label}`,
      body: requestedByMe
        ? "It closes in 72 hours unless one of you keeps it. Your partner can save a copy first."
        : "It closes in 72 hours unless one of you keeps it. You can save a copy first.",
      progress: room.closing.ends_at && room.lapsed_at ? progress : null,
      closesAt: room.closing.ends_at ? new Date(room.closing.ends_at) : closesAt,
      showKeep: true,
      showSaveCopy: true,
      showSnooze: false,
      closing: { requestedByMe, confirmed: room.closing.confirmed },
    };
  }

  if (room.state !== "sub_lapsed") return null;
  const stage = room.lapse_stage ?? "notice";
  const left = daysUntil(room.closes_at, now);
  const leftLine = left === null ? "" : ` · ${left} day${left === 1 ? "" : "s"} left`;

  if (stage === "notice") {
    return {
      tone: "notice",
      eyebrow: `Month ended${leftLine}`,
      headline: `${possessive(label)} month has ended`,
      body: "Nothing changes for the next 7 days. Either of you can keep it going.",
      progress,
      closesAt,
      showKeep: true,
      showSaveCopy: false,
      showSnooze: true,
      closing: null,
    };
  }
  if (stage === "quiet") {
    return {
      tone: "quiet",
      eyebrow: `Resting · closes ${closeDate}`,
      headline: `${label} has gone quiet`,
      body:
        "Your wall, journal and photos are all here. Calls and games are resting until one of you picks the room back up.",
      progress,
      closesAt,
      showKeep: true,
      showSaveCopy: false,
      showSnooze: false,
      closing: null,
    };
  }
  return {
    tone: "keepsake",
    eyebrow: `Read only · closes ${closeDate}`,
    headline: `We're keeping ${label} safe until ${closeDate}`,
    body: "You can look back, but not add to it. After that date the room closes and what's inside goes with it.",
    progress,
    closesAt,
    showKeep: true,
    showSaveCopy: true,
    showSnooze: false,
    closing: null,
  };
}

/** What a resting control says when tapped. */
export function restingReason(cap: keyof RoomCapabilities, room: Room | undefined): string {
  const label = room ? roomLabel(room) : "This room";
  switch (cap) {
    case "can_call":
      return `${label} is resting, so calls are paused. Keep the room to pick up where you left off.`;
    case "can_play":
      return `${label} is resting, so games are paused. Keep the room to play again.`;
    case "can_write":
      return `${label} is read only for now. Keep the room to add to it.`;
    case "can_invite":
      return `${label} isn't taking new people while it rests.`;
    default:
      return `${label} is resting.`;
  }
}

/* ---- Notice snooze (per viewer, per room, 24h; a convenience only) ---- */

const SNOOZE_KEY = "dateroom.lifecycle.snooze";

export function isSnoozed(roomId: string, now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return typeof map[roomId] === "number" && map[roomId] > now;
  } catch {
    return false;
  }
}

export function snooze(roomId: string, hours = 24): void {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[roomId] = Date.now() + hours * 3_600_000;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
  } catch {
    /* private mode: the banner simply stays */
  }
}

/** Hand the browser a zip the API returned. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
