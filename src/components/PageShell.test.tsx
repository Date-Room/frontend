// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageShell } from "@/components/PageShell";

describe("PageShell", () => {
  it("forwards data attributes to the root", () => {
    // The chat drawer portals out of the room and finds its accent scope by
    // this attribute; dropping it silently reverted chat to the base theme.
    const { container } = render(
      <PageShell data-room-scope style={{ ["--room-accent" as string]: "#abc" }}>
        <p>hi</p>
      </PageShell>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.hasAttribute("data-room-scope")).toBe(true);
    expect(root.style.getPropertyValue("--room-accent")).toBe("#abc");
  });
});
