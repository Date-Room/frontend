/**
 * recapNight — reduces a room's recap payload (final activity states + the
 * event log) into the Tonight page's shape: three figures, the proportional
 * arc of the night, one outcome card per room (a RESULT, not a status), and
 * the explicit keepsakes. Outcomes are computed from each game's own final
 * reducer state via its fromJson parser, so every sentence is exact.
 */
import type {
  ActivityEventResponse,
  ActivityStateResponse,
} from "@/lib/activities/activityState";
import { twoTruthsFromJson } from "@/lib/activities/twoTruths";
import { totFromJson, TOT_ROUNDS_PER_RUN } from "@/lib/activities/thisOrThat";
import { ohtgFromJson } from "@/lib/activities/oneHasToGo";
import { todFromJson } from "@/lib/activities/truthOrDare";
import { obFromJson, buildObDeck } from "@/lib/activities/openBook";
import { clFromJson, CL_TOTAL, CL_QUESTIONS } from "@/lib/activities/closer";

export type NightKind = "game" | "talk" | "shared";

export type NightCard = {
  id: string;
  name: string;
  kind: NightKind;
  outcome: string;
  figure?: { value: string; label: string };
  span: string;
  minutes: number;
  moments: { at: string; who: string; text: string }[];
};

export type NightKeepsake = { text: string; from: string; by: string };

export type Night = {
  sentence: string;
  figures: { value: string; label: string }[];
  cards: NightCard[];
  keepsakes: NightKeepsake[];
  logCount: number;
};

export const NIGHT_NAMES: Record<string, { name: string; kind: NightKind }> = {
  questions: { name: "Open Book", kind: "talk" },
  the_36: { name: "Closer", kind: "talk" },
  this_or_that: { name: "This or That", kind: "game" },
  "2_truths": { name: "Two Truths & a Lie", kind: "game" },
  truth_or_dare: { name: "Truth or Dare", kind: "game" },
  one_has_to_go: { name: "One Has To Go", kind: "game" },
  pick_a_door: { name: "Pick a Door", kind: "game" },
  rank_it: { name: "Rank It", kind: "game" },
  watch: { name: "Watch Together", kind: "shared" },
  dj: { name: "Listen Together", kind: "shared" },
  chat: { name: "Chat", kind: "shared" },
};

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

function sumValues(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + b, 0);
}

