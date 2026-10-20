/**
 * This tab's own marker in room presence, so a device can tell its own
 * presence from the same account's other devices (an account on two
 * devices has one presence entry per connection). New per tab and per
 * page load; never sent anywhere but the room's presence.
 */
import type { PresenceState } from "@/lib/realtime/roomChannel";

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

export const TAB_DEVICE_ID = makeId();

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
