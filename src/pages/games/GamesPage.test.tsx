import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import GamesPage from "./GamesPage";
import { encodeGameResult } from "../../features/games/shared/gameShare";

function renderGamesPage() {
  return render(
    <MemoryRouter>
      <GamesPage />
    </MemoryRouter>,
  );
}

describe("games page", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("filters the catalog and derives counts from each category", () => {
    renderGamesPage();

    const allGames = screen.getByRole("button", { name: "Бүгд (5)" });
    const actionGames = screen.getByRole("button", { name: "Авхаалж (4)" });
    const creativeGames = screen.getByRole("button", { name: "Бүтээлч (1)" });

    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("status")).toHaveTextContent("5 тоглоом");
    fireEvent.click(actionGames);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent("4 тоглоом");
    expect(screen.getByRole("link", { name: /Бэлэг баригч/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Гацуураа чимэглэ/ })).not.toBeInTheDocument();

    fireEvent.click(creativeGames);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /Шинэ жилийн Trivia/ })).not.toBeInTheDocument();

    fireEvent.click(allGames);
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("makes each card a single accessible link with a clear play action", () => {
    renderGamesPage();

    const giftCard = screen.getByRole("link", { name: /Бэлэг баригч.*Одоо тоглох/ });
    expect(giftCard).toHaveAttribute("href", "/games/gift-catcher");
    expect(within(giftCard).queryByRole("link")).not.toBeInTheDocument();
    expect(giftCard.querySelector(".game-card__body")?.tagName).toBe("DIV");
    expect(within(giftCard).getByText(/нүүрс ба цасан бөмбөг/i)).toBeInTheDocument();
  });

  it("shows the saved personal best for score-based games", () => {
    const bestResult = {
      gameId: "gift-catcher" as const,
      score: 840,
      giftsCaught: 14,
      hazardsHit: 0,
      elapsedMs: 30_000,
    };
    window.sessionStorage.setItem("happy-new-year:best:session:gift-catcher", encodeGameResult(bestResult));
    window.localStorage.setItem("happy-new-year:best:device:gift-catcher", encodeGameResult(bestResult));

    renderGamesPage();

    expect(screen.getByText(/Миний рекорд: 840 оноо · 14 бэлэг тослоо/)).toBeInTheDocument();
  });

  it("marks unplayed games as new and keeps the tree workshop nonnumeric", () => {
    renderGamesPage();

    expect(screen.getAllByText("Тоглож үзээгүй").length).toBeGreaterThan(0);
    const treeCard = screen.getByRole("link", { name: /Гацуураа чимэглэ/ });
    expect(within(treeCard).getByText(/Бүтээлч урлан/)).toBeInTheDocument();
    expect(within(treeCard).queryByText(/Миний рекорд/)).not.toBeInTheDocument();
  });
});
