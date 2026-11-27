/**
 * This tab's own marker in room presence, so a device can tell its own
 * presence from the same account's other devices (an account on two
 * devices has one presence entry per connection). Per TAB; never sent
 * anywhere but the room's presence.
 *
 * It used to be minted per page LOAD, which quietly broke refresh.
 *
 * George: "I refreshed, and now I can't rejoin the room on any of the
 * users" / "I start a call, it doesn't work.. cos others can't join.
 * Keeps saying waiting."
 *
 * A reload opens the new socket before the old one has finished
 * closing, so for a moment the server's snapshot holds BOTH
 * connections for that account. With a new id each load, the reloaded
 * tab looked at its own pre-refresh ghost, saw `is_in_call` under a
 * different device id, and concluded the call was somewhere else — so
 * `RoomVideo` took the "move it here?" branch and never asked for a
 * LiveKit token at all. Nothing failed and nothing errored: the client
 * simply never tried, and sat on "waiting" for good.
 *
 * sessionStorage is exactly the lifetime the doc comment always
 * claimed: it survives a reload of this tab, and a second tab (or a
 * second window) gets its own. A crashed-and-reopened tab starts a new
 * session too, so a phone or laptop never goes invisible to itself.
 */
import type { PresenceState } from "@/lib/realtime/roomChannel";

const KEY = "dr_tab_device_id";

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

/** The id for this tab, reused across reloads of it. Storage can throw
 *  (private mode, blocked site data) — then it is per load again, which
 *  is the old behaviour and still correct, just not refresh-proof. */
export function tabDeviceId(store?: Storage): string {
  const s = store ?? (typeof sessionStorage === "undefined" ? null : sessionStorage);
  if (!s) return makeId();
  try {
    const held = s.getItem(KEY);
    if (held) return held;
    const minted = makeId();
    s.setItem(KEY, minted);
    return minted;
  } catch {
    return makeId();
  }
}

export const TAB_DEVICE_ID = tabDeviceId();

/** Pure: is this account already on the call from another device? Entries
 *  without a device marker come from older clients, so they count as
 *  another device too. */
export function otherDeviceOnCall(presence: PresenceState[], userId: string, deviceId: string): boolean {
  if (!userId) return false;
  return presence.some(
    (p) =>
      (p.user_id === userId || p.sender_id === userId) &&
      p.is_in_call === true &&
      p.device_id !== deviceId,
  );
}
