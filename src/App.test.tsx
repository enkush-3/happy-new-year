import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import App from "./App";

function renderApp(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Happy New Year game hub", () => {
  it("shows the local 2027 countdown from the home route", () => {
    renderApp("/");

    expect(screen.getByRole("heading", { name: /2027/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Үндсэн цэс" })).toBeInTheDocument();
    expect(screen.getByText(/хоног/)).toBeInTheDocument();
  });

  it("shows a denser snowfall behind the app", () => {
    renderApp("/");

    expect(document.querySelectorAll(".ambient-snow > i")).toHaveLength(136);
  });

  it("keeps one clear games call to action on the home page", () => {
    renderApp("/");

    const heroCta = screen.getByRole("link", { name: /Тоглоомууд үзэх/ });
    expect(heroCta).toHaveClass("hero-cta");
    expect(screen.queryByRole("link", { name: /Бүх тоглоом/ })).not.toBeInTheDocument();
  });

  it("lists five public games, includes the tree decorator, and omits retired games", () => {
    renderApp("/games");

    expect(screen.getByRole("heading", { name: "Тоглоомууд" })).toBeInTheDocument();
    expect(document.querySelectorAll(".games-page__grid a.game-card")).toHaveLength(5);
    expect(document.querySelector('a[href="/games/fortune-cookie"]')).toBeNull();
    expect(document.querySelector('a[href="/games/trivia"]')).toBeNull();
  });

  it("navigates from the header to the game library", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.click(screen.getByRole("link", { name: "Тоглоомууд" }));

    expect(screen.getByRole("heading", { name: "Тоглоомууд" })).toBeInTheDocument();
  });

  it("opens a game from its stable route", () => {
    renderApp("/games/countdown-stopper");

    expect(screen.getByRole("heading", { level: 1, name: "Яг цагт нь зогсоо" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /эхлэх/i })).toBeInTheDocument();
  });

  it("routes legacy tree share links to the preserved tree builder", async () => {
    renderApp("/#tree=eyJ2IjoxLCJkIjpbXX0");

    expect(await screen.findByRole("heading", { name: "Өөрийн гацуураа чимэглэ" })).toBeInTheDocument();
  });

  it("shows a not-found page for unknown games", () => {
    renderApp("/games/unknown-game");

    expect(screen.getByRole("heading", { name: "Тоглоом олдсонгүй" })).toBeInTheDocument();
  });
});
