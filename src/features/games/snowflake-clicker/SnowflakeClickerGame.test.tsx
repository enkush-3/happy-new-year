import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SnowflakeClickerGame from "./SnowflakeClickerGame";
import { awardSnowflakeHit } from "./model";

describe("snowflake clicker model", () => {
  it("awards one point per hit", () => {
    expect(awardSnowflakeHit({ score: 2, hits: 2 })).toEqual({ score: 3, hits: 3 });
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
});
