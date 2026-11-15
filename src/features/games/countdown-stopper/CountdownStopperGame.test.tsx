import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CountdownStopperGame from "./CountdownStopperGame";
import { getStopperResult } from "./model";

describe("countdown stopper result", () => {
  it("scores closest to zero highest and handles overtime symmetrically", () => {
    expect(getStopperResult(20_270)).toEqual({ gameId: "countdown-stopper", elapsedMs: 20_270, deviationMs: 0, score: 1_000 });
    expect(getStopperResult(20_268)).toEqual({ gameId: "countdown-stopper", elapsedMs: 20_268, deviationMs: 2, score: 998 });
    expect(getStopperResult(21_520)).toEqual({ gameId: "countdown-stopper", elapsedMs: 21_520, deviationMs: 1_250, score: 0 });
  });
});

describe("CountdownStopperGame", () => {
  afterEach(() => vi.useRealTimers());

  it("counts up from zero to the target and reports exact elapsed time and deviation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T00:00:00.000Z"));
    const onComplete = vi.fn();
    render(<CountdownStopperGame onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    expect(screen.getByTestId("stopper-display")).toHaveTextContent("0.00");

    vi.advanceTimersByTime(20_375);
    fireEvent.click(screen.getByRole("button", { name: "Зогсоох" }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ gameId: "countdown-stopper", elapsedMs: 20_375, deviationMs: 105 }));
    expect(screen.getByText(/20\.375 сек/)).toBeInTheDocument();
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
