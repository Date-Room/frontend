import { describe, expect, it } from "vitest";
import {
  INITIAL_INVITE_STATE,
  inviteHeadline,
  inviteReducer,
  pendingInvite,
  starterStatus,
  type InviteState,
} from "./activityInvite";

const stage = (id: string | null, at = 1) => ({ type: "stage" as const, id, at });

describe("inviteReducer + pendingInvite", () => {
  it("a partner stage broadcast produces an invite unless I am already there", () => {
    const s = inviteReducer(INITIAL_INVITE_STATE, stage("guacamole"));
    expect(pendingInvite(s, "lobby")).toBe("guacamole");
    expect(pendingInvite(s, "guacamole")).toBeNull();
  });

  it("walls, chat and the lobby never invite, and clear a standing invite", () => {
    let s = inviteReducer(INITIAL_INVITE_STATE, stage("questions"));
    for (const id of ["vision_board", "chat", "lobby", "room_details", null]) {
      const next = inviteReducer(s, stage(id, 2));
      expect(pendingInvite(next, "lobby")).toBeNull();
    }
    s = inviteReducer(s, stage(null, 3));
    expect(s).toEqual(INITIAL_INVITE_STATE);
  });

  it("Not now mutes that activity until the partner opens something else", () => {
    let s = inviteReducer(INITIAL_INVITE_STATE, stage("rank_it"));
    s = inviteReducer(s, { type: "decline" });
    expect(pendingInvite(s, "lobby")).toBeNull();
    // Same activity again: still quiet (no re-nag).
    s = inviteReducer(s, stage("rank_it", 5));
    expect(pendingInvite(s, "lobby")).toBeNull();
    // A different activity: fresh invite.
    s = inviteReducer(s, stage("watch", 6));
    expect(pendingInvite(s, "lobby")).toBe("watch");
  });

  it("one invite at a time: the newest partner stage replaces the older", () => {
    let s = inviteReducer(INITIAL_INVITE_STATE, stage("questions"));
    s = inviteReducer(s, stage("this_or_that", 2));
    expect(pendingInvite(s, "lobby")).toBe("this_or_that");
  });

  it("activity events are the fallback for partners that do not send stage", () => {
    let s = inviteReducer(INITIAL_INVITE_STATE, { type: "activity", id: "questions", eventType: "answer", at: 1 });
    expect(pendingInvite(s, "lobby")).toBe("questions");
    // Passive sync chatter does not count as a person doing something.
    s = inviteReducer(INITIAL_INVITE_STATE, { type: "activity", id: "watch", eventType: "tick", at: 1 });
    expect(pendingInvite(s, "lobby")).toBeNull();
    // Chat events never invite.
    s = inviteReducer(INITIAL_INVITE_STATE, { type: "activity", id: "chat", eventType: "message", at: 1 });
    expect(pendingInvite(s, "lobby")).toBeNull();
  });

  it("a repeat of the same stage keeps state identity (no re-render churn)", () => {
    const s = inviteReducer(INITIAL_INVITE_STATE, stage("dj"));
    expect(inviteReducer(s, stage("dj", 9))).toBe(s);
  });

  it("partner leaving the room clears everything", () => {
    let s = inviteReducer(INITIAL_INVITE_STATE, stage("dj"));
    s = inviteReducer(s, { type: "decline" });
    expect(inviteReducer(s, { type: "partner_left" })).toEqual(INITIAL_INVITE_STATE);
  });
});

describe("copy", () => {
  it("uses the activity's verb and the partner's real name", () => {
    expect(inviteHeadline("JJ", "guacamole", "Guacamole Panic")).toBe("JJ fired up Guacamole Panic");
    expect(inviteHeadline("JJ", "questions", "Open Book")).toBe("JJ started Open Book");
    expect(inviteHeadline("JJ", "watch", "Watch")).toBe("JJ opened Watch");
  });
});

describe("starterStatus", () => {
  const together: InviteState = { partnerStage: { id: "questions", at: 1 }, declinedId: null };
  it("says together when the partner is on my activity", () => {
    expect(starterStatus(together, "questions", true, 10, 45_000, 0)).toBe("together");
  });
  it("says inviting for a while after I open something, then goes quiet", () => {
    expect(starterStatus(INITIAL_INVITE_STATE, "questions", true, 10_000, 45_000, 0)).toBe("inviting");
    expect(starterStatus(INITIAL_INVITE_STATE, "questions", true, 60_000, 45_000, 0)).toBeNull();
  });
  it("is silent on walls, in the lobby, or when nobody else is here", () => {
    expect(starterStatus(INITIAL_INVITE_STATE, "lobby", true, 0, 45_000, 0)).toBeNull();
    expect(starterStatus(INITIAL_INVITE_STATE, "vision_board", true, 0, 45_000, 0)).toBeNull();
    expect(starterStatus(INITIAL_INVITE_STATE, "questions", false, 0, 45_000, 0)).toBeNull();
  });
});
