import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SleighRunnerGame from "./SleighRunnerGame";

describe("SleighRunnerGame", () => {
  afterEach(() => vi.useRealTimers());

  it("uses Arrow and A/D keys to steer, and arrow keys to jump and slide after starting", () => {
    render(<SleighRunnerGame onComplete={vi.fn()} />);

    expect(screen.getByRole("img", { name: "Чарганы 2D өвлийн уулын уралдаан" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    const player = screen.getByTestId("runner-player");
    expect(player).toHaveStyle({ left: "50%" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(player).toHaveStyle({ left: "23%" });
    fireEvent.keyDown(window, { key: "d" });
    expect(player).toHaveStyle({ left: "50%" });
    fireEvent.keyDown(window, { key: "a" });
    expect(player).toHaveStyle({ left: "23%" });
    fireEvent.keyDown(window, { key: "ф", code: "KeyD" });
    expect(player).toHaveStyle({ left: "50%" });
    fireEvent.keyDown(window, { key: "а", code: "KeyA" });
    expect(player).toHaveStyle({ left: "23%" });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(player).toHaveAttribute("data-jumping", "true");
    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(screen.getByRole("status", { name: "Гүйж байна" })).toBeInTheDocument();
    expect(player).toHaveAttribute("data-sliding", "true");
  });

  it("ignores steering and action keys outside a run or while typing", () => {
    render(<SleighRunnerGame onComplete={vi.fn()} />);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.queryByTestId("runner-player")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Уралдаж эхлэх" }));
    const player = screen.getByTestId("runner-player");
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(input, editable);

    fireEvent.keyDown(input, { key: "a" });
    fireEvent.keyDown(editable, { key: "ArrowLeft" });
    expect(fireEvent.keyDown(input, { key: "ArrowUp" })).toBe(true);
    expect(fireEvent.keyDown(editable, { key: "ArrowRight" })).toBe(true);
    expect(player).toHaveAttribute("data-lane", "1");
    expect(player).toHaveAttribute("data-jumping", "false");

    input.remove();
    editable.remove();
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
