import { describe, expect, it } from "vitest";
import { partnerFromPresence } from "./usePartnerName";

const ME = "user-me";

describe("partnerFromPresence", () => {
  it("finds a web partner (legacy sender_id/name schema)", () => {
    const p = partnerFromPresence(
      [
        { sender_id: ME, name: "Joshua Mwaniki" },
        { sender_id: "user-them", name: "Kiki Wanjiru", photo_url: "https://x/y.jpg" },
      ],
      ME,
    );
    expect(p.first).toBe("Kiki");
    expect(p.full).toBe("Kiki Wanjiru");
    expect(p.photoUrl).toBe("https://x/y.jpg");
  });

  it("finds a mobile partner (canonical user_id/display_name schema)", () => {
    const p = partnerFromPresence(
      [
        { sender_id: ME, name: "Joshua" },
        { user_id: "user-them", display_name: "amara okafor" },
      ],
      ME,
    );
    expect(p.first).toBe("amara");
    expect(p.full).toBe("amara okafor");
  });

  it("returns nulls when alone, or when the only other entry has no id", () => {
    expect(partnerFromPresence([{ sender_id: ME, name: "Joshua" }], ME).first).toBeNull();
    expect(partnerFromPresence([], ME).first).toBeNull();
    expect(partnerFromPresence([{ name: "Ghost" }], ME).first).toBeNull();
  });

  it("caps the first name and tolerates a present partner with no name yet", () => {
    const long = partnerFromPresence([{ user_id: "u2", display_name: "Wolfeschlegelstein Q" }], ME);
    expect(long.first).toBe("Wolfeschlege");
    const unnamed = partnerFromPresence([{ user_id: "u2" }], ME);
    expect(unnamed.full).toBeNull();
    expect(unnamed.first).toBeNull();
  });
});
