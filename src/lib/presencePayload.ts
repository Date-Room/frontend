/**
 * What this tab publishes about itself, as one whole object.
 *
 * `presence.update` **replaces** the server's snapshot for a
 * connection — `channel.update_presence` is
 * `self._presence_snapshot[sub_id] = state`, not a merge — so every
 * publisher has to send every field. (A comment in mobile's
 * `presence.dart` says the server merges. It does not; mobile is only
 * safe because `_publishPresence` always sends the whole object.)
 *
 * This is what went wrong: `published.current` started as `{}` and the
 * initial `track(...)` wrote its payload straight to the channel
 * without ever recording it here. The first patch therefore merged
 * `{ activity_id }` onto nothing and replaced the tab's entire
 * presence record with `{ activity_id, last_seen }` — and the only
 * caller of the patch is "I opened an activity", so a web user
 * vanished as a person at the exact moment they became interesting to
 * everyone else:
 *
 *   - `photo_url` gone  → a blank avatar in the ongoing list
 *   - `display_name`    → a nameless face, and "Someone is in here"
 *   - `user_id`         → `personOf()` returns null, so web dropped
 *                         the activity from the ongoing list entirely
 *   - `is_in_call`      → no in-call halo, and `otherDeviceOnCall`
 *                         stopped seeing this tab
 *   - `participant_id`  → the host lost their handle to kick a guest
 *
 * Keeping the base and the merge here, pure and tested, is what stops
 * it coming back the next time someone adds a second patch caller.
 */

export type PresenceIdentity = {
  senderId: string;
  slot: string;
  isHost: boolean;
  displayName: string;
  photoUrl?: string | null;
  participantId?: string | null;
};

/** Everything this tab says about itself before anything has happened. */
export function basePresence(
  identity: PresenceIdentity,
  deviceId: string,
  now: string = new Date().toISOString(),
): Record<string, unknown> {
  return {
    // Web-legacy fields — kept for web code that still reads
    // sender_id / name / is_host.
    sender_id: identity.senderId,
    slot: identity.slot,
    name: identity.displayName,
    is_host: identity.isHost,
    // Canonical PresenceState fields — what the mobile client reads off
    // the wire. Sending both lets either client find the other
    // regardless of which schema it knows.
    user_id: identity.senderId,
    display_name: identity.displayName,
    photo_url: identity.photoUrl ?? null,
    // Mirror the mobile flags so cross-platform code paths (typing
    // dots, in-call halo) see consistent state.
    is_ready: true,
    is_typing: false,
    is_in_call: false,
    device_id: deviceId,
    last_seen: now,
    // Surfaces a stable handle to kick by; only guests have one.
    participant_id: identity.participantId ?? null,
    // Nothing open yet: in the room itself.
    activity_id: null,
  };
}

/**
 * The next whole object to publish: what we were saying, plus the one
 * thing the caller came to change.
 *
 * `last_seen` always moves, because any update is also a heartbeat.
 */
export function mergePresence(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  now: string = new Date().toISOString(),
): Record<string, unknown> {
  return { ...current, ...patch, last_seen: now };
}

/**
 * Fields that identify the person rather than describe the moment.
 *
 * A published object missing any of these is the bug above: the tab is
 * still connected and still in the room, but nobody can tell who it
 * is.
 */
export const IDENTIFYING_KEYS = [
  "sender_id",
  "user_id",
  "name",
  "display_name",
  "photo_url",
] as const;

/**
 * Who just walked in, so this tab can say again what it has open.
 *
 * George: "the host already had the most likely to game opened.. but it
 * doesn't show as ongoing activity on the users who also just joined
 * the night. I guess the event only fires when the host manually joins.
 * But at the start of the call, we need to check what's opened and
 * share that.."
 *
 * The server does hand a joiner the whole presence snapshot, so what is
 * open should already be in it. The weakness is that this leaves every
 * arrival at the mercy of everyone else's LAST publish having been
 * right — and when one is wrong it stays wrong for the rest of the
 * night. Which is what happened: a bug republished "not in a game" a
 * frame after announcing the game, and the snapshot kept the last thing
 * it was told.
 *
 * So each client re-announces when somebody new appears, and the room
 * repairs itself. `seen` is the caller's memory of this room and is
 * updated in place; the return value says whether to publish.
 *
 * Keyed per CONNECTION, not per account: the same person in two tabs is
 * two arrivals, and each of them needs telling.
 *
 * It cannot storm. Only an id not already in `seen` counts, so the
 * publish this triggers reaches everyone else as an arrival of nobody
 * and stops there. Departures are pruned, so somebody who drops and
 * comes back counts again — which is exactly when they need telling.
 */
export function noteArrivals(
  presence: ReadonlyArray<Record<string, unknown>>,
  seen: Set<string>,
  me?: { senderId?: string | null; deviceId?: string | null },
): boolean {
  const now = new Set<string>();
  let arrived = false;
  for (const p of presence) {
    const user = typeof p.user_id === "string" && p.user_id ? p.user_id : p.sender_id;
    const device = typeof p.device_id === "string" ? p.device_id : "";
    const key = `${typeof user === "string" ? user : ""}|${device}`;
    now.add(key);
    // My own entry is not an arrival.
    if (me?.senderId && user === me.senderId && device === (me.deviceId ?? "")) continue;
    if (!seen.has(key)) {
      seen.add(key);
      arrived = true;
    }
  }
  for (const key of [...seen]) if (!now.has(key)) seen.delete(key);
  return arrived;
}
