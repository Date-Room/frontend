import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  seatNights: 0,
  addSeat: vi.fn(async () => ({ seats: 4, ends_at: "" })),
  devPurchase: vi.fn(async () => undefined),
}));
vi.mock("@/lib/squad", async (orig) => {
  const mod = await orig<typeof import("@/lib/squad")>();
  return {
    ...mod,
    getSquadNights: vi.fn(async () => ({ seats: 3, seat_nights: api.seatNights, nights_left: 0, active_night: null, nights: [], free_night_expires_at: null })),
    getSquadPrices: vi.fn(async () => ({
      seats: 3,
      provider: "stripe",
      stk_ready: false,
      dev_checkout: true,
      products: [{ product: "squad_seat", nights: 1, per_seat: 3, amount: 3, currency: "USD" }],
    })),
    addSquadSeat: api.addSeat,
    squadDevPurchase: api.devPurchase,
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
});

describe("SquadSeatFull", () => {
  it("adds a seat from the room's nights and joins", async () => {
    api.seatNights = 6;
    const onSeated = mount();
    fireEvent.click(await screen.findByRole("button", { name: /Add a seat and join/ }));
    await waitFor(() => expect(onSeated).toHaveBeenCalled());
    expect(api.addSeat).toHaveBeenCalledWith("r1");
    expect(screen.getByText(/Tonight's 3 seats are taken/)).toBeTruthy();
  });

  it("lets the latecomer pay for their own seat when the room has none", async () => {
    api.seatNights = 0;
    const onSeated = mount();
    fireEvent.click(await screen.findByRole("button", { name: /Pay for my seat/ }));
    await waitFor(() => expect(onSeated).toHaveBeenCalled());
    expect(api.devPurchase).toHaveBeenCalledWith("r1", "squad_seat");
    expect(api.addSeat).not.toHaveBeenCalled();
  });

  it("explains the five-seat limit and still lets them retry", async () => {
    const onSeated = mount({ seats: 5, can_add_seat: false, product: null });
    expect(screen.getByText(/seats five at most/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add a seat/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(onSeated).toHaveBeenCalled();
  });
});
