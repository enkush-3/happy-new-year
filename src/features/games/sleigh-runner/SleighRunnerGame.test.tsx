import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SleighRunnerGame from "./SleighRunnerGame";

describe("SleighRunnerGame", () => {
  afterEach(() => vi.useRealTimers());

  it("starts a 2D run with keyboard jump controls", () => {
    render(<SleighRunnerGame onComplete={vi.fn()} />);

    expect(screen.getByRole("img", { name: "Чарганы 2D уралдаан" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    fireEvent.keyDown(window, { key: "ArrowUp" });

    expect(screen.getByRole("status", { name: "Гүйж байна" })).toBeInTheDocument();
    expect(screen.getByTestId("runner-player")).toHaveAttribute("data-jumping", "true");
  });

  it("ends the run on an obstacle and reports the distance result once", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<SleighRunnerGame onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    act(() => vi.advanceTimersByTime(4100));

    expect(screen.getByText("Саадтай мөргөлдлөө!" )).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      gameId: "sleigh-runner",
      distance: expect.any(Number),
      giftsCaught: expect.any(Number),
    }));
    fireEvent.click(screen.getByRole("button", { name: "Дахин уралдах" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("lets players collect a gift during a run", () => {
    vi.useFakeTimers();
    render(<SleighRunnerGame onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole("button", { name: "Бэлгийг авах" }));

    expect(screen.getByRole("status", { name: "Авсан бэлэг: 1" })).toBeInTheDocument();
  });
});
