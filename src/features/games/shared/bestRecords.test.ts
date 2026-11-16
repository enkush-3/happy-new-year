import { beforeEach, describe, expect, it } from "vitest";
import {
  createBestRecordManager,
  isBetterGameResult,
  type BestRecordStores,
  type StorageLike,
} from "./bestRecords";
import type { GameResult } from "./types";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("per-game best records", () => {
  let stores: BestRecordStores;
  let manager: ReturnType<typeof createBestRecordManager>;

  beforeEach(() => {
    stores = { session: new MemoryStorage(), device: new MemoryStorage() };
    manager = createBestRecordManager(() => stores);
  });

  it("uses each game's natural best comparator", () => {
    expect(isBetterGameResult({ gameId: "gift-catcher", score: 101, giftsCaught: 3, hazardsHit: 0, elapsedMs: 30_000 },
      { gameId: "gift-catcher", score: 100, giftsCaught: 4, hazardsHit: 0, elapsedMs: 30_000 })).toBe(true);
    expect(isBetterGameResult({ gameId: "countdown-stopper", elapsedMs: 20_275, deviationMs: 5, score: 995 },
      { gameId: "countdown-stopper", elapsedMs: 20_300, deviationMs: 30, score: 970 })).toBe(true);
    expect(isBetterGameResult({ gameId: "sleigh-runner", score: 900, distance: 900, elapsedMs: 18_000, finalSpeed: 610 },
      { gameId: "sleigh-runner", score: 850, distance: 850, elapsedMs: 17_000, finalSpeed: 570 })).toBe(true);
    expect(isBetterGameResult({ gameId: "sleigh-runner", score: 700, distance: 700, elapsedMs: 15_000, finalSpeed: 500 },
      { gameId: "sleigh-runner", distance: 720, giftsCaught: 14 })).toBe(false);
    expect(isBetterGameResult({ gameId: "sleigh-runner", score: 730, distance: 730, elapsedMs: 15_500, finalSpeed: 520 },
      { gameId: "sleigh-runner", distance: 720, giftsCaught: 14 })).toBe(true);
  });

  it("keeps separate session and device records for each game", () => {
    const first: GameResult = { gameId: "gift-catcher", score: 100, giftsCaught: 10, hazardsHit: 0, elapsedMs: 30_000 };
    const improved: GameResult = { ...first, score: 120, giftsCaught: 12 };
    manager.record(first);
    const records = manager.record(improved);

    expect(records.sessionBest).toEqual(improved);
    expect(records.deviceBest).toEqual(improved);
    expect(manager.get("gift-catcher")).toEqual(records);
    expect(manager.get("snowflake-clicker")).toEqual({ sessionBest: null, deviceBest: null });
  });

  it("uses in-memory records when storage is blocked", () => {
    const blocked: StorageLike = {
      getItem() { throw new Error("Storage blocked"); },
      setItem() { throw new Error("Storage blocked"); },
    };
    const safeManager = createBestRecordManager(() => ({ session: blocked, device: blocked }));
    const result: GameResult = { gameId: "countdown-stopper", elapsedMs: 20_270, deviationMs: 0, score: 1_000 };

    expect(safeManager.record(result)).toEqual({ sessionBest: result, deviceBest: result });
    expect(safeManager.get("countdown-stopper")).toEqual({ sessionBest: result, deviceBest: result });
  });

  it("does not replace a better record with a worse result", () => {
    const best: GameResult = { gameId: "sleigh-runner", score: 900, distance: 900, elapsedMs: 18_000, finalSpeed: 610 };
    const lower: GameResult = { gameId: "sleigh-runner", score: 850, distance: 850, elapsedMs: 17_000, finalSpeed: 570 };
    manager.record(best);
    expect(manager.record(lower)).toEqual({ sessionBest: best, deviceBest: best });
  });
});
