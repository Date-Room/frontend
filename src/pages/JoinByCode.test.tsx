// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import JoinByCode, { cleanCode } from "./JoinByCode";

afterEach(cleanup);

describe("Join with code", () => {
  it("keeps the code from an invite link that was missing its PIN", () => {
    render(
      <MemoryRouter initialEntries={["/join?code=abc234"]}>
        <JoinByCode />
      </MemoryRouter>,
    );
    expect((screen.getByLabelText("ROOM ID") as HTMLInputElement).value).toBe("ABC234");
  });

  it("takes a pasted code with spaces or a dash", () => {
    render(
      <MemoryRouter initialEntries={["/join"]}>
        <JoinByCode />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("ROOM ID"), { target: { value: " ABC-234 " } });
    expect((screen.getByLabelText("ROOM ID") as HTMLInputElement).value).toBe("ABC234");
    expect(cleanCode("abc 234 xyz")).toBe("ABC234");
  });
});
