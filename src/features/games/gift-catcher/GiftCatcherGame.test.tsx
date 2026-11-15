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

  it("moves the basket with global Arrow and A/D keys after starting and completes the round", () => {
    const onComplete = vi.fn();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const basket = screen.getByTestId("gift-catcher-basket");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(basket).toHaveStyle({ left: "56%" });
    fireEvent.keyDown(window, { key: "a" });
    expect(basket).toHaveStyle({ left: "50%" });
    fireEvent.keyDown(window, { key: "d" });
    expect(basket).toHaveStyle({ left: "56%" });
    fireEvent.keyDown(window, { key: "ф", code: "KeyA" });
    expect(basket).toHaveStyle({ left: "50%" });
    fireEvent.keyDown(window, { key: "а", code: "KeyD" });
    expect(basket).toHaveStyle({ left: "56%" });

    act(() => vi.advanceTimersByTime(30_100));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ gameId: "gift-catcher", elapsedMs: 30_000 }));
  });

  it("does not handle keyboard input while the round is stopped or while typing", () => {
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    const basket = screen.getByTestId("gift-catcher-basket");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(basket).toHaveStyle({ left: "50%" });

    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(input, editable);

    fireEvent.keyDown(input, { key: "d" });
    expect(fireEvent.keyDown(input, { key: "ArrowRight" })).toBe(true);
    expect(fireEvent.keyDown(editable, { key: "ArrowRight" })).toBe(true);
    expect(basket).toHaveStyle({ left: "50%" });

    input.remove();
    editable.remove();
    act(() => vi.advanceTimersByTime(30_100));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(basket).toHaveStyle({ left: "50%" });
  });

  it("pauses the round while the document is hidden", () => {
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(2_000));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("⏱ 30 сек")).toBeInTheDocument();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("moves the basket with the touch-friendly arrow controls", () => {
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const basket = screen.getByTestId("gift-catcher-basket");
    const before = basket.getAttribute("style");

    fireEvent.click(screen.getByRole("button", { name: "Сагсыг баруун тийш" }));

    expect(basket.getAttribute("style")).not.toBe(before);
  });

  it("transitions falling objects smoothly between timed position updates", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    act(() => vi.advanceTimersByTime(700));

    const fallingGift = screen.getByTestId("falling-gift");
    expect((fallingGift as HTMLElement).style.transition).toBe("top 100ms linear");
  });
});