/** One sentence of RESULT plus an optional headline figure, per activity. */
export function nightOutcome(
  a: ActivityStateResponse,
): { outcome: string; figure?: { value: string; label: string } } {
  const s = a.state ?? {};
  switch (a.activity_id) {
    case "2_truths": {
      const t = twoTruthsFromJson(s);
      if (t.rounds_played === 0) return { outcome: "Opened, but nobody lied yet." };
      const pts = sumValues(t.scores);
      return {
        outcome: `${plural(t.rounds_played, "round")} of bluffing. ${plural(pts, "point")} changed hands between you.`,
        figure: { value: String(t.rounds_played), label: "rounds" },
      };
    }
    case "this_or_that": {
      const t = totFromJson(s);
      const done = t.log.length;
      if (done === 0) return { outcome: "Opened, but no picks were made." };
      const reads = sumValues(t.reads);
      return {
        outcome: `Same side on ${t.same_count} of ${done}. You called each other right ${plural(reads, "time")}.`,
        figure: { value: `${t.same_count} / ${Math.max(done, TOT_ROUNDS_PER_RUN)}`, label: "same side" },
      };
    }
    case "one_has_to_go": {
      const t = ohtgFromJson(s);
      if (t.rounds_played === 0 && Object.keys(t.cuts).length === 0)
        return { outcome: "Opened, but nothing was cut." };
      const reads = sumValues(t.reads);
      return {
        outcome: `${plural(t.rounds_played, "cut")} made. ${plural(reads, "correct read")} between you.`,
        figure: { value: String(reads), label: "reads" },
      };
    }
    case "truth_or_dare": {
      const t = todFromJson(s);
      const tokens = sumValues(t.tokens);
      if (t.turn === 0 && tokens === 0 && t.phase === "deck")
        return { outcome: "The deck stayed on the table." };
      return {
        outcome: `${plural(tokens, "token")} earned. ${t.vault.length > 0 ? `${plural(t.vault.length, "card")} in the vault, waiting.` : "Nothing dodged, nothing burned."}`,
        figure: t.vault.length > 0 ? { value: String(t.vault.length), label: "in the vault" } : undefined,
      };
    }
    case "questions": {
      const t = obFromJson(s);
      if (t.phase === "setup" || t.phase === "draft") return { outcome: "The topics were still being drafted." };
      const deckLen = t.phase === "play" || t.phase === "done" ? buildObDeck(t).length : t.target;
      const asked = t.phase === "done" ? deckLen : Math.min(t.card, deckLen);
      return {
        outcome: `${asked} of ${deckLen} questions asked${t.passes.length ? `, ${t.passes.length} passed for later` : ""}.`,
        figure: { value: String(asked), label: "questions asked" },
      };
    }
    case "the_36": {
      const t = clFromJson(s);
      if (t.phase === "setup") return { outcome: "Opened, but the first stretch never started." };
      const at = Math.min(t.n + 1, CL_TOTAL);
      if (t.banked) {
        const set = CL_QUESTIONS[Math.min(t.n, CL_TOTAL - 1)].set;
        return {
          outcome: `You stopped at question ${at}, on purpose. Set ${set} is where you pick up.`,
          figure: { value: `${at} / ${CL_TOTAL}`, label: "banked, not finished" },
        };
      }
      if (t.did_eyes)
        return {
          outcome: "You went all the way through, and sat in the four minutes of silence.",
          figure: { value: `${CL_TOTAL} / ${CL_TOTAL}`, label: "plus the silence" },
        };
      return { outcome: `${at} questions in.`, figure: { value: `${at} / ${CL_TOTAL}`, label: "asked" } };
    }
    case "watch":
      return { outcome: s.video_id ? "Watched something together, in step." : "Opened, but never pressed play." };
    case "dj": {
      const np = s.now_playing as { title?: string } | null;
      return { outcome: np?.title ? `The night ended on "${np.title}".` : "Took turns on the aux." };
    }
    case "chat": {
      const n = Array.isArray(s.messages) ? s.messages.length : 0;
      return { outcome: n ? `${plural(n, "message")} on the side.` : "All talk, no typing." };
    }
    default:
      return { outcome: "Saved from tonight." };
  }
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function buildNight(
  activities: ActivityStateResponse[],
  events: ActivityEventResponse[],
  opts: { myUserId?: string | null; partnerName?: string | null },
): Night {
  const known = activities.filter((a) => NIGHT_NAMES[a.activity_id]);

  const byActivity = new Map<string, ActivityEventResponse[]>();
  for (const e of events) {
    const list = byActivity.get(e.activity_id) ?? [];
    list.push(e);
    byActivity.set(e.activity_id, list);
  }

  const cards: NightCard[] = known.map((a) => {
    const meta = NIGHT_NAMES[a.activity_id];
    const evs = (byActivity.get(a.activity_id) ?? []).slice().sort((x, y) => x.created_at.localeCompare(y.created_at));
    const first = evs[0]?.created_at;
    const last = evs[evs.length - 1]?.created_at;
    const minutes = first && last ? Math.max(1, Math.round((Date.parse(last) - Date.parse(first)) / 60000)) : 1;
    const seen = new Set<string>();
    const moments = evs
      .map((e) => ({
        at: hhmm(e.created_at),
        who: e.actor_display_name || "Guest",
        text: typeof e.payload?.text === "string" ? (e.payload.text as string) : "",
      }))
      .filter((m) => {
        if (!m.text || seen.has(m.text)) return false;
        seen.add(m.text);
        return true;
      })
      .slice(-8);
    const { outcome, figure } = nightOutcome(a);
    return {
      id: a.activity_id,
      name: meta.name,
      kind: meta.kind,
      outcome,
      figure,
      span: first && last ? `${hhmm(first)} – ${hhmm(last)}` : "",
      minutes,
      moments,
    };
  });
  // Chronological by first event; stateless-but-known activities sink to the end.
  cards.sort((x, y) => {
    const fx = byActivity.get(x.id)?.[0]?.created_at ?? "9999";
    const fy = byActivity.get(y.id)?.[0]?.created_at ?? "9999";
    return fx.localeCompare(fy);
  });

  // Keepsakes: Closer's typed keep-notes are the only explicit keeps.
  const keepsakes: NightKeepsake[] = [];
  const closerState = known.find((a) => a.activity_id === "the_36");
  if (closerState) {
    const t = clFromJson(closerState.state ?? {});
    for (const k of t.keeps) {
      keepsakes.push({
        text: k.note,
        from: "Closer",
        by: opts.myUserId && k.by === opts.myUserId ? "You" : opts.partnerName ?? "Them",
      });
    }
  }

  const sorted = events.slice().sort((x, y) => x.created_at.localeCompare(y.created_at));
  const firstAt = sorted[0]?.created_at;
  const lastAt = sorted[sorted.length - 1]?.created_at;
  const totalMin = firstAt && lastAt ? Math.max(1, Math.round((Date.parse(lastAt) - Date.parse(firstAt)) / 60000)) : 0;
  const timeWord = totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`;

  const figures = [
    ...(totalMin > 0 ? [{ value: timeWord, label: "first move to last" }] : []),
    { value: String(cards.length), label: cards.length === 1 ? "room opened" : "rooms opened" },
    keepsakes.length > 0
      ? { value: String(keepsakes.length), label: keepsakes.length === 1 ? "line kept" : "lines kept" }
      : { value: String(events.length), label: "moments logged" },
  ];

  const games = cards.filter((c) => c.kind === "game").length;
  const talks = cards.filter((c) => c.kind === "talk").length;
  const sentenceParts: string[] = [];
  if (cards.length > 0) sentenceParts.push(plural(cards.length, "room"));
  if (games > 0 && talks > 0) sentenceParts.push("games and one long conversation");
  else if (talks > 0) sentenceParts.push("one long conversation");
  else if (games > 0) sentenceParts.push("a night of games");
  if (keepsakes.length > 0) sentenceParts.push(`${keepsakes.length} thing${keepsakes.length === 1 ? "" : "s"} you decided to keep`);
  const sentence =
    sentenceParts.length > 0 ? `${sentenceParts.join(", ")}.` : "A look back at what you did together.";

  return { sentence, figures, cards, keepsakes, logCount: events.length };
}
