import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CountdownStopperGame from "./CountdownStopperGame";
import { getStopperResult, getStopperTargetMs } from "./model";

describe("countdown stopper result", () => {
  it("randomizes integer targets across the inclusive 5 to 10 second interval", () => {
    expect(getStopperTargetMs(() => 0)).toBe(5_000);
    expect(getStopperTargetMs(() => 0.999999999)).toBe(10_000);
    expect(getStopperTargetMs(() => 0.5)).toBe(7_500);
  });

  it("scores closest to the round target highest and handles overtime symmetrically", () => {
    expect(getStopperResult(5_000, 5_000)).toEqual({ gameId: "countdown-stopper", elapsedMs: 5_000, targetMs: 5_000, deviationMs: 0, score: 1_000 });
    expect(getStopperResult(4_998, 5_000)).toEqual({ gameId: "countdown-stopper", elapsedMs: 4_998, targetMs: 5_000, deviationMs: 2, score: 998 });
    expect(getStopperResult(6_250, 5_000)).toEqual({ gameId: "countdown-stopper", elapsedMs: 6_250, targetMs: 5_000, deviationMs: 1_250, score: 0 });
  });
});

describe("CountdownStopperGame", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the exact target and reports elapsed time, target, and deviation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T00:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onComplete = vi.fn();
    render(<CountdownStopperGame onComplete={onComplete} />);
    expect(screen.getByText("Зорилт").parentElement).toHaveTextContent("5.000 сек");
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    expect(screen.getByTestId("stopper-display")).toHaveTextContent("0.00");

    vi.advanceTimersByTime(5_125);
    fireEvent.click(screen.getByRole("button", { name: "Зогсоох" }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ gameId: "countdown-stopper", elapsedMs: 5_125, targetMs: 5_000, deviationMs: 125 }));
    expect(screen.getByText(/Зорилт: 5\.000 сек/)).toBeInTheDocument();
    expect(screen.getByText(/5\.125 сек/)).toBeInTheDocument();
  });

  it("chooses a fresh target for replay", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.999999999);
    const onComplete = vi.fn();
    render(<CountdownStopperGame onComplete={onComplete} />);

    expect(screen.getByText("Зорилт").parentElement).toHaveTextContent("5.000 сек");
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    fireEvent.click(screen.getByRole("button", { name: "Зогсоох" }));
    fireEvent.click(screen.getByRole("button", { name: "Дахин тоглох" }));

    expect(screen.getByText("Зорилт").parentElement).toHaveTextContent("10.000 сек");
    vi.advanceTimersByTime(10_010);
    fireEvent.click(screen.getByRole("button", { name: "Зогсоох" }));

    expect(onComplete).toHaveBeenLastCalledWith(expect.objectContaining({ targetMs: 10_000, elapsedMs: 10_010, deviationMs: 10 }));
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
