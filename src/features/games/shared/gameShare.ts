import type { GameResult, GameResultPresentation, GameId } from "./types";
import { COUNTDOWN_STOPPER_MAX_TARGET_MS, COUNTDOWN_STOPPER_MIN_TARGET_MS } from "../countdown-stopper/model";

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
      return {
        title: "Бэлэг баригч",
        text: `${result.score} оноо · ${result.giftsCaught} бэлэг тослоо`,
        details: [`Саад мөргөсөн: ${result.hazardsHit}`, `Тоглосон хугацаа: ${formatSeconds(result.elapsedMs)} сек`],
      };
    case "snowflake-clicker":
      return {
        title: "Цасан ширхэг дарагч",
        text: `${result.score} оноо · ${result.hits} бай оноолоо`,
        details: [`Оносон бай: ${result.hits}`, `Тоглосон хугацаа: ${formatSeconds(result.elapsedMs)} сек`],
      };
    case "countdown-stopper":
      if (!("elapsedMs" in result)) {
        return {
          title: "Яг цагт нь зогсоо",
          text: `Хуучин үр дүн · ${result.deviationMs} мс зөрүү`,
          details: ["Яг хэмжсэн хугацаа хадгалагдаагүй.", "Хуучин холбоос зорилтот хугацааг хадгалаагүй."],
        };
      }
      const targetMs = "targetMs" in result && result.targetMs !== undefined ? result.targetMs : 20_270;
      return {
        title: "Яг цагт нь зогсоо",
        text: `Зорилтоос ${result.deviationMs} мс зөрлөө`,
        details: [`Хэмжсэн хугацаа: ${formatSeconds(result.elapsedMs, 3)} сек`, `Зорилтот хугацаа: ${formatSeconds(targetMs, 3)} сек`],
      };
    case "sleigh-runner":
      return {
        title: "Чарганы уралдаан",
        text: `${result.distance} метр · ${result.giftsCaught} бэлэг цуглууллаа`,
        details: [`Туулсан зай: ${result.distance} м`, `Цуглуулсан бэлэг: ${result.giftsCaught}`],
      };
    case "trivia":
      return {
        title: "Шинэ жилийн Trivia",
        text: `${result.correctAnswers}/${result.totalQuestions} зөв · ${result.archetype}`,
        details: [`Зөв хариулт: ${result.correctAnswers} / ${result.totalQuestions}`, `Онооны хувь: ${Math.round((result.correctAnswers / result.totalQuestions) * 100)}%`],
      };
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
      if (!isBoundedInt(result.deviationMs, 0, 86_400_000) ||
        !isBoundedInt(result.score, 0, 1_000) ||
        result.score !== Math.max(0, 1_000 - result.deviationMs)) return false;
      if (result.elapsedMs === undefined) return result.targetMs === undefined;
      if (!isBoundedInt(result.elapsedMs, 0, 86_400_000)) return false;
      if (result.targetMs === undefined) return result.deviationMs === Math.abs(result.elapsedMs - 20_270);
      return isBoundedInt(result.targetMs, COUNTDOWN_STOPPER_MIN_TARGET_MS, COUNTDOWN_STOPPER_MAX_TARGET_MS) &&
        result.deviationMs === Math.abs(result.elapsedMs - result.targetMs);
    case "sleigh-runner":
      return isBoundedInt(result.distance, 0, 1_000_000) && isBoundedInt(result.giftsCaught, 0, 1_000_000);
    case "trivia":
      return isBoundedInt(result.totalQuestions, 10, 20) &&
        isBoundedInt(result.correctAnswers, 0, result.totalQuestions) &&
        typeof result.archetype === "string" && result.archetype.length > 0 && result.archetype.length <= 48;
    default:
      return false;
  }
}

function isBoundedInt(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function formatSeconds(milliseconds: number, decimals = 2): string {
  return (milliseconds / 1_000).toFixed(decimals);
}
