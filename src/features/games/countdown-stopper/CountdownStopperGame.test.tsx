import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CountdownStopperGame from "./CountdownStopperGame";
import { getStopperResult } from "./model";

describe("countdown stopper result", () => {
  it("scores closest to zero highest and handles overtime symmetrically", () => {
    expect(getStopperResult(9_998)).toEqual({ gameId: "countdown-stopper", deviationMs: 2, score: 998 });
    expect(getStopperResult(10_002)).toEqual({ gameId: "countdown-stopper", deviationMs: 2, score: 998 });
    expect(getStopperResult(11_250)).toEqual({ gameId: "countdown-stopper", deviationMs: 1_250, score: 0 });
  });
});

describe("CountdownStopperGame", () => {
  afterEach(() => vi.useRealTimers());

  it("counts down from ten seconds and reports the measured distance from zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T00:00:00.000Z"));
    const onComplete = vi.fn();
    render(<CountdownStopperGame onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    expect(screen.getByTestId("stopper-display")).toHaveTextContent("10.00");

    vi.advanceTimersByTime(10_125);
    fireEvent.click(screen.getByRole("button", { name: "Зогсоох" }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ gameId: "countdown-stopper", deviationMs: 125 }));
  });

  it("lets keyboard users stop the timer with Space", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<CountdownStopperGame onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    const game = screen.getByRole("region", { name: "Яг цагт нь зогсоо" });
    game.focus();
    fireEvent.keyDown(game, { key: " ", code: "Space" });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
