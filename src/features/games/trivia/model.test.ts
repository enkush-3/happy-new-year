import { describe, expect, it } from "vitest";
import { createTriviaRun, MAX_TRIVIA_QUESTIONS, MIN_TRIVIA_QUESTIONS } from "./model";

const pool = Array.from({ length: 120 }, (_, index) => ({
  prompt: `Өвлийн асуулт ${index}`,
  answers: ["А", "Б", "В", "Г"] as [string, string, string, string],
  correctIndex: index % 4,
}));

describe("random trivia runs", () => {
  it("selects a unique 10–20 question run without mutating the pool", () => {
    const before = pool.map((question) => question.prompt);
    const run = createTriviaRun(pool, () => 0.5);

    expect(run.length).toBeGreaterThanOrEqual(MIN_TRIVIA_QUESTIONS);
    expect(run.length).toBeLessThanOrEqual(MAX_TRIVIA_QUESTIONS);
    expect(new Set(run.map((question) => question.prompt)).size).toBe(run.length);
    expect(pool.map((question) => question.prompt)).toEqual(before);
  });

  it("can choose both endpoints of the allowed run size", () => {
    expect(createTriviaRun(pool, () => 0)).toHaveLength(MIN_TRIVIA_QUESTIONS);
    expect(createTriviaRun(pool, () => 0.999_999)).toHaveLength(MAX_TRIVIA_QUESTIONS);
  });
});
