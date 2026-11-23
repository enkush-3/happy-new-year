import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GiftCatcherGame from "./GiftCatcherGame";
import { advanceGiftCatcherFrame, getFallingSpeedMultiplier, getGiftCatcherDifficulty, GIFT_CATCHER_FIRST_DROP_MS, GIFT_CATCHER_MAX_FALL_SPEED, GIFT_CATCHER_WIDTH, moveBasket, moveBasketContinuously, resolveCatches, type FallingObject, type GiftCatcherFrame } from "./model";

const initialFrame: GiftCatcherFrame = {
  elapsedMs: 0,
  basketX: 20,
  objects: [],
  dropsSpawned: 0,
  nextWaveAtMs: GIFT_CATCHER_FIRST_DROP_MS,
  safeLaneX: 50,
  score: 0,
  giftsCaught: 0,
  hazardsHit: 0,
  lives: 3,
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function expectBasketAt(basket: HTMLElement, position: number) {
  const renderedPosition = basket.style.getPropertyValue("--gift-basket-x");
  expect(renderedPosition).toMatch(/cqw$/);
  expect(Number.parseFloat(renderedPosition)).toBeCloseTo(position, 5);
}

function mockSingleDrops(...waves: [kindRoll: number, positionRoll: number][]) {
  const rolls = waves.flatMap(([kind, position]) => [0.99, 0.5, kind, position]);
  const defaultWave = [0.99, 0.5, 0, 0.5];
  let roll = 0;
  vi.spyOn(Math, "random").mockImplementation(() => rolls.shift() ?? defaultWave[roll++ % defaultWave.length]);
}

describe("gift catcher model", () => {
  it("keeps the basket inside the play lane", () => {
    expect(moveBasket(50, -1)).toBe(44);
    expect(moveBasket(8, -1)).toBe(8);
    expect(moveBasket(92, 1)).toBe(92);
    expect(moveBasketContinuously(50, 1, 500)).toBe(80);
    expect(moveBasketContinuously(92, 1, 500)).toBe(92);
  });

  it("keeps increasing fall speed past 30 seconds and approaches the maximum", () => {
    expect(getFallingSpeedMultiplier(0)).toBe(1);
    expect(getFallingSpeedMultiplier(30_000)).toBe(2.5);
    expect(getFallingSpeedMultiplier(60_000)).toBe(3);
    expect(getFallingSpeedMultiplier(120_000)).toBeCloseTo(3.4);
    expect(getFallingSpeedMultiplier(600_000)).toBeLessThan(GIFT_CATCHER_MAX_FALL_SPEED);
  });

  it("spawns smaller early waves and more frequent mixed hazard waves with a wide dodge lane", () => {
    const start = getGiftCatcherDifficulty(0);
    const middle = getGiftCatcherDifficulty(15_000);
    const late = getGiftCatcherDifficulty(30_000);
    expect(start.hazardWeight).toBe(0.25);
    expect(late.hazardWeight).toBe(0.6);
    expect(middle.intervalMs).toBeLessThan(start.intervalMs);
    expect(late.intervalMs).toBeLessThan(middle.intervalMs);
    expect(late.multiChance).toBeGreaterThan(middle.multiChance);
    expect(late.tripleChance).toBeGreaterThan(middle.tripleChance);

    function spawnAt(elapsedMs: number, rolls: number[]) {
      return advanceGiftCatcherFrame({ ...initialFrame, elapsedMs: elapsedMs - 16, nextWaveAtMs: elapsedMs }, 16, 0, null, () => rolls.shift() ?? 0);
    }
    expect(spawnAt(700, [0.2, 0.5, 0, 0.5]).objects).toHaveLength(1);
    expect(spawnAt(15_000, [0.2, 0.5, 0.8, 0.5, 0.99, 0.5]).objects).toHaveLength(2);

    for (const laneRoll of [0, 0.2, 0.5, 0.8, 0.999]) {
      const wave = spawnAt(30_000, [0.2, laneRoll, 0.6, 0.3, 0.99, 0.5, 0.95, 0.8]);
      expect(wave.objects.map(({ kind }) => kind)).toEqual(["coal", "snowball", "snowball"]);
      expect(new Set(wave.objects.map(({ x }) => x)).size).toBe(3);
      expect(new Set(wave.objects.map(({ y }) => y)).size).toBe(1);
      for (const { x } of wave.objects) {
        expect(Math.abs(x - wave.safeLaneX) - 12 * 0.85).toBeGreaterThan(GIFT_CATCHER_WIDTH * 1.45 / 2);
      }
    }
  });

  it("moves the catcher and falling objects the same distance at 60 Hz and 120 Hz", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    function playOneSecond(hz: number) {
      let state = initialFrame;
      for (let frame = 0; frame < hz; frame += 1) {
        state = advanceGiftCatcherFrame(state, 1_000 / hz, 1);
      }
      return state;
    }

    const at60Hz = playOneSecond(60);
    const at120Hz = playOneSecond(120);
    expect(at60Hz.basketX).toBeCloseTo(80);
    expect(at120Hz.basketX).toBeCloseTo(at60Hz.basketX, 8);
    expect(at60Hz.objects).toHaveLength(1);
    expect(at120Hz.objects).toHaveLength(1);
    expect(at120Hz.objects[0].y).toBeCloseTo(at60Hz.objects[0].y, 8);
  });

  it("limits movement and falling distance to 50 ms after a long frame", () => {
    const before = { ...initialFrame, objects: [{ id: "gift", kind: "gift" as const, x: 50, y: 0 }] };
    const after = advanceGiftCatcherFrame(before, 3_000, 1);

    expect(after.elapsedMs).toBe(50);
    expect(after.basketX).toBe(23);
    expect(after.objects[0].y).toBeCloseTo(1.604, 3);
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

  it("catches gifts near the rim while hazards in the same outer area pass through", () => {
    const falling: FallingObject[] = [
      { id: "gift", kind: "gift", x: 61.5, y: 81 },
      { id: "coal", kind: "coal", x: 61.5, y: 87 },
      { id: "snowball", kind: "snowball", x: 50, y: 81 },
    ];
    const result = resolveCatches(initialFrame, falling, 50);

    expect(result.state).toMatchObject({ score: 10, lives: 3 });
    expect(result.remaining.map(({ id }) => id)).toEqual(["coal", "snowball"]);
  });

  it("caps simultaneous hits at the lives left so the final result remains shareable", () => {
    const falling: FallingObject[] = [
      { id: "a", kind: "coal", x: 44, y: 87 },
      { id: "b", kind: "snowball", x: 56, y: 87 },
    ];
    expect(resolveCatches({ ...initialFrame, lives: 1, hazardsHit: 2 }, falling, 50).state)
      .toMatchObject({ lives: 0, hazardsHit: 3 });
  });
});

describe("GiftCatcherGame", () => {
  it("moves continuously while a keyboard direction is held, then stops on release", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const basket = screen.getByTestId("gift-catcher-basket");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    act(() => vi.advanceTimersByTime(400));
    expectBasketAt(basket, 74);
    expect(basket.style.getPropertyValue("--gift-basket-tilt")).toBe("6deg");

    fireEvent.keyUp(window, { key: "ArrowRight" });
    act(() => vi.advanceTimersByTime(250));
    expectBasketAt(basket, 74);
    expect(basket.style.getPropertyValue("--gift-basket-tilt")).toBe("0deg");

    fireEvent.keyDown(window, { key: "ф", code: "KeyA" });
    act(() => vi.advanceTimersByTime(200));
    expectBasketAt(basket, 61.52);
    expect(basket.style.getPropertyValue("--gift-basket-tilt")).toBe("-6deg");
  });

  it("continues scoring past the former 30-second limit", () => {
    vi.useFakeTimers();
    mockSingleDrops();
    const onComplete = vi.fn();
    render(<GiftCatcherGame onComplete={onComplete} />);

    const timer = screen.getByRole("timer", { name: "Тоглосон хугацаа" });
    expect(timer).toHaveTextContent(/^0 сек$/);
    expect(screen.getByRole("status", { name: "Амь" })).toHaveTextContent("3");
    expect(screen.getByRole("heading", { level: 1, name: "Бэлэг баригч" })).toHaveClass("game-shell__title");
    expect(screen.getByText("Хулганаар чирэх, A/D эсвэл суман товчоор хөдөлгөнө.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));

    act(() => vi.advanceTimersByTime(61_024));
    expect(timer).toHaveTextContent(/^61 сек$/);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Амь" })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "Сагсыг баруун тийш" })).toBeEnabled();

    const scoreBefore = screen.getByText("Оноо").textContent;
    act(() => vi.advanceTimersByTime(1_400));
    expect(screen.getByText("Оноо").textContent).not.toBe(scoreBefore);
  });

  it("shows elapsed play time when a frame is delayed and caps the movement", () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(performance, "now").mockReturnValue(0);
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });

    act(() => requestFrame.mock.lastCall?.[0](1_200));
    expect(screen.getByRole("timer", { name: "Тоглосон хугацаа" })).toHaveTextContent(/^1 сек$/);
    expectBasketAt(screen.getByTestId("gift-catcher-basket"), 53);
  });

  it("ends after the third hazard, retains the score and resets on replay", () => {
    vi.useFakeTimers();
    mockSingleDrops([0, 0.2], [0.8, 0.3], [0.99, 0.3], [0.8, 0.3]);
    const onComplete = vi.fn();
    render(<GiftCatcherGame onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    act(() => vi.advanceTimersByTime(496));
    fireEvent.keyUp(window, { key: "ArrowLeft" });
    act(() => vi.advanceTimersByTime(3_504));
    expect(screen.getByRole("status", { name: "Амь" })).toHaveTextContent("2");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText("−1")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(360));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ gameId: "gift-catcher", hazardsHit: 3, score: 10 });
    expect(onComplete.mock.calls[0][0].elapsedMs).toBeLessThan(30_000);
    expect(screen.getByRole("status", { name: "Амь" })).toHaveTextContent(/^0$/);
    expect(screen.getByRole("button", { name: "Сагсыг баруун тийш" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Дахин тоглох" }));
    expect(screen.getByRole("timer", { name: "Тоглосон хугацаа" })).toHaveTextContent(/^0 сек$/);
    expect(screen.getByRole("status", { name: "Амь" })).toHaveTextContent(/^3$/);
    expect(screen.getByText("Оноо")).toHaveTextContent("Оноо 0");
  });

  it("cancels opposite held directions and resumes when one is released", () => {
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const basket = screen.getByTestId("gift-catcher-basket");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    act(() => vi.advanceTimersByTime(250));
    expectBasketAt(basket, 50);

    fireEvent.keyUp(window, { key: "ArrowLeft" });
    act(() => vi.advanceTimersByTime(200));
    expectBasketAt(basket, 62.48);
  });

  it("stops held movement when the browser window loses focus", () => {
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const basket = screen.getByTestId("gift-catcher-basket");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    act(() => vi.advanceTimersByTime(200));
    expectBasketAt(basket, 61.52);

    fireEvent(window, new Event("blur"));
    act(() => vi.advanceTimersByTime(200));
    expectBasketAt(basket, 61.52);
  });

  it("does not handle keyboard input while the round is stopped or while typing", () => {
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    const basket = screen.getByTestId("gift-catcher-basket");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expectBasketAt(basket, 50);

    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(input, editable);

    fireEvent.keyDown(input, { key: "d" });
    expect(fireEvent.keyDown(input, { key: "ArrowRight" })).toBe(true);
    expect(fireEvent.keyDown(editable, { key: "ArrowRight" })).toBe(true);
    expectBasketAt(basket, 50);

    input.remove();
    editable.remove();
  });

  it("pauses the round while the document is hidden", () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));

    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("timer", { name: "Тоглосон хугацаа" })).toHaveTextContent(/^0 сек$/);
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(1_300));

    expect(screen.getByRole("timer", { name: "Тоглосон хугацаа" })).toHaveTextContent(/^1 сек$/);
  });

  it("moves continuously while a touch-friendly arrow is held", () => {
    vi.useFakeTimers();
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const basket = screen.getByTestId("gift-catcher-basket");
    const button = screen.getByRole("button", { name: "Сагсыг баруун тийш" });

    fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
    act(() => vi.advanceTimersByTime(250));
    expectBasketAt(basket, 64.4);
    fireEvent.pointerUp(button, { pointerId: 1 });
    act(() => vi.advanceTimersByTime(200));
    expectBasketAt(basket, 64.4);

    fireEvent.click(button, { detail: 1 });
    expectBasketAt(basket, 64.4);

    const leftButton = screen.getByRole("button", { name: "Сагсыг зүүн тийш" });
    fireEvent.pointerDown(leftButton, { pointerId: 2, button: 0 });
    act(() => vi.advanceTimersByTime(200));
    expectBasketAt(basket, 52.88);
    fireEvent.lostPointerCapture(leftButton, { pointerId: 2 });
    act(() => vi.advanceTimersByTime(200));
    expectBasketAt(basket, 52.88);
  });

  it("moves vector sprites on animation frames and shows brief score feedback on a catch", () => {
    vi.useFakeTimers();
    mockSingleDrops([0, 0.5], [0.99, 0.99], [0.99, 0.99]);
    render(<GiftCatcherGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    act(() => vi.advanceTimersByTime(720));

    const fallingGift = screen.getByTestId("falling-gift");
    const startingTransform = fallingGift.style.transform;
    expect(fallingGift.querySelector('svg rect[fill="#f5b731"]')).toBeInTheDocument();
    expect(screen.getByTestId("gift-catcher-basket").querySelector("svg")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(16));
    expect(fallingGift.style.transform).not.toBe(startingTransform);

    act(() => vi.advanceTimersByTime(2_528));
    expect(screen.getByText("+10")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByText("+10")).not.toBeInTheDocument();
  });
});
