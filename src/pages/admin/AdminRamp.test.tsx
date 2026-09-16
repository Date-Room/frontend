import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ sent: [] as unknown[], signedIn: true }));
vi.mock("@/lib/feedback", async (orig) => {
  const mod = await orig<typeof import("@/lib/feedback")>();
  return { ...mod, submitFeedback: vi.fn(async (b: unknown) => { api.sent.push(b); return { id: "f1", status: "received" }; }) };
});
vi.mock("@/lib/authClient", () => ({ authClient: { getSession: () => (api.signedIn ? { user: { id: "u1" } } : null), getAccessToken: () => "t" } }));

import { TellUsSheet } from "@/components/TellUsSheet";
import { trend } from "@/pages/admin/AdminDashboard";
import { niceMax } from "@/components/admin/RevenueChart";
import { auditSeverity } from "@/pages/admin/AdminAudit";
import { flattenHits } from "@/components/admin/CommandSearch";

afterEach(() => { cleanup(); api.sent.length = 0; api.signedIn = true; });

describe("pure helpers", () => {
  it("trend, niceMax, auditSeverity, flattenHits", () => {
    expect(trend(112, 100)).toEqual({ text: "+12%", tone: "up" });
    expect(trend(90, 100)).toEqual({ text: "−10%", tone: "down" });
    expect(trend(5, 0)).toEqual({ text: "new", tone: "up" });
    expect(trend(96, 98, "pts")).toEqual({ text: "−2 pts", tone: "down" });
    expect(trend(null, 3).text).toBe("");
    expect(niceMax(71)).toBe(100);
    expect(niceMax(4200)).toBe(5000);
    expect(niceMax(0)).toBe(10);
    expect(auditSeverity("revoke_subscription")).toBe("danger");
    expect(auditSeverity("grant_coach_beta")).toBe("warn");
    expect(auditSeverity("beta_verdict")).toBe("info");
    const hits = flattenHits({ users: [{ id: "u", email: "a@b.c", display_name: "" }], rooms: [{ id: "r", code: "7K2Q", state: "live" }], promo_codes: [] });
    expect(hits.map((h) => h.kind)).toEqual(["user", "room"]);
    expect(hits[0].title).toBe("a@b.c");
  });
});

describe("TellUsSheet", () => {
  function mount(props: Partial<React.ComponentProps<typeof TellUsSheet>> = {}) {
    const qc = new QueryClient();
    return render(
      <QueryClientProvider client={qc}><MemoryRouter><TellUsSheet open onClose={() => {}} surface="room" activityId="pick_a_door" roomId="room-1" {...props} /></MemoryRouter></QueryClientProvider>,
    );
  }
  it("needs a kind, sends surface and activity, says thanks", async () => {
    mount();
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Confusing/ }));
    fireEvent.change(screen.getByPlaceholderText(/What happened/), { target: { value: "I did not know I had to pick first" } });
    fireEvent.click(send);
    await waitFor(() => expect(api.sent).toHaveLength(1));
    expect(api.sent[0]).toMatchObject({ surface: "room", activity_id: "pick_a_door", kind: "confusing", room_id: "room-1", text: "I did not know I had to pick first" });
    await waitFor(() => expect(screen.getByText(/Got it/)).toBeTruthy());
  });
  it("asks guests to sign in instead of sending", () => {
    api.signedIn = false;
    mount();
    expect(screen.getByText(/Sign in to send feedback/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });
});
