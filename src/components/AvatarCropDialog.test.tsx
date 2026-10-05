import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import AvatarCropDialog from "@/components/AvatarCropDialog";

/**
 * jsdom has no 2D canvas, so this covers the wiring around the geometry
 * rather than the pixels: that the dialog mounts, waits for the decode, and
 * hands back a data URL built from the crop the user left on screen.
 * `lib/avatarCrop.test.ts` is where the mapping itself is pinned down.
 */

const decoded = {
  source: {} as CanvasImageSource,
  width: 1200,
  height: 800,
  close: vi.fn(),
};

const renderAvatarCrop = vi.fn(() => "data:image/jpeg;base64,AAAA");

vi.mock("@/lib/avatarImage", () => ({
  AvatarImageError: class extends Error {},
  assertValidAvatarFile: () => {},
  decodeAvatarImage: () => Promise.resolve(decoded),
  renderAvatarCrop: (...args: unknown[]) => renderAvatarCrop(...(args as [])),
}));

const file = new File(["x"], "face.jpg", { type: "image/jpeg" });

afterEach(() => {
  cleanup();
  renderAvatarCrop.mockClear();
});

describe("AvatarCropDialog", () => {
  it("opens on a picked file and enables the confirm once decoded", async () => {
    render(<AvatarCropDialog file={file} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText("Frame your photo")).toBeTruthy();
    const use = screen.getByRole("button", { name: "Use photo" }) as HTMLButtonElement;
    await waitFor(() => expect(use.disabled).toBe(false));
  });

  it("stays closed with no file", () => {
    render(<AvatarCropDialog file={null} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.queryByText("Frame your photo")).toBeNull();
  });

  it("hands the confirmed crop back as a data URL", async () => {
    const onConfirm = vi.fn();
    render(<AvatarCropDialog file={file} onCancel={() => {}} onConfirm={onConfirm} />);
    const use = screen.getByRole("button", { name: "Use photo" }) as HTMLButtonElement;
    await waitFor(() => expect(use.disabled).toBe(false));
    fireEvent.click(use);
    expect(onConfirm).toHaveBeenCalledWith("data:image/jpeg;base64,AAAA");
    // The rect handed to the renderer is the centred square of a landscape
    // photo, because nothing was dragged.
    expect(renderAvatarCrop).toHaveBeenCalledWith(
      decoded,
      expect.objectContaining({
        left: expect.closeTo(200, 6),
        top: expect.closeTo(0, 6),
        width: expect.closeTo(800, 6),
        height: expect.closeTo(800, 6),
      }),
    );
  });

  it("cancels without producing a crop", () => {
    const onCancel = vi.fn();
    render(<AvatarCropDialog file={file} onCancel={onCancel} onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(renderAvatarCrop).not.toHaveBeenCalled();
  });

  it("zooming in narrows the region that gets cut", async () => {
    render(<AvatarCropDialog file={file} onCancel={() => {}} onConfirm={() => {}} />);
    const use = screen.getByRole("button", { name: "Use photo" }) as HTMLButtonElement;
    await waitFor(() => expect(use.disabled).toBe(false));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    fireEvent.click(use);
    expect(renderAvatarCrop).toHaveBeenCalledWith(
      decoded,
      expect.objectContaining({ width: expect.closeTo(400, 6), height: expect.closeTo(400, 6) }),
    );
  });
});
