import { describe, it, expect } from "vitest";
import { humanPeers, AGENT_IDENTITY } from "@/context/CallPeersContext";
import type { Participant } from "livekit-client";

describe("humanPeers", () => {
  it("drops the chaperon agent and keeps names when present", () => {
    const list = [
      { identity: "u2", name: " Amara " },
      { identity: AGENT_IDENTITY, name: "" },
      { identity: "u3", name: "" },
    ] as unknown as Participant[];
    expect(humanPeers(list)).toEqual([
      { identity: "u2", name: "Amara" },
      { identity: "u3", name: null },
    ]);
  });
});
