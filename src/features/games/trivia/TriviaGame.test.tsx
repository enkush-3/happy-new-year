import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TriviaGame, { TRIVIA_QUESTIONS } from "./TriviaGame";

describe("TriviaGame", () => {
  it("contains ten evergreen New Year questions", () => {
    expect(TRIVIA_QUESTIONS).toHaveLength(10);
    for (const question of TRIVIA_QUESTIONS) {
      expect(question.prompt.length).toBeGreaterThan(0);
      expect(question.answers).toHaveLength(4);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(4);
    }
  });

  it("scores a completed quiz and reports the celebrator type", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<TriviaGame onComplete={onComplete} />);

    for (const [index, question] of TRIVIA_QUESTIONS.entries()) {
      await user.click(screen.getByRole("button", { name: question.answers[question.correctIndex] }));
      await user.click(screen.getByRole("button", { name: "Хариулах" }));
      if (index < TRIVIA_QUESTIONS.length - 1) {
        await user.click(screen.getByRole("button", { name: "Дараагийн асуулт" }));
      }
    }

    await user.click(screen.getByRole("button", { name: "Үр дүн харах" }));

    expect(screen.getByText("10 / 10 зөв хариулт")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /шинэ жилийн баярлагч/i })).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      gameId: "trivia",
      correctAnswers: 10,
      totalQuestions: 10,
      archetype: expect.any(String),
    }));
  });

  it("does not advance until the current answer is submitted", () => {
    render(<TriviaGame onComplete={vi.fn()} />);

    expect(screen.getByText("Асуулт 1 / 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Хариулах" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Дараагийн асуулт" })).not.toBeInTheDocument();
  });
});
