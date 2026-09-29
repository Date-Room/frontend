import { describe, expect, it } from "vitest";
import type { SquadMember, SquadNight } from "@/lib/squad";
import {
  hereLine,
  hereNow,
  isAutoStarter,
  nightLine,
  otherClocks,
  plannedStartDue,
  suggestedTime,
  toLocalInput,
} from "@/lib/squadRoom";

const member = (user_id: string, display_name: string): SquadMember => ({
  participant_id: `p-${user_id}`,
  user_id,
  display_name,
  photo_url: null,
  city: null,
  tz: null,
  role: "member",
  joined_at: "2026-09-01T00:00:00Z",
  new: false,
});

describe("hereNow", () => {
  it("dedupes people with two tabs and names them from the squad", () => {
    const people = hereNow(
      [{ user_id: "u1", display_name: "W" }, { user_id: "u1" }, { sender_id: "u2", name: "Amaka?" }],
      [member("u1", "Wanjiru"), member("u2", "Amaka")],
    );
    expect(people.map((p) => p.name)).toEqual(["Wanjiru", "Amaka"]);
  });

  it("keeps someone who just joined and isn't on the list yet", () => {
    expect(hereNow([{ user_id: "u9", display_name: "Kofi" }], [])[0].name).toBe("Kofi");
  });
});

describe("hereLine", () => {
  const p = (userId: string, name: string) => ({ userId, name, member: null });
  it("reads naturally", () => {
    expect(hereLine([], "me")).toBe("Nobody's here yet");
    expect(hereLine([p("me", "W")], "me")).toBe("Just you for now");
    expect(hereLine([p("a", "Amaka")], "me")).toBe("Amaka is here");
    expect(hereLine([p("me", "W"), p("a", "Amaka")], "me")).toBe("You and Amaka are here");
    expect(hereLine([p("me", "W"), p("a", "Amaka"), p("b", "Kofi")], "me")).toBe(
      "You, Amaka and Kofi are here",
    );
  });
});

describe("planned start", () => {
  it("is due from the planned time for 3 hours", () => {
    const at = "2026-10-03T17:30:00Z";
    const t = new Date(at).getTime();
    expect(plannedStartDue(at, t - 1000)).toBe(false);
    expect(plannedStartDue(at, t)).toBe(true);
    expect(plannedStartDue(at, t + 3 * 3600_000 + 1)).toBe(false);
    expect(plannedStartDue(null, t)).toBe(false);
  });

  it("picks one starter so browsers don't race", () => {
    const people = [
      { userId: "b", name: "B", member: null },
      { userId: "a", name: "A", member: null },
    ];
    expect(isAutoStarter(people, "a")).toBe(true);
    expect(isAutoStarter(people, "b")).toBe(false);
  });
});

describe("otherClocks", () => {
  it("shows each other zone once, with the city", () => {
    const lines = otherClocks(
      "2026-10-03T17:30:00Z",
      [
        { participant_id: "1", display_name: "Wanjiru", city: "Nairobi", tz: "Africa/Nairobi" },
        { participant_id: "2", display_name: "Amaka", city: "Lagos", tz: "Africa/Lagos" },
        { participant_id: "3", display_name: "Tobi", city: null, tz: "Africa/Lagos" },
        { participant_id: "4", display_name: "Sam", city: null, tz: "America/New_York" },
      ],
      "Africa/Nairobi",
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Amaka & Tobi 6:30\sPM Lagos$/);
    expect(lines[1]).toMatch(/^Sam 1:30\sPM New York$/);
  });
});

describe("times", () => {
  it("suggests the next 8 PM at least an hour away", () => {
    expect(suggestedTime(new Date(2026, 9, 3, 12, 0)).getDate()).toBe(3);
    expect(suggestedTime(new Date(2026, 9, 3, 19, 30)).getDate()).toBe(4);
  });

  it("formats a datetime-local value", () => {
    expect(toLocalInput(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05T09:07");
  });
});

describe("nightLine", () => {
  const base: SquadNight = {
    id: "n",
    number: 1,
    started_at: "2026-09-26T18:00:00Z",
    ends_at: "2026-09-26T20:00:00Z",
    seats: 4,
    rate: "pack",
    refunded: false,
    extended_minutes: 30,
  };
  it("shows extensions, free nights and refunds", () => {
    expect(nightLine(base)).toMatch(/4 seats · 2h \+ 30 min$/);
    expect(nightLine({ ...base, rate: "free", extended_minutes: 0 })).toMatch(/free night$/);
    expect(nightLine({ ...base, refunded: true })).toMatch(/didn't count/);
  });
});
