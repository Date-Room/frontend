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

/**
 * How long a record is worth obeying.
 *
 * George, again, in a squad room: "when I refresh the page, it joins
 * call. It wasn't on a call before I refreshed."
 *
 * "I was on the call" was written when you joined and cleared only when
 * you pressed Leave — so closing the tab while on a call, or losing the
 * laptop's battery, left a `true` behind that never expired. Every
 * later visit to that room then read it as an instruction and put you
 * back on a call you had been nowhere near, which is the complaint that
 * started this file, arriving through a second door.
 *
 * A memory of where you were is only useful while it is still true of
 * you. Ten minutes covers what the memory is FOR — a refresh, a crash,
 * a tab closed by accident, a quick reopen — and stops well short of
 * "I came back to this room later", where being dropped into a call
 * uninvited is exactly what nobody wants.
 */
export const MEMORY_GOOD_FOR_MS = 10 * 60 * 1000;

/** `true`/`false` is the old shape, still in people's browsers. */
type Record_ = boolean | { on: boolean; at: number };
type Memory = Record<string, Record_>;

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
 * out of it, `null` never recorded OR no longer recent enough to be
 * worth obeying (see [MEMORY_GOOD_FOR_MS]). `null` is a genuine first
 * entry and must NOT be read as "not on the call".
 */
export function wasOnCall(
  roomId: string,
  s: Storage | null = store(),
  now: number = Date.now(),
): boolean | null {
  const held = read(s)[roomId];
  // The old shape carried no time, so it cannot be shown to be fresh.
  // Letting it through is what put people back on month-old calls.
  if (typeof held !== "object" || held === null) return null;
  if (typeof held.on !== "boolean" || typeof held.at !== "number") return null;
  if (now - held.at > MEMORY_GOOD_FOR_MS || held.at > now) return null;
  return held.on;
}

/** Remember where this person is, so a reload can put them back. */
export function rememberCall(
  roomId: string,
  onCall: boolean,
  s: Storage | null = store(),
  now: number = Date.now(),
): void {
  if (!s) return;
  try {
    const all = read(s);
    all[roomId] = { on: onCall, at: now };
    s.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the room simply has no memory, as before */
  }
}

/**
 * Pure: should the room start the call by itself on this load?
 *
 * Only for a two-person session room that is still running and has no
 * memory of this person either way. Anything remembered is obeyed
 * instead — that is the whole point — and a room already in live mode
 * needs no help.
 *
 * Never for a group room. Auto-starting is a date room's argument: two
 * people opened a room for each other and the call IS the date, so
 * dialling it is doing what they asked. A squad night is a place you
 * walk into — the stage, the games, the lobby, five people arriving
 * over ten minutes — and it has a call button of its own precisely
 * because joining the call there is a decision somebody makes. Starting
 * it for them turns a camera on in a room they only just opened.
 */
export function shouldAutoStartCall(args: {
  isPermanentRoom: boolean;
  isGroupRoom: boolean;
  expired: boolean;
  liveMode: boolean;
  remembered: boolean | null;
}): boolean {
  if (args.isPermanentRoom || args.isGroupRoom || args.expired || args.liveMode) {
    return false;
  }
  return args.remembered === null;
}
