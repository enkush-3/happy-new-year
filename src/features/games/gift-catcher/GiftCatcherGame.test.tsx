import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GiftCatcherGame from "./GiftCatcherGame";
import { moveBasket, resolveCatches, type FallingObject } from "./model";

describe("gift catcher model", () => {
  it("keeps the basket inside the play lane", () => {
    expect(moveBasket(50, -1)).toBe(44);
    expect(moveBasket(8, -1)).toBe(8);
    expect(moveBasket(92, 1)).toBe(92);
  });

  it("adds gifts and removes a life for hazards caught by the basket", () => {
    const state = { score: 0, giftsCaught: 0, hazardsHit: 0, lives: 3 };
    const falling: FallingObject[] = [
      { id: "gift", kind: "gift", x: 50, y: 82 },
      { id: "coal", kind: "coal", x: 51, y: 82 },
      { id: "far", kind: "gift", x: 90, y: 82 },
    ];

    const result = resolveCatches(state, falling, 50);

    expect(result.state).toEqual({ score: 10, giftsCaught: 1, hazardsHit: 1, lives: 2 });
    expect(result.remaining.map(({ id }) => id)).toEqual(["far"]);
  });
});

describe("GiftCatcherGame", () => {
  afterEach(() => vi.useRealTimers());

  it("moves the basket with keyboard and completes at the end of its 30-second round", () => {
    const onComplete = vi.fn();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const arena = screen.getByRole("application", { name: "Бэлэг баригч тоглоом" });
    const basket = screen.getByTestId("gift-catcher-basket");
    const before = basket.getAttribute("style");
    fireEvent.keyDown(arena, { key: "ArrowRight" });
    expect(basket.getAttribute("style")).not.toBe(before);

    act(() => vi.advanceTimersByTime(30_100));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ gameId: "gift-catcher", elapsedMs: 30_000 }));
  });
});
