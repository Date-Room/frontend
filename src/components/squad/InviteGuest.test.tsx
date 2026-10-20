import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

const api = vi.hoisted(() => ({
  off: false,
  create: vi.fn(async (_r: string, pays: string) => ({ id: "i1", token: "tok", pays, created_at: "", expires_at: "", used: false })),
}));
vi.mock("@/lib/squadGuests", async (orig) => {
  const mod = await orig<typeof import("@/lib/squadGuests")>();
  return {
    ...mod,
    listGuestInvites: vi.fn(async () => {
      if (api.off) throw new ApiError(404, "Not found", null);
      return { invites: [] };
    }),
    createGuestInvite: api.create,
  };
});

import { InviteGuest } from "@/components/squad/InviteGuest";

const wrap = (canRun = true) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InviteGuest roomId="r1" canRun={canRun} />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  api.off = false;
});

describe("InviteGuest", () => {
  it("makes a they-pay link and shows it to share", async () => {
    wrap();
    fireEvent.click(await screen.findByRole("button", { name: /Invite a guest/ }));
    fireEvent.click(screen.getByRole("radio", { name: /They pay/ }));
    fireEvent.click(screen.getByRole("button", { name: "Make the link" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("r1", "self"));
    expect(await screen.findByText(/\/g\/tok$/)).toBeTruthy();
  });
  it("is hidden while guests are switched off, and from people who don't run the squad", async () => {
    api.off = true;
    wrap();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /Invite a guest/ })).toBeNull();
    cleanup();
    api.off = false;
    wrap(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /Invite a guest/ })).toBeNull();
  });
});
