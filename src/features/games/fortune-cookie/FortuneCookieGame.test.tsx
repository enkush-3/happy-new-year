import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FortuneCookieGame from "./FortuneCookieGame";

describe("FortuneCookieGame", () => {
  it("reveals three distinct fortunes and reports them for sharing", () => {
    const onComplete = vi.fn();
    render(<FortuneCookieGame onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Бэлгээ нээх" }));

    const fortunes = screen.getAllByRole("listitem");
    expect(fortunes).toHaveLength(3);
    expect(new Set(fortunes.map((item) => item.textContent)).size).toBe(3);
    expect(onComplete).toHaveBeenCalledWith({
      gameId: "fortune-cookie",
      fortunes: fortunes.map((item) => item.textContent?.replace(/^\d+/u, "").trim()),
    });
  });

  it("keeps the revealed fortunes visible when opening the gift a second time", () => {
    render(<FortuneCookieGame onComplete={vi.fn()} />);
    const gift = screen.getByRole("button", { name: "Бэлгээ нээх" });

    fireEvent.click(gift);
    const firstSet = screen.getAllByRole("listitem").map((item) => item.textContent);
    fireEvent.click(screen.getByRole("button", { name: "Шинэ ерөөл авах" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).not.toEqual(firstSet);
  });
});
