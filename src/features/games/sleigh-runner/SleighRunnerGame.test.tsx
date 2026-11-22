import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SleighRunnerGame from "./SleighRunnerGame";
import { RUNNER_START_SPEED } from "./model";
import * as art from "./runner-canvas";

describe("SleighRunnerGame", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses a shared shell with three HUD pills and a touch-friendly jump button", () => {
    render(<SleighRunnerGame onComplete={vi.fn()} />);

    const game = screen.getByRole("region", { name: "Чарганы уралдаан" });
    expect(within(game).getByText("2D RUNNER")).toBeInTheDocument();
    expect(within(game).getByRole("img", { name: "Чарга, гацууртай өвлийн зам" }).tagName).toBe("CANVAS");
    expect(within(game).getByText("Оноо")).toHaveClass("game-hud-badge");
    expect(within(game).getByText("Зай")).toHaveTextContent("0 м");
    expect(within(game).getByText("Хурд")).toHaveTextContent(`${RUNNER_START_SPEED} м/с`);

    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    expect(screen.getByRole("button", { name: "Үсрэх" })).toHaveClass("game-button--primary");
  });

  it("maps held Space, release, ArrowUp, ArrowDown, and touch to the canvas motion", () => {
    vi.useFakeTimers();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({ setTransform: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "clientWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLCanvasElement.prototype, "clientHeight", "get").mockReturnValue(240);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const draw = vi.spyOn(art, "drawRunnerScene").mockImplementation(() => {});

    render(<SleighRunnerGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    const jump = screen.getByRole("button", { name: "Үсрэх" });

    fireEvent.keyDown(jump, { key: " ", code: "Space" });
    act(() => vi.advanceTimersByTime(32));
    expect(draw.mock.lastCall?.[3].verticalVelocity).toBeGreaterThan(30.5);
    fireEvent.keyUp(jump, { key: " ", code: "Space" });
    act(() => vi.advanceTimersByTime(16));
    expect(draw.mock.lastCall?.[3].verticalVelocity).toBeLessThan(30.5);

    fireEvent.keyDown(window, { key: "ArrowDown" });
    act(() => vi.advanceTimersByTime(176));
    expect(draw.mock.lastCall?.[3].height).toBe(0);

    fireEvent.keyDown(window, { key: "ArrowUp" });
    act(() => vi.advanceTimersByTime(16));
    expect(draw.mock.lastCall?.[3].height).toBeGreaterThan(0);
    fireEvent.keyUp(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    act(() => vi.advanceTimersByTime(144));

    fireEvent.pointerDown(jump, { isPrimary: true, pointerId: 1, button: 0, pointerType: "touch" });
    act(() => vi.advanceTimersByTime(32));
    expect(draw.mock.lastCall?.[3].verticalVelocity).toBeGreaterThan(30.5);
    fireEvent.pointerUp(jump, { isPrimary: true, pointerId: 1, button: 0, pointerType: "touch" });
    act(() => vi.advanceTimersByTime(16));
    expect(draw.mock.lastCall?.[3].verticalVelocity).toBeLessThan(30.5);
  });

  it("ends on a tree collision and reports the distance result once", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const onComplete = vi.fn();
    render(<SleighRunnerGame onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    act(() => vi.advanceTimersByTime(2_500));

    expect(screen.getByRole("status")).toHaveTextContent("Саадтай мөргөлдлөө!");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      gameId: "sleigh-runner",
      score: expect.any(Number),
      distance: expect.any(Number),
      elapsedMs: expect.any(Number),
      finalSpeed: expect.any(Number),
    }));
    expect(Number.isInteger(onComplete.mock.calls[0][0].elapsedMs)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Дахин уралдах" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Оноо")).toHaveTextContent("Оноо 0");
  });
});
