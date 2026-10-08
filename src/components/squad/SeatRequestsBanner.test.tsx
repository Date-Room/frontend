import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  role: "owner" as "owner" | "member",
  canLend: true,
  lend: vi.fn(async () => ({})),
  decline: vi.fn(async () => ({})),
}));
vi.mock("@/context/RoomSessionContext", () => ({
  useRoomSession: () => ({ channel: { onBroadcast: () => () => {}, broadcast: vi.fn() } }),
}));
vi.mock("@/lib/squad", async (orig) => {
  const mod = await orig<typeof import("@/lib/squad")>();
  return {
    ...mod,
    getSquadMembers: vi.fn(async () => ({ members: [], locked_until: null, my_role: api.role })),
    getSeatRequests: vi.fn(async () => ({
      requests: [{ id: "q1", user_id: "u2", name: "Amina Otieno", status: "pending", created_at: "", expires_at: "" }],
      effect: {
        night_size: 3,
        seats_before: api.canLend ? 12 : 0,
        seats_after: api.canLend ? 11 : 0,
        nights_before: 4,
        spare_before: 0,
        nights_after: 3,
        spare_after: 2,
        can_lend: api.canLend,
      },
      can_lend: true,
    })),
    getSquadPrices: vi.fn(async () => ({ seats: 3, provider: "store", stk_ready: false, dev_checkout: false, products: [] })),
    lendSeat: api.lend,
    declineSeat: api.decline,
  };
});

import { SeatRequestsBanner } from "@/components/squad/SeatRequestsBanner";

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SeatRequestsBanner roomId="r1" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  api.role = "owner";
  api.canLend = true;
});

describe("SeatRequestsBanner", () => {
  it("shows the host what lending costs, and lends", async () => {
    mount();
    expect(await screen.findByText("Amina wants to join tonight")).toBeTruthy();
    expect(screen.getByText(/leaves 3 nights \+ 2 spare seats \(was 4 nights\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lend a seat" }));
    await waitFor(() => expect(api.lend).toHaveBeenCalledWith("r1", "q1"));
  });

  it("says not tonight", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Not tonight" }));
    await waitFor(() => expect(api.decline).toHaveBeenCalledWith("r1", "q1"));
  });

  it("offers only not tonight when there's nothing to lend and no way to pay here", async () => {
    api.canLend = false;
    mount();
    expect(await screen.findByText(/no seats left to lend/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lend a seat" })).toBeNull();
    expect(screen.getByRole("button", { name: "Not tonight" })).toBeTruthy();
  });

  it("isn't shown to people who don't run the squad", async () => {
    api.role = "member";
    mount();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/wants to join/)).toBeNull();
  });
});
