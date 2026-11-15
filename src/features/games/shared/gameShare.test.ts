import { describe, expect, it } from "vitest";
import { decodeGameResult, encodeGameResult, presentGameResult } from "./gameShare";
import type { GameResult } from "./types";

const results: GameResult[] = [
  { gameId: "gift-catcher", score: 120, giftsCaught: 12, hazardsHit: 1, elapsedMs: 30000 },
  { gameId: "snowflake-clicker", score: 45, hits: 45, elapsedMs: 30000 },
  { gameId: "countdown-stopper", deviationMs: 12, score: 988 },
  { gameId: "sleigh-runner", distance: 830, giftsCaught: 8 },
  { gameId: "fortune-cookie", fortunes: ["Аз жаргал ирнэ", "Шинэ найзтай болно", "Сайхан аялал хийнэ"] },
  { gameId: "trivia", correctAnswers: 8, totalQuestions: 10, archetype: "Баярын мастер" },
];

describe("game result sharing", () => {
  it.each(results)("round-trips the $gameId result, including Mongolian text", (result) => {
    expect(decodeGameResult(encodeGameResult(result), result.gameId)).toEqual(result);
  });

  it("rejects malformed, oversized, and mismatched result payloads", () => {
    expect(decodeGameResult("not-base64!", "gift-catcher")).toBeNull();
    expect(decodeGameResult("x".repeat(2049), "gift-catcher")).toBeNull();
    expect(decodeGameResult(encodeGameResult(results[0]), "snowflake-clicker")).toBeNull();
    const invalidJson = JSON.stringify({ ...results[0], score: -1 });
    const invalidPayload = btoa(invalidJson).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    expect(decodeGameResult(invalidPayload, "gift-catcher")).toBeNull();
  });

  it("creates a readable share summary for each game result", () => {
    for (const result of results) {
      const presentation = presentGameResult(result);
      expect(presentation.title.length).toBeGreaterThan(0);
      expect(presentation.text.length).toBeGreaterThan(0);
    }
  });
});
