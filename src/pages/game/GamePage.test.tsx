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

    expect(screen.getByRole("heading", { level: 1, name: "Бэлэг баригч" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Бэлэг баригч" })).toHaveLength(1);
    expect(screen.getAllByRole("region", { name: "Бэлэг баригч" })).toHaveLength(1);
    expect(screen.getByLabelText("120 оноо · 12 бэлэг тослоо")).toBeInTheDocument();
    expect(screen.getByText("120", { selector: ".game-result-score" })).toBeInTheDocument();
    expect(screen.getByText("12 бэлэг амжилттай тослоо")).toBeInTheDocument();
    expect(document.querySelectorAll(".game-result-stat")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Дараагийн тоглоом: Цасан ширхэг дарагч" })).toHaveAttribute("href", "/games/snowflake-clicker");
    expect(screen.getByRole("link", { name: /бүх тоглоом/i })).toHaveClass("game-result-back");
    expect(screen.getByRole("button", { name: /дахин тоглох/i })).toBeInTheDocument();
  });

  it("restores the distance, play time, and speed from a Sleigh Runner share link", () => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    const result = {
      gameId: "sleigh-runner" as const,
      score: 830,
      distance: 830,
      elapsedMs: 18_200,
      finalSpeed: 52,
    };

    renderAt(`/games/sleigh-runner?result=${encodeGameResult(result)}`);

    expect(screen.getByRole("heading", { level: 1, name: "Бэлгийн чарга" })).toBeInTheDocument();
    expect(screen.getByText("830", { selector: ".game-result-score" })).toBeInTheDocument();
    expect(screen.getByText("Эцсийн хурд").nextElementSibling).toHaveTextContent("52 м/с");
    expect(document.querySelectorAll(".game-result-stat")).toHaveLength(4);
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

  it("does not expose the removed Trivia route", () => {
    renderAt("/games/trivia");

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

    expect(screen.getByText("Хугацаа").nextElementSibling).toHaveTextContent("8.001 сек");
    expect(screen.getByText("Зорилтот хугацаа").nextElementSibling).toHaveTextContent("8.001 сек");
    expect(screen.getByText("Сессийн шилдэг").nextElementSibling).toHaveTextContent("Зорилтоос 0 мс зөрлөө");
    expect(screen.getByText("Дээд амжилт").nextElementSibling).toHaveTextContent("Зорилтоос 0 мс зөрлөө");
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

    expect(screen.getByText("Хугацаа").nextElementSibling).toHaveTextContent("8.000 сек");
    expect(screen.getByText("Зорилтот хугацаа").nextElementSibling).toHaveTextContent("8.000 сек");
    expect(sessionWrite).not.toHaveBeenCalled();
  });
});
