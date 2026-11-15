import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SnowflakeClickerGame from "./SnowflakeClickerGame";
import { awardSnowflakeHit, getSnowflakeDifficulty } from "./model";

describe("snowflake clicker model", () => {
  it("awards one point per hit", () => {
    expect(awardSnowflakeHit({ score: 2, hits: 2 })).toEqual({ score: 3, hits: 3 });
  });

  it("spawns and expires snowflakes faster as the round runs out", () => {
    const start = getSnowflakeDifficulty(0);
    const middle = getSnowflakeDifficulty(15_000);
    const end = getSnowflakeDifficulty(30_000);

    expect(start.spawnIntervalMs).toBeGreaterThan(middle.spawnIntervalMs);
    expect(middle.spawnIntervalMs).toBeGreaterThan(end.spawnIntervalMs);
    expect(start.lifetimeMs).toBeGreaterThan(middle.lifetimeMs);
    expect(middle.lifetimeMs).toBeGreaterThan(end.lifetimeMs);
    expect(end.spawnIntervalMs).toBeGreaterThanOrEqual(280);
    expect(end.lifetimeMs).toBeGreaterThanOrEqual(650);
  });

  it("clamps the pacing curve outside the round", () => {
    expect(getSnowflakeDifficulty(-1)).toEqual(getSnowflakeDifficulty(0));
    expect(getSnowflakeDifficulty(40_000)).toEqual(getSnowflakeDifficulty(30_000));
  });
});

describe("SnowflakeClickerGame", () => {
  afterEach(() => vi.useRealTimers());

  it("starts a timed round, counts tapped snowflakes, and reports the result", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<SnowflakeClickerGame onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));

    fireEvent.click(screen.getByRole("button", { name: /Цасан ширхэг дарах/ }));
    expect(screen.getByText("1 оноо")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30_100));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ gameId: "snowflake-clicker", score: 1, hits: 1 }));
  });

  it("pauses its round timer while the page is hidden", () => {
    vi.useFakeTimers();
    render(<SnowflakeClickerGame onComplete={vi.fn()} />);
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
});
