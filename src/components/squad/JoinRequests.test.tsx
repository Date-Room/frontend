import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

const api = vi.hoisted(() => ({
  role: "owner" as "owner" | "member",
  myStatus: "pending",
  approve: vi.fn(async () => ({ requests: [{ id: "j1", display_name: "Amina Otieno" }] })),
  approveAll: vi.fn(async () => ({ requests: [{ id: "j1" }, { id: "j2" }] })),
  decline: vi.fn(async () => ({ requests: [{ id: "j1" }] })),
}));
vi.mock("@/context/RoomSessionContext", () => ({
  useRoomSession: () => ({ channel: { onBroadcast: () => () => {} } }),
}));
vi.mock("@/lib/squad", async (orig) => {
  const mod = await orig<typeof import("@/lib/squad")>();
  return {
    ...mod,
    getSquadMembers: vi.fn(async () => ({ members: [], locked_until: null, my_role: api.role, approval_needed: true })),
    getJoinRequests: vi.fn(async () => ({
      requests: [
        { id: "j1", user_id: "u1", display_name: "Amina Otieno", photo_url: null, status: "pending", created_at: "" },
        { id: "j2", user_id: "u2", display_name: "Kev", photo_url: null, status: "pending", created_at: "" },
      ],
    })),
    getMyJoinRequest: vi.fn(async () => ({ status: api.myStatus, approval_needed: true, request: null })),
    approveJoin: api.approve,
    approveAllJoins: api.approveAll,
    declineJoin: api.decline,
  };
});

import { joinAskLine, joinGate } from "@/lib/squad";
import { JoinRequestsCard } from "@/components/squad/JoinRequests";
import { SquadJoinWaiting } from "@/components/squad/SquadJoinWaiting";

const wrap = (el: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider>);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  api.role = "owner";
  api.myStatus = "pending";
});

describe("wording", () => {
  it("names who's asking", () => {
    expect(joinAskLine([{ display_name: "Amina Otieno" }])).toBe("Amina wants to join the squad");
    expect(joinAskLine([{ display_name: "Amina" }, { display_name: "Kev" }])).toBe("Amina and Kev want to join the squad");
    expect(joinAskLine([{ display_name: "A" }, { display_name: "B" }, { display_name: "C" }])).toBe("A, B and 1 other want to join the squad");
  });
  it("turns the squad's join refusals into screens, not toasts", () => {
    const e = (error: string) => new ApiError(403, "x", { detail: { error } });
    expect(joinGate(e("awaiting_approval"))).toBe("awaiting_approval");
    expect(joinGate(e("removed"))).toBe("removed");
    expect(joinGate(e("something_else"))).toBeNull();
    expect(joinGate(new Error("network"))).toBeNull();
  });
});

describe("JoinRequestsCard", () => {
  it("lets one person in, or everyone", async () => {
    wrap(<JoinRequestsCard roomId="r1" />);
    expect(await screen.findByText("Amina and Kev want to join the squad")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Let Amina in" }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith("r1", "j1"));
    fireEvent.click(screen.getByRole("button", { name: "Let everyone in" }));
    await waitFor(() => expect(api.approveAll).toHaveBeenCalledWith("r1"));
  });
  it("isn't shown to people who don't run the squad", async () => {
    api.role = "member";
    wrap(<JoinRequestsCard roomId="r1" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/want to join/)).toBeNull();
  });
});

describe("SquadJoinWaiting", () => {
  const invite = {
    id: "r1",
    code: "ABC",
    host_display_name: "Joshua Mwaniki",
    host_photo_url: null,
    scheduled_for: null,
    expires_at: null,
    state: "live",
    greeting_headline: "Friday crew",
    greeting_subtext: null,
    persistence: "persistent",
    participants: [{ participant_id: "p1", user_id: "u1", display_name: "Joshua", photo_url: null, slot: "a" }],
    theme_color: null,
    background_id: null,
    package: "squad",
    curated_activity_ids: [],
  } as unknown as import("@/lib/rooms").InviteCard;

  it("waits on the invite card only, then goes in once approved", async () => {
    vi.useFakeTimers();
    const onApproved = vi.fn();
    wrap(<SquadJoinWaiting invite={invite} state="awaiting_approval" onApproved={onApproved} />);
    expect(screen.getByText("Waiting for Joshua to let you in")).toBeTruthy();
    expect(screen.getByText("Friday crew")).toBeTruthy();
    api.myStatus = "approved";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(onApproved).toHaveBeenCalled();
  });
  it("says so when not let in", () => {
    wrap(<SquadJoinWaiting invite={invite} state="declined" onApproved={() => {}} />);
    expect(screen.getByText("Not this time")).toBeTruthy();
    expect(screen.getByText(/ask again tomorrow/)).toBeTruthy();
  });
});
