import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShareButton from "./ShareButton";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
  if (originalShare) Object.defineProperty(navigator, "share", originalShare);
  else Reflect.deleteProperty(navigator, "share");
  vi.restoreAllMocks();
});

const result = {
  gameId: "gift-catcher" as const,
  score: 120,
  giftsCaught: 12,
  hazardsHit: 1,
  elapsedMs: 30_000,
};

describe("game result sharing control", () => {
  it("copies the result URL when the native share sheet is unavailable", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });

    render(<ShareButton result={result} />);
    await user.click(screen.getByRole("button", { name: /үр дүнгээ хуваалцах/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/games\/gift-catcher\?result=/));
    expect(screen.getByRole("status")).toHaveTextContent("линкийг хууллаа");
  });

  it("shows a selectable manual link when sharing and clipboard both fail", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });

    render(<ShareButton result={result} />);
    await user.click(screen.getByRole("button", { name: /үр дүнгээ хуваалцах/i }));

    const input = screen.getByLabelText("Share линк") as HTMLInputElement;
    expect(input.value).toMatch(/\/games\/gift-catcher\?result=/);
    expect(screen.getByRole("status")).toHaveTextContent("хуулна уу");
  });

  it("uses the native share sheet when supported", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    render(<ShareButton result={result} />);
    await user.click(screen.getByRole("button", { name: /үр дүнгээ хуваалцах/i }));

    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: "Бэлэг баригч",
      url: expect.stringMatching(/\/games\/gift-catcher\?result=/),
    }));
  });
});
