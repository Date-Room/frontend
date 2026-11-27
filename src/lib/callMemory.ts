/**
 * Whether THIS person was on the call in a room, remembered per room.
 *
 * George: "When I refresh the room page on web, it auto-starts a call.
 * It should only resume a call if I was in one already. I specifically.
 * Same as mobile. If I quit the app and rejoin, it should rejoin my
 * previous activity. If I was in a call, relaunch it, so I can
 * continue. If I was playing a game, relaunch that too."
 *
 * A session room auto-starts the call on entry, which is right the
 * first time — you opened a date room, the date is the point. The rule
 * ran on every page LOAD though, and a load cannot tell a first entry
 * from a refresh. So leaving the call and reloading put you straight
 * back into it, camera and all, having just said you did not want to
 * be there.
 *
 * The staged activity has always been remembered this way
 * (`dr:stage2:<roomId>`); the call was the half with no memory. Same
 * storage, so quitting the browser and coming back resumes both — and
 * `null`, meaning this room has never been recorded, is what keeps
 * first entry behaving as it always did.
 */

const KEY = "dr:oncall:v1";

type Memory = Record<string, boolean>;

function read(store: Storage | null): Memory {
  if (!store) return {};
  try {
    const raw = store.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Memory) : {};
  } catch {
    return {};
  }
}

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * What this room remembers: `true` on the call, `false` deliberately
 * out of it, `null` never recorded — which is a genuine first entry
 * and must NOT be read as "not on the call".
 */
export function wasOnCall(roomId: string, s: Storage | null = store()): boolean | null {
  const held = read(s)[roomId];
  return typeof held === "boolean" ? held : null;
}

/** Remember where this person is, so a reload can put them back. */
export function rememberCall(
  roomId: string,
  onCall: boolean,
  s: Storage | null = store(),
): void {
  if (!s) return;
  try {
    const all = read(s);
    all[roomId] = onCall;
    s.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the room simply has no memory, as before */
  }
}

/**
 * Pure: should the room start the call by itself on this load?
 *
 * Only for a session room that is still running and has no memory of
 * this person either way. Anything remembered is obeyed instead — that
 * is the whole point — and a room already in live mode needs no help.
 */
export function shouldAutoStartCall(args: {
  isPermanentRoom: boolean;
  expired: boolean;
  liveMode: boolean;
  remembered: boolean | null;
}): boolean {
  if (args.isPermanentRoom || args.expired || args.liveMode) return false;
  return args.remembered === null;
}
