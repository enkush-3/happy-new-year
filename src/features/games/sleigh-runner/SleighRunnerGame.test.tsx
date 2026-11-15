import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SleighRunnerGame from "./SleighRunnerGame";

describe("SleighRunnerGame", () => {
  afterEach(() => vi.useRealTimers());

  it("uses arrow keys to steer, jump, and slide", () => {
    render(<SleighRunnerGame onComplete={vi.fn()} />);

    expect(screen.getByRole("img", { name: "Чарганы 2D өвлийн уулын уралдаан" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    const player = screen.getByTestId("runner-player");
    expect(player).toHaveStyle({ left: "50%" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(player).toHaveStyle({ left: "23%" });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(player).toHaveAttribute("data-jumping", "true");
    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(screen.getByRole("status", { name: "Гүйж байна" })).toBeInTheDocument();
    expect(player).toHaveAttribute("data-sliding", "true");
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

  it("automatically collects a gift when the sled reaches it", () => {
    vi.useFakeTimers();
    render(<SleighRunnerGame onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    act(() => vi.advanceTimersByTime(2_400));

    expect(screen.getByRole("status", { name: "Авсан бэлэг: 1" })).toBeInTheDocument();
  });

  it("offers touch controls for steering, jumping, and sliding", () => {
    render(<SleighRunnerGame onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));

    expect(screen.getByRole("button", { name: "Зүүн тийш чиглүүлэх" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Үсрэх" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Доош гулгах" })).toBeEnabled();
  });

  it("lets Space activate a focused touch control without also triggering the global jump", async () => {
    const user = userEvent.setup();
    render(<SleighRunnerGame onComplete={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    const slideButton = screen.getByRole("button", { name: "Доош гулгах" });
    await user.click(slideButton);
    await user.keyboard(" ");

    expect(screen.getByTestId("runner-player")).toHaveAttribute("data-sliding", "true");
    expect(screen.getByTestId("runner-player")).toHaveAttribute("data-jumping", "false");
  });
});
