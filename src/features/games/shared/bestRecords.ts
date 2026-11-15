import { decodeGameResult, encodeGameResult } from "./gameShare";
import type { GameId, GameResult } from "./types";

export interface BestRecords {
  sessionBest: GameResult | null;
  deviceBest: GameResult | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BestRecordStores {
  session: StorageLike | null;
  device: StorageLike | null;
}

export interface BestRecordManager {
  get(gameId: GameId): BestRecords;
  record(result: GameResult): BestRecords;
}

type StorageProvider = () => BestRecordStores;
type RecordScope = "session" | "device";

export function createBestRecordManager(getStores: StorageProvider = getBrowserStores): BestRecordManager {
  const memory = {
    session: new Map<GameId, GameResult>(),
    device: new Map<GameId, GameResult>(),
  };

  function get(gameId: GameId): BestRecords {
    const stores = safelyGetStores(getStores);
    return {
      sessionBest: bestOf(
        memory.session.get(gameId) ?? null,
        readStoredBest(stores.session, "session", gameId),
      ),
      deviceBest: bestOf(
        memory.device.get(gameId) ?? null,
        readStoredBest(stores.device, "device", gameId),
      ),
    };
  }

  function record(result: GameResult): BestRecords {
    const current = get(result.gameId);
    const sessionBest = isBetterGameResult(result, current.sessionBest) ? result : current.sessionBest;
    const deviceBest = isBetterGameResult(result, current.deviceBest) ? result : current.deviceBest;

    if (sessionBest) memory.session.set(result.gameId, sessionBest);
    if (deviceBest) memory.device.set(result.gameId, deviceBest);

    const stores = safelyGetStores(getStores);
    if (sessionBest === result) writeStoredBest(stores.session, "session", result);
    if (deviceBest === result) writeStoredBest(stores.device, "device", result);

    return { sessionBest, deviceBest };
  }

  return { get, record };
}

export function isBetterGameResult(candidate: GameResult, current: GameResult | null): boolean {
  if (!current) return true;
  if (candidate.gameId !== current.gameId) return false;

  switch (candidate.gameId) {
    case "gift-catcher": {
      if (current.gameId !== "gift-catcher") return false;
      return compareTuple(
        [candidate.score, candidate.giftsCaught, -candidate.hazardsHit, -candidate.elapsedMs],
        [current.score, current.giftsCaught, -current.hazardsHit, -current.elapsedMs],
      ) > 0;
    }
    case "snowflake-clicker": {
      if (current.gameId !== "snowflake-clicker") return false;
      return compareTuple(
        [candidate.score, candidate.hits, -candidate.elapsedMs],
        [current.score, current.hits, -current.elapsedMs],
      ) > 0;
    }
    case "countdown-stopper": {
      if (current.gameId !== "countdown-stopper") return false;
      return candidate.deviationMs < current.deviationMs;
    }
    case "sleigh-runner": {
      if (current.gameId !== "sleigh-runner") return false;
      return candidate.distance > current.distance ||
        (candidate.distance === current.distance && candidate.giftsCaught > current.giftsCaught);
    }
    case "trivia": {
      if (current.gameId !== "trivia") return false;
      const accuracyDifference = candidate.correctAnswers * current.totalQuestions -
        current.correctAnswers * candidate.totalQuestions;
      return accuracyDifference > 0 ||
        (accuracyDifference === 0 && candidate.correctAnswers > current.correctAnswers);
    }
  }
}

export const bestRecordManager = createBestRecordManager();

function bestOf(first: GameResult | null, second: GameResult | null): GameResult | null {
  if (!first) return second;
  return isBetterGameResult(second ?? first, first) ? second : first;
}

function compareTuple(first: number[], second: number[]): number {
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return first[index] > second[index] ? 1 : -1;
  }
  return 0;
}

function readStoredBest(storage: StorageLike | null, scope: RecordScope, gameId: GameId): GameResult | null {
  try {
    const encoded = storage?.getItem(storageKey(scope, gameId));
    return encoded ? decodeGameResult(encoded, gameId) : null;
  } catch {
    return null;
  }
}

function writeStoredBest(storage: StorageLike | null, scope: RecordScope, result: GameResult): void {
  try {
    storage?.setItem(storageKey(scope, result.gameId), encodeGameResult(result));
  } catch {
    // A private browsing mode or browser policy may block storage; memory still holds this run's best.
  }
}

function safelyGetStores(provider: StorageProvider): BestRecordStores {
  try {
    return provider();
  } catch {
    return { session: null, device: null };
  }
}

function getBrowserStores(): BestRecordStores {
  return {
    session: readBrowserStorage("sessionStorage"),
    device: readBrowserStorage("localStorage"),
  };
}

function readBrowserStorage(name: "sessionStorage" | "localStorage"): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window[name];
  } catch {
    return null;
  }
}

function storageKey(scope: RecordScope, gameId: GameId): string {
  return `happy-new-year:best:${scope}:${gameId}`;
}
