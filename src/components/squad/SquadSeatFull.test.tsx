import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  seatNights: 0,
  role: "owner" as "owner" | "cohost" | "member",
  provider: "stripe" as "stripe" | "store",
  addSeat: vi.fn(async () => ({ seats: 4, ends_at: "" })),
  devPurchase: vi.fn(async () => undefined),
  ask: vi.fn(async () => ({
    id: "q1",
    user_id: "u2",
    name: "Salma",
    status: "pending",
    created_at: "",
    expires_at: new Date(Date.now() + 300_000).toISOString(),
  })),
}));
vi.mock("@/lib/squad", async (orig) => {
  const mod = await orig<typeof import("@/lib/squad")>();
  return {
    ...mod,
    getSquadNights: vi.fn(async () => ({ seats: 3, seat_nights: api.seatNights, nights_left: 0, active_night: null, nights: [], free_night_expires_at: null })),
    getSquadMembers: vi.fn(async () => ({
      members: [{ participant_id: "p1", user_id: "u1", display_name: "Joshua Mwaniki", photo_url: null, city: null, tz: null, role: "owner", joined_at: "", new: false }],
      locked_until: null,
      my_role: api.role,
    })),
    getSquadPrices: vi.fn(async () => ({
      seats: 3,
      provider: api.provider,
      stk_ready: false,
      dev_checkout: api.provider !== "store",
      products: [{ product: "squad_seat", nights: 1, per_seat: 3, amount: 3, currency: "USD" }],
    })),
    addSquadSeat: api.addSeat,
    squadDevPurchase: api.devPurchase,
    askForSeat: api.ask,
  };
});

import { SquadSeatFull } from "@/components/squad/SquadSeatFull";

function mount(full = { seats: 3, can_add_seat: true, product: "squad_seat_single" }) {
  const onSeated = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <SquadSeatFull roomId="r1" full={full} onSeated={onSeated} />
    </QueryClientProvider>,
  );
  return onSeated;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  api.role = "owner";
  api.provider = "stripe";
});

describe("SquadSeatFull, for whoever runs the squad", () => {
  it("adds a seat from the squad's nights and joins", async () => {
    api.seatNights = 6;
    const onSeated = mount();
    fireEvent.click(await screen.findByRole("button", { name: /Add a seat and join/ }));
    await waitFor(() => expect(onSeated).toHaveBeenCalled());
    expect(api.addSeat).toHaveBeenCalledWith("r1");
  });

  it("pays for the seat when the squad has none", async () => {
    api.seatNights = 0;
    const onSeated = mount();
    fireEvent.click(await screen.findByRole("button", { name: /Pay for my seat/ }));
    await waitFor(() => expect(onSeated).toHaveBeenCalled());
    expect(api.devPurchase).toHaveBeenCalledWith("r1", "squad_seat");
  });
});

describe("SquadSeatFull, for everyone else", () => {
  it("never spends the squad's seats: pay your own way, or ask the host", async () => {
    api.role = "member";
    api.seatNights = 6;
    mount();
    expect(await screen.findByRole("button", { name: /Pay for my seat/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add a seat and join/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ask Joshua to lend you a seat" }));
    expect(await screen.findByText(/Waiting for Joshua/)).toBeTruthy();
    expect(api.ask).toHaveBeenCalledWith("r1");
    expect(api.addSeat).not.toHaveBeenCalled();
  });

  it("makes asking the main button where paying isn't on the web", async () => {
    api.role = "member";
    api.provider = "store";
    mount();
    const ask = await screen.findByRole("button", { name: "Ask Joshua to lend you a seat" });
    expect(ask.className).toMatch(/btn-primary/);
    expect(screen.queryByRole("button", { name: /Pay for my seat/ })).toBeNull();
  });

  it("explains a full night and still lets them retry", async () => {
    const onSeated = mount({ seats: 5, can_add_seat: false, product: null });
    expect(screen.getByText(/can't take anyone else/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(onSeated).toHaveBeenCalled();
  });
});
