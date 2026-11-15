import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TriviaGame, { TRIVIA_QUESTIONS } from "./TriviaGame";

describe("TriviaGame", () => {
  it("contains at least 120 unique, valid evergreen winter questions", () => {
    expect(TRIVIA_QUESTIONS.length).toBeGreaterThanOrEqual(120);
    expect(new Set(TRIVIA_QUESTIONS.map((question) => question.prompt)).size).toBe(TRIVIA_QUESTIONS.length);
    for (const question of TRIVIA_QUESTIONS) {
      expect(question.prompt.length).toBeGreaterThan(0);
      expect(question.answers).toHaveLength(4);
      expect(new Set(question.answers).size).toBe(4);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(4);
    }
  });

  it("asks about daylight duration for the Northern Hemisphere winter solstice", () => {
    const solsticeQuestion = TRIVIA_QUESTIONS.find((question) =>
      question.answers[question.correctIndex] === "Жилийн хамгийн богино өдөр байдаг",
    );

    expect(solsticeQuestion).toBeDefined();
    expect(solsticeQuestion!.prompt).toMatch(/өдрийн гэрлийн хугацаа/u);
    expect(solsticeQuestion!.answers[solsticeQuestion!.correctIndex]).toBe("Жилийн хамгийн богино өдөр байдаг");
  });

  it("scores a completed quiz and reports the celebrator type", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<TriviaGame onComplete={onComplete} />);

    let expectedTotal = 0;
    while (screen.getByRole("button", { name: /хариулах|үр дүн харах/i })) {
      const progress = screen.getByText(/Асуулт \d+ \/ \d+/).textContent ?? "";
      expectedTotal = Number(progress.match(/\/ (\d+)/u)?.[1] ?? 0);
      const prompt = screen.getByRole("heading", { level: 2 }).textContent;
      const question = TRIVIA_QUESTIONS.find((candidate) => candidate.prompt === prompt);
      expect(question).toBeDefined();
      await user.click(screen.getByRole("button", { name: question!.answers[question!.correctIndex] }));
      await user.click(screen.getByRole("button", { name: "Хариулах" }));
      if (screen.queryByRole("button", { name: "Дараагийн асуулт" })) {
        await user.click(screen.getByRole("button", { name: "Дараагийн асуулт" }));
      } else {
        break;
      }
    }
    if (screen.queryByRole("button", { name: "Үр дүн харах" })) {
      await user.click(screen.getByRole("button", { name: "Үр дүн харах" }));
    }

    expect(screen.getByText(`${expectedTotal} / ${expectedTotal} зөв хариулт`)).toBeInTheDocument();
    expect(expectedTotal).toBeGreaterThanOrEqual(10);
    expect(expectedTotal).toBeLessThanOrEqual(20);
    expect(screen.getByRole("heading", { name: /шинэ жилийн баярлагч/i })).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      gameId: "trivia",
      correctAnswers: expectedTotal,
      totalQuestions: expectedTotal,
      archetype: expect.any(String),
    }));
  });

  it("does not advance until the current answer is submitted", () => {
    render(<TriviaGame onComplete={vi.fn()} />);

    expect(screen.getByText(/Асуулт 1 \/ (1[0-9]|20)/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Хариулах" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Дараагийн асуулт" })).not.toBeInTheDocument();
  });
});
