// The twin of mobile's activity_presence_test.dart — case for case.
// Two clients looking at the same room must not disagree about who is
// in a game.
import { describe, expect, it } from "vitest";
import { amIn, partiesFrom, partyLine } from "@/lib/activityParties";

const who = (id: string, name: string, activity?: string, at = 0) => ({
  user_id: id,
  display_name: name,
  activity_id: activity ?? null,
  last_seen: new Date(Date.UTC(2026, 0, 1, 0, at)).toISOString(),
});

describe("who is doing what", () => {
  it("people in the room itself are in no party", () => {
    expect(partiesFrom([who("a", "Ama"), who("b", "Jun")], "a")).toEqual([]);
  });

  it("two sides at once are both reported, busiest first", () => {
    const parties = partiesFrom(
      [
        who("a", "Ama", "watch", 1),
        who("b", "Jun", "game_imposter", 2),
        who("c", "Tee", "game_imposter", 3),
        who("d", "Kemi"),
      ],
      "d",
    );
    expect(parties.map((p) => p.activityId)).toEqual(["game_imposter", "watch"]);
    expect(parties[0].people.map((p) => p.displayName)).toEqual(["Jun", "Tee"]);
    expect(parties[1].people).toHaveLength(1);
  });

  it("the one who started it is the first face", () => {
    const parties = partiesFrom(
      [who("c", "Tee", "watch", 9), who("a", "Ama", "watch", 1), who("b", "Jun", "watch", 4)],
      "z",
    );
    expect(parties[0].people.map((p) => p.displayName)).toEqual(["Ama", "Jun", "Tee"]);
  });

  it("a party of only me is not something to be invited to", () => {
    expect(partiesFrom([who("a", "Ama", "dj")], "a")).toEqual([]);
    const joined = partiesFrom([who("a", "Ama", "dj", 1), who("b", "Jun", "dj", 2)], "a");
    expect(joined[0].people.map((p) => p.displayName)).toEqual(["Jun"]);
  });

  it("one person on two devices is one face", () => {
    const parties = partiesFrom([who("a", "Ama", "watch", 1), who("a", "Ama", "watch", 2)], "z");
    expect(parties[0].people).toHaveLength(1);
  });

  it("reads the legacy web presence shape too", () => {
    // Older tabs publish sender_id/name rather than user_id/display_name.
    const parties = partiesFrom(
      [{ sender_id: "a", name: "Ama", activity_id: "watch", last_seen: "" }],
      "z",
    );
    expect(parties[0].people[0].displayName).toBe("Ama");
  });

  it("amIn knows where I am", () => {
    const presence = [who("a", "Ama", "watch"), who("b", "Jun", "dj")];
    expect(amIn(presence, "watch", "a")).toBe(true);
    expect(amIn(presence, "dj", "a")).toBe(false);
    expect(amIn(presence, "watch", null)).toBe(false);
  });

  it("reads the line the way you would say it", () => {
    expect(partyLine({ activityId: "x", people: [{ userId: "a", displayName: "Jun", photoUrl: null }] }))
      .toBe("Jun is in here");
    expect(
      partyLine({
        activityId: "x",
        people: [
          { userId: "a", displayName: "Ama", photoUrl: null },
          { userId: "b", displayName: "Jun", photoUrl: null },
          { userId: "c", displayName: "Tee", photoUrl: null },
        ],
      }),
    ).toBe("Ama, Jun and Tee are in here");
  });
});
