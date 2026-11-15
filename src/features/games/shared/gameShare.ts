import type { GameResult, GameResultPresentation, GameId } from "./types";

const maxEncodedLength = 2048;
const maxDecodedBytes = 1536;

export function encodeGameResult(result: GameResult): string {
  if (!isGameResult(result)) throw new Error("Тоглоомын үр дүн буруу байна.");
  const bytes = new TextEncoder().encode(JSON.stringify(result));
  if (bytes.length > maxDecodedBytes) throw new Error("Хуваалцах үр дүн хэт урт байна.");

  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function decodeGameResult(encoded: string, expectedGameId?: GameId): GameResult | null {
  if (!encoded || encoded.length > maxEncodedLength || !/^[A-Za-z0-9_-]+$/u.test(encoded)) return null;

  try {
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    if (!binary.length || binary.length > maxDecodedBytes) return null;
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isGameResult(value) || (expectedGameId && value.gameId !== expectedGameId)) return null;
    return value;
  } catch {
    return null;
  }
}

export function presentGameResult(result: GameResult): GameResultPresentation {
  switch (result.gameId) {
    case "gift-catcher":
      return { title: "Бэлэг баригч", text: `${result.score} оноо · ${result.giftsCaught} бэлэг тослоо` };
    case "snowflake-clicker":
      return { title: "Цасан ширхэг дарагч", text: `${result.score} оноо · ${result.hits} бай оноолоо` };
    case "countdown-stopper":
      return { title: "Яг цагт нь зогсоо", text: `Тэг цэгээс ${result.deviationMs} миллисекунд зөрлөө` };
    case "sleigh-runner":
      return { title: "Чарганы уралдаан", text: `${result.distance} метр · ${result.giftsCaught} бэлэг цуглууллаа` };
    case "fortune-cookie":
      return { title: "Ирэх жилийн ерөөл", text: result.fortunes.join("\n") };
    case "trivia":
      return { title: "Шинэ жилийн Trivia", text: `${result.correctAnswers}/${result.totalQuestions} зөв · ${result.archetype}` };
  }
}

export function createGameShareUrl(result: GameResult, origin: string): string {
  const url = new URL(`/games/${result.gameId}`, origin);
  url.searchParams.set("result", encodeGameResult(result));
  return url.toString();
}

function isGameResult(value: unknown): value is GameResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  switch (result.gameId) {
    case "gift-catcher":
      return isBoundedInt(result.score, 0, 1_000_000) &&
        isBoundedInt(result.giftsCaught, 0, 1_000_000) &&
        isBoundedInt(result.hazardsHit, 0, 3) &&
        isBoundedInt(result.elapsedMs, 0, 30_000);
    case "snowflake-clicker":
      return isBoundedInt(result.score, 0, 1_000_000) &&
        isBoundedInt(result.hits, 0, 1_000_000) &&
        isBoundedInt(result.elapsedMs, 0, 30_000);
    case "countdown-stopper":
      return isBoundedInt(result.deviationMs, 0, 60_000) && isBoundedInt(result.score, 0, 1_000);
    case "sleigh-runner":
      return isBoundedInt(result.distance, 0, 1_000_000) && isBoundedInt(result.giftsCaught, 0, 1_000_000);
    case "fortune-cookie":
      return Array.isArray(result.fortunes) && result.fortunes.length === 3 &&
        result.fortunes.every((fortune) => typeof fortune === "string" && fortune.trim().length > 0 && fortune.length <= 160);
    case "trivia":
      return isBoundedInt(result.correctAnswers, 0, 10) && result.totalQuestions === 10 &&
        typeof result.archetype === "string" && result.archetype.length > 0 && result.archetype.length <= 48;
    default:
      return false;
  }
}

function isBoundedInt(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}
