import { describe, expect, it } from "vitest";
import { decodeGameResult, encodeGameResult, presentGameResult } from "./gameShare";
import type { GameResult } from "./types";

const results: GameResult[] = [
  { gameId: "gift-catcher", score: 120, giftsCaught: 12, hazardsHit: 1, elapsedMs: 30000 },
  { gameId: "snowflake-clicker", score: 45, hits: 45, elapsedMs: 30000 },
  { gameId: "countdown-stopper", elapsedMs: 20_282, deviationMs: 12, score: 988 },
  { gameId: "sleigh-runner", distance: 830, giftsCaught: 8 },
  { gameId: "trivia", correctAnswers: 8, totalQuestions: 10, archetype: "Баярын мастер" },
];

function encodePayload(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

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

  it("accepts variable trivia totals from 10 to 20, including legacy ten-question links", () => {
    const variableTrivia = { gameId: "trivia", correctAnswers: 13, totalQuestions: 17, archetype: "Баярын мастер" };
    expect(decodeGameResult(encodePayload(variableTrivia), "trivia")).toEqual(variableTrivia);
    expect(decodeGameResult(encodeGameResult(results.find((result) => result.gameId === "trivia")!), "trivia")).toEqual(
      results.find((result) => result.gameId === "trivia"),
    );
    expect(decodeGameResult(encodePayload({ ...variableTrivia, totalQuestions: 21 }), "trivia")).toBeNull();
    expect(decodeGameResult(encodePayload({ ...variableTrivia, correctAnswers: 18 }), "trivia")).toBeNull();
  });

  it("decodes old stopper links without inventing an elapsed time", () => {
    const oldResult = { gameId: "countdown-stopper", deviationMs: 45, score: 955 };
    const decoded = decodeGameResult(encodePayload(oldResult), "countdown-stopper");

    expect(decoded).toEqual(oldResult);
    expect(presentGameResult(decoded!)).toMatchObject({
      details: expect.arrayContaining([expect.stringContaining("хугацаа хадгалагдаагүй")]),
    });
    expect(decodeGameResult(encodePayload({ ...oldResult, elapsedMs: 20_300 }), "countdown-stopper")).toBeNull();
  });

  it("does not decode retired Fortune Cookie results", () => {
    expect(decodeGameResult(encodePayload({
      gameId: "fortune-cookie",
      fortunes: ["Аз жаргал ирнэ", "Шинэ найзтай болно", "Сайхан аялал хийнэ"],
    }))).toBeNull();
  });

  it("creates a readable share summary for each game result", () => {
    for (const result of results) {
      const presentation = presentGameResult(result);
      expect(presentation.title.length).toBeGreaterThan(0);
      expect(presentation.text.length).toBeGreaterThan(0);
    }
  });
});
