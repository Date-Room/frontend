/**
 * How a room names the people in it.
 *
 * Two rules, both about being recognised. A social room only works if
 * everyone can tell who is who, so the identity of a face is not a
 * detail to be filled in with whatever is left over.
 *
 * **Never a question mark.** A "?" on a face reads as *unknown person*,
 * or worse as a bug, where the truth is only ever "no photo, and no
 * name on this presence record". A silhouette says that without
 * accusing anyone of being a mystery. So `initialOf` returns null
 * rather than a stand-in, and the caller draws a person.
 *
 * **"You", not my own name.** Seeing your own name in the third person
 * — "Jun's turn", "Jun is in here" — reads like being talked about.
 * Second person is what every room app settled on (Meet, Slack,
 * Discord: "You"), and `squadGames.ts` has used it in the reveal
 * captions all along; this is that choice, made once, for everywhere
 * else.
 *
 * The twin of mobile's `lib/people.dart`.
 */

/** Second person, for the one person reading the screen. */
export const YOU = "You";

/** When there is genuinely no name to show. Not "?", and not a blank. */
export const SOMEONE = "Someone";

/**
 * The letter to draw on a face, or null when there is none to draw.
 *
 * Takes the first letter *or digit*, not the first character: a name
 * that opens with a quote, a bracket or an emoji ("🎀 Tee") would
 * otherwise put punctuation on the face, which looks like a glitch. A
 * name made only of symbols has no initial at all, and null is the
 * honest answer — the caller draws a silhouette.
 */
export function initialOf(name: string | null | undefined): string | null {
  if (!name) return null;
  for (const ch of name.trim()) {
    // Unicode-aware: accented and non-Latin names have initials too.
    if (/\p{L}|\p{N}/u.test(ch)) return ch.toLocaleUpperCase();
  }
  return null;
}

/**
 * What to call someone on screen.
 *
 * `isMe` wins over everything: my own name is never the right label
 * for me, even when it is known.
 */
export function personName(
  name: string | null | undefined,
  isMe = false,
): string {
  if (isMe) return YOU;
  const trimmed = name?.trim();
  return trimmed ? trimmed : SOMEONE;
}

/**
 * A list of names, in the order given, as a phrase: "Ama", "Ama and
 * Jun", "Ama, Jun and Tee".
 */
export function listPeople(names: string[]): string {
  const real = names.filter((n) => n.trim());
  if (real.length === 0) return SOMEONE;
  if (real.length === 1) return real[0];
  return `${real.slice(0, -1).join(", ")} and ${real[real.length - 1]}`;
}

/**
 * Subject + verb for a phrase about these people, conjugated for who
 * they are: "You are", "Jun is", "Jun and Tee are".
 *
 * The agreement is the part that is easy to get wrong and impossible
 * to miss once it is: "Jun are in here" and "You is in here" both read
 * as broken software. `includesMe` is separate from the names because
 * "You" takes a plural verb while being one person.
 */
export function peopleAre(
  names: string[],
  opts: { includesMe?: boolean } = {},
): { subject: string; verb: string } {
  const includesMe = opts.includesMe ?? false;
  const others = names.filter((n) => n.trim());
  const parts = includesMe ? [YOU, ...others] : others;
  if (parts.length === 0) return { subject: SOMEONE, verb: "is" };
  // "You" is grammatically plural even alone, and so is any group.
  const plural = parts.length > 1 || includesMe;
  return { subject: listPeople(parts), verb: plural ? "are" : "is" };
}
