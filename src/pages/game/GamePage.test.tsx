import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
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
});
