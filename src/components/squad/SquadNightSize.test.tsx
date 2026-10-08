import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({ setSize: vi.fn(async (_r: string, seats: number) => ({ seats })) }));
vi.mock("@/lib/squad", async (orig) => {
  const mod = await orig<typeof import("@/lib/squad")>();
  return { ...mod, setSquadNightSize: api.setSize };
});

import { SquadNightSize } from "@/components/squad/SquadNightSize";

afterEach(() => {
  cleanup();
  api.setSize.mockClear();
});

const nights = {
  seats: 3,
  seat_nights: 15,
  nights_left: 5,
  free_night_expires_at: null,
  active_night: null,
  nights: [],
  by_size: [
    { seats: 2, nights: 7, spare: 1 },
    { seats: 3, nights: 5, spare: 0 },
    { seats: 4, nights: 3, spare: 3 },
    { seats: 5, nights: 3, spare: 0 },
  ],
};

describe("SquadNightSize", () => {
  it("previews every size and saves the one picked", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <SquadNightSize roomId="r1" nights={nights} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByText("3 nights + 3 spare seats")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /3 people/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /4 people/ }));
    await waitFor(() => expect(api.setSize).toHaveBeenCalledWith("r1", 4));
  });
  it("warns when a size leaves no full night", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SquadNightSize roomId="r1" nights={{ ...nights, seat_nights: 3, by_size: [{ seats: 3, nights: 1, spare: 0 }, { seats: 4, nights: 0, spare: 3 }] }} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByText(/Not a full night yet/)).toBeTruthy();
  });
});
