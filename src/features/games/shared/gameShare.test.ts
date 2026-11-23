import { describe, expect, it } from "vitest";
import { decodeGameResult, encodeGameResult, presentGameResult } from "./gameShare";
import type { GameResult } from "./types";

const results: GameResult[] = [
  { gameId: "gift-catcher", score: 120, giftsCaught: 12, hazardsHit: 1, elapsedMs: 30000 },
  { gameId: "snowflake-clicker", score: 45, hits: 45, elapsedMs: 30000 },
  { gameId: "countdown-stopper", elapsedMs: 8_012, targetMs: 8_000, deviationMs: 12, score: 988 },
  { gameId: "sleigh-runner", score: 830, distance: 830, elapsedMs: 18_200, finalSpeed: 520 },
  { gameId: "gift-catcher", score: 1_230, giftsCaught: 123, hazardsHit: 3, elapsedMs: 126_000 },
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

  it("keeps reading old sleigh results while new results contain runner details", () => {
    const oldResult = { gameId: "sleigh-runner", distance: 640, giftsCaught: 4 };
    expect(decodeGameResult(encodePayload(oldResult), "sleigh-runner")).toEqual(oldResult);
    const newResult = results.find((result) => result.gameId === "sleigh-runner")!;
    expect(decodeGameResult(encodeGameResult(newResult), "sleigh-runner")).toEqual(newResult);
    expect(presentGameResult(newResult)).toMatchObject({
      text: expect.stringContaining("оноо"),
      details: expect.arrayContaining([expect.stringContaining("Тоглосон хугацаа"), expect.stringContaining("Эцсийн хурд: 520 м/с")]),
    });
    expect(presentGameResult(newResult).details).toHaveLength(2);
    expect(decodeGameResult(encodePayload({ ...newResult, finalSpeed: -1 }), "sleigh-runner")).toBeNull();
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

  it("includes dynamic targets in shared stopper summaries and rejects inconsistent targets", () => {
    const result = { gameId: "countdown-stopper" as const, elapsedMs: 8_125, targetMs: 8_000, deviationMs: 125, score: 875 };
    expect(presentGameResult(decodeGameResult(encodeGameResult(result), "countdown-stopper")!)).toMatchObject({
      details: expect.arrayContaining(["Хэмжсэн хугацаа: 8.125 сек", "Зорилтот хугацаа: 8.000 сек"]),
    });
    expect(decodeGameResult(encodePayload({ ...result, targetMs: 4_999 }), "countdown-stopper")).toBeNull();
    expect(decodeGameResult(encodePayload({ ...result, deviationMs: 124, score: 876 }), "countdown-stopper")).toBeNull();
  });

  it("keeps the fixed target when presenting elapsed legacy stopper links", () => {
    const oldElapsedResult = { gameId: "countdown-stopper", elapsedMs: 20_282, deviationMs: 12, score: 988 };
    const decoded = decodeGameResult(encodePayload(oldElapsedResult), "countdown-stopper");
    expect(decoded).toEqual(oldElapsedResult);
    expect(presentGameResult(decoded!)).toMatchObject({
      details: expect.arrayContaining(["Зорилтот хугацаа: 20.270 сек"]),
    });
  });

  it("creates a readable share summary for each game result", () => {
    for (const result of results) {
      const presentation = presentGameResult(result);
      expect(presentation.title.length).toBeGreaterThan(0);
      expect(presentation.text.length).toBeGreaterThan(0);
    }
  });
});
