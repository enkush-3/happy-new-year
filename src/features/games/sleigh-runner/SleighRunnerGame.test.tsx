import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SleighRunnerGame from "./SleighRunnerGame";
import {
  advanceRunnerFrame,
  getRunnerSpeed,
  RUNNER_MAX_SPEED,
  RUNNER_START_SPEED,
  startRunnerState,
} from "./model";

describe("SleighRunnerGame", () => {
  afterEach(() => vi.useRealTimers());

  it("starts an endless jump-only runner with score, distance, and speed", () => {
    render(<SleighRunnerGame onComplete={vi.fn()} />);

    expect(screen.getByRole("img", { name: "Чимэглэсэн гацуур саадтай чарганы 2D уралдаан" })).toBeInTheDocument();
    expect(screen.getByText("Гацуур дээгүүр харайж аль болох хол яваарай.")).toBeInTheDocument();
    expect(screen.queryByText(/Үлдсэн хугацаа/u)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));

    expect(screen.getByTestId("runner-player")).toHaveAttribute("data-jumping", "false");
    expect(screen.getByTestId("runner-score")).toHaveTextContent("0");
    expect(screen.getByTestId("runner-speed")).toHaveTextContent(RUNNER_START_SPEED + " м/с");
    expect(screen.getByRole("button", { name: /Үсрэх/u })).toBeEnabled();
  });

  it("jumps with ArrowUp or Space and exposes the same action for touch", () => {
    vi.useFakeTimers();
    render(<SleighRunnerGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));

    fireEvent.keyDown(window, { key: "ArrowUp", code: "ArrowUp" });
    act(() => vi.advanceTimersByTime(32));
    expect(screen.getByTestId("runner-player")).toHaveAttribute("data-jumping", "true");

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    act(() => vi.advanceTimersByTime(32));
    expect(screen.getByTestId("runner-player")).toHaveAttribute("data-jumping", "true");

    fireEvent.click(screen.getByRole("button", { name: /Үсрэх/u }));
    expect(screen.getByTestId("runner-player")).toHaveAttribute("data-jumping", "true");
  });

  it("ends on a tree collision and reports the full distance result once", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<SleighRunnerGame onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    act(() => vi.advanceTimersByTime(2_400));

    expect(screen.getByRole("status")).toHaveTextContent("Саадтай мөргөлдлөө!");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      gameId: "sleigh-runner",
      score: expect.any(Number),
      distance: expect.any(Number),
      elapsedMs: expect.any(Number),
      finalSpeed: expect.any(Number),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Дахин уралдах" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("ramps speed smoothly from the start value to a capped maximum", () => {
    expect(getRunnerSpeed(0)).toBe(RUNNER_START_SPEED);
    expect(getRunnerSpeed(1)).toBeCloseTo(RUNNER_START_SPEED + 0.025);
    expect(getRunnerSpeed(100)).toBeGreaterThan(getRunnerSpeed(0));
    expect(getRunnerSpeed(100_000)).toBe(RUNNER_MAX_SPEED);
  });

  it("crashes when a tree reaches the sled unless the sled is in the jump arc", () => {
    const approachingTree = {
      ...startRunnerState(),
      distance: 47,
      score: 47,
      speed: getRunnerSpeed(47),
      obstacles: [{ id: 1, distance: 48 }],
      nextObstacleDistance: 1_000,
      nextObstacleId: 2,
    };

    const collision = advanceRunnerFrame(approachingTree, 30);
    expect(collision.crashed).toBe(true);
    expect(collision.state.status).toBe("ended");

    const jump = advanceRunnerFrame({ ...approachingTree, jumpRemainingMs: 300 }, 30);
    expect(jump.crashed).toBe(false);
    expect(jump.state.status).toBe("running");
  });
});
