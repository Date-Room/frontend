import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

type Listener = (e: { kind: string; payload: Record<string, unknown>; receivedAt: number }) => void;
const listeners: Listener[] = [];
const sessionState: { senderId: string; participantId?: string } = { senderId: "user-1" };

vi.mock("@/context/RoomSessionContext", () => ({
  useRoomSession: () => ({
    senderId: sessionState.senderId,
    participantId: sessionState.participantId,
    channel: {
      onBroadcast: (fn: Listener) => {
        listeners.push(fn);
        return () => {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
    },
  }),
}));

import { ChaperonAnnounceBadge, applyAnnounce } from "@/components/ChaperonAnnounceBadge";

function emit(payload: Record<string, unknown>) {
  act(() => {
    for (const fn of [...listeners]) fn({ kind: "chaperon.announce", payload, receivedAt: 0 });
  });
}

afterEach(() => {
  cleanup();
  listeners.length = 0;
  sessionState.senderId = "user-1";
  sessionState.participantId = undefined;
});

describe("applyAnnounce", () => {
  it("adds on active, removes on inactive, never lists self, dedupes", () => {
    let list = applyAnnounce([], { user_id: "u2", display_name: "Amara", active: true }, "u1");
    expect(list).toEqual([{ user_id: "u2", display_name: "Amara" }]);
    list = applyAnnounce(list, { user_id: "u2", display_name: "Amara", active: true }, "u1");
    expect(list).toHaveLength(1);
    list = applyAnnounce(list, { user_id: "u1", display_name: "Me", active: true }, "u1");
    expect(list).toHaveLength(1);
    list = applyAnnounce(list, { user_id: "u2", active: false }, "u1");
    expect(list).toEqual([]);
    expect(applyAnnounce([], { user_id: "u3", active: true }, null)[0].display_name).toBe("Your date");
  });
});

describe("ChaperonAnnounceBadge", () => {
  it("renders nothing until someone discloses, then names them and explains on tap", () => {
    render(
      <MemoryRouter>
        <ChaperonAnnounceBadge initial={[]} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button")).toBeNull();

    emit({ user_id: "u2", display_name: "Joshua", active: true });
    const chip = screen.getByRole("button", { name: /Joshua has a chaperon on/ });
    fireEvent.click(chip);
    expect(screen.getByRole("dialog").textContent).toMatch(/listens for safety only/);
    // Signed-in viewer: no sign-in nudge.
    expect(screen.queryByText(/Sign in to get yours/)).toBeNull();

    emit({ user_id: "u2", active: false });
    expect(screen.queryByRole("button", { name: /has a chaperon on/ })).toBeNull();
  });

  it("offers guests a way to get their own", () => {
    sessionState.senderId = "guest-abc";
    sessionState.participantId = "abc";
    render(
      <MemoryRouter>
        <ChaperonAnnounceBadge initial={[{ user_id: "u2", display_name: "Joshua" }]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Joshua has a chaperon on/ }));
    expect(screen.getByText(/Sign in to get yours/)).toBeTruthy();
  });

  it("takes a fresh experience payload when it differs", () => {
    const { rerender } = render(
      <MemoryRouter>
        <ChaperonAnnounceBadge initial={[]} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <ChaperonAnnounceBadge initial={[{ user_id: "u2", display_name: "Joshua" }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Joshua has a chaperon on/ })).toBeTruthy();
  });
});
