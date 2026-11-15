import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import { encodeGameResult } from "../../features/games/shared/gameShare";

const sharedResult = {
  gameId: "gift-catcher" as const,
  score: 120,
  giftsCaught: 12,
  hazardsHit: 1,
  elapsedMs: 30_000,
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("shared game result routes", () => {
  it("restores the exact result from its share URL", () => {
    renderAt(`/games/gift-catcher?result=${encodeGameResult(sharedResult)}`);

    expect(screen.getByRole("heading", { level: 2, name: "Бэлэг баригч" })).toBeInTheDocument();
    expect(screen.getByText(/120 оноо · 12 бэлэг тослоо/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /дахин тоглох/i })).toBeInTheDocument();
  });

  it("falls back to the initial game when a result payload is malformed", () => {
    renderAt("/games/countdown-stopper?result=not-a-valid-payload");

    expect(screen.getByRole("button", { name: "Тоглож эхлэх" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ТАНЫ ҮР ДҮН" })).not.toBeInTheDocument();
  });

  it("does not expose the retired Fortune Cookie route", () => {
    renderAt("/games/fortune-cookie");

    expect(screen.getByRole("heading", { name: "Тоглоом олдсонгүй" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Тоглоомууд руу буцах" })).toHaveAttribute("href", "/games");
  });

  it("shows stopper elapsed details and persists local session/device bests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T00:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.6001);
    window.sessionStorage.clear();
    window.localStorage.clear();
    renderAt("/games/countdown-stopper");

    expect(screen.getByText("Зорилт").parentElement).toHaveTextContent("8.001 сек");
    fireEvent.click(screen.getByRole("button", { name: "Тоглож эхлэх" }));
    act(() => vi.advanceTimersByTime(8_001));
    fireEvent.click(screen.getByRole("button", { name: "Зогсоох" }));

    expect(screen.getByText(/Хэмжсэн хугацаа: 8\.001 сек/)).toBeInTheDocument();
    expect(screen.getByText(/Зорилтот хугацаа: 8\.001 сек/)).toBeInTheDocument();
    expect(screen.getByText(/Энэ сессийн шилдэг:/)).toBeInTheDocument();
    expect(screen.getByText(/Энэ төхөөрөмжийн шилдэг:/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem("happy-new-year:best:session:countdown-stopper")).not.toBeNull();
    expect(window.localStorage.getItem("happy-new-year:best:device:countdown-stopper")).not.toBeNull();
  });

  it("does not update best records when opening a shared result", () => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    const sessionWrite = vi.spyOn(Storage.prototype, "setItem");
    const result = {
      gameId: "countdown-stopper" as const,
      elapsedMs: 8_000,
      targetMs: 8_000,
      deviationMs: 0,
      score: 1_000,
    };

    renderAt(`/games/countdown-stopper?result=${encodeGameResult(result)}`);

    expect(screen.getByText(/Хэмжсэн хугацаа: 8\.000 сек/)).toBeInTheDocument();
    expect(screen.getByText(/Зорилтот хугацаа: 8\.000 сек/)).toBeInTheDocument();
    expect(sessionWrite).not.toHaveBeenCalled();
  });
});
