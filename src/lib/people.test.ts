// A social room only works if everyone can tell who is who.
//
// Two rules: a face never shows "?" (it reads as "unknown person", or
// as a bug, when the truth is just "no photo and no name on this
// record"), and nobody is addressed by their own name in the third
// person.
import { describe, expect, it } from "vitest";
import { YOU, initialOf, listPeople, peopleAre, personName } from "@/lib/people";

describe("initialOf", () => {
  it("takes the first letter, uppercased", () => {
    expect(initialOf("jun")).toBe("J");
    expect(initialOf("  tee  ")).toBe("T");
  });

  it("skips punctuation and emoji to reach the name", () => {
    // "🎀 Tee" used to put a ribbon — or a quote mark — on the face,
    // which reads as a rendering glitch rather than as a person.
    expect(initialOf("🎀 Tee")).toBe("T");
    expect(initialOf('"Ama"')).toBe("A");
    expect(initialOf("(jun)")).toBe("J");
  });

  it("handles names that are not Latin", () => {
    expect(initialOf("Ада")).toBe("А");
    expect(initialOf("أحمد")).toBe("أ");
    expect(initialOf("Ömer")).toBe("Ö");
  });

  it("returns null when there is no letter to draw", () => {
    // The caller draws a silhouette. Null is the whole point: a
    // stand-in character here is what produced the "?" faces.
    expect(initialOf(null)).toBeNull();
    expect(initialOf(undefined)).toBeNull();
    expect(initialOf("")).toBeNull();
    expect(initialOf("   ")).toBeNull();
    expect(initialOf("🎀")).toBeNull();
    expect(initialOf("...")).toBeNull();
  });

  it("never returns a question mark", () => {
    for (const n of [null, undefined, "", "   ", "?", "🎀", "???"]) {
      expect(initialOf(n)).not.toBe("?");
    }
  });
});

describe("personName", () => {
  it("is 'You' for me, whatever my name is", () => {
    expect(personName("Jun", true)).toBe(YOU);
    expect(personName(null, true)).toBe(YOU);
    expect(personName("", true)).toBe(YOU);
  });

  it("is their name for everyone else", () => {
    expect(personName("Jun")).toBe("Jun");
    expect(personName("  Tee ")).toBe("Tee");
  });

  it("falls back to a word, not a blank or a mark", () => {
    expect(personName(null)).toBe("Someone");
    expect(personName("   ")).toBe("Someone");
  });
});

describe("listPeople", () => {
  it("builds the phrase", () => {
    expect(listPeople(["Ama"])).toBe("Ama");
    expect(listPeople(["Ama", "Jun"])).toBe("Ama and Jun");
    expect(listPeople(["Ama", "Jun", "Tee"])).toBe("Ama, Jun and Tee");
  });

  it("drops the blanks rather than leaving gaps", () => {
    expect(listPeople(["Ama", "", "  ", "Jun"])).toBe("Ama and Jun");
    expect(listPeople([])).toBe("Someone");
  });
});

describe("peopleAre", () => {
  it("agrees with one other person", () => {
    expect(peopleAre(["Jun"])).toEqual({ subject: "Jun", verb: "is" });
  });

  it("agrees with several", () => {
    expect(peopleAre(["Jun", "Tee"])).toEqual({ subject: "Jun and Tee", verb: "are" });
  });

  it("takes a plural verb for 'You' alone", () => {
    // "You is in here" is the kind of thing that makes an app feel
    // unfinished. "You" is one person and a plural verb.
    expect(peopleAre([], { includesMe: true })).toEqual({ subject: "You", verb: "are" });
  });

  it("puts me first when I am one of them", () => {
    expect(peopleAre(["Jun"], { includesMe: true })).toEqual({
      subject: "You and Jun",
      verb: "are",
    });
  });

  it("falls back without claiming anyone is there", () => {
    expect(peopleAre([])).toEqual({ subject: "Someone", verb: "is" });
  });
});
