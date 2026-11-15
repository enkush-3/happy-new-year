import { describe, expect, it } from "vitest";
import { getRunnerItemY, moveRunnerLane, obstacleIsAvoided, type SleighTrackItem } from "./model";

describe("sleigh runner model", () => {
  it("steers between the three mountain trail lanes without leaving the route", () => {
    expect(moveRunnerLane(1, -1)).toBe(0);
    expect(moveRunnerLane(1, 1)).toBe(2);
    expect(moveRunnerLane(0, -1)).toBe(0);
    expect(moveRunnerLane(2, 1)).toBe(2);
  });

  it("moves trail items toward the sled as their elapsed age grows", () => {
    const gift: SleighTrackItem = { id: "gift", kind: "gift", lane: 1, spawnedAtMs: 0 };
    expect(getRunnerItemY(gift, 1_000)).toBeGreaterThan(getRunnerItemY(gift, 0));
    expect(getRunnerItemY(gift, 3_000)).toBe(88);
  });

  it("requires a jump for rocks and a slide for low branches", () => {
    expect(obstacleIsAvoided("rock", true, false)).toBe(true);
    expect(obstacleIsAvoided("rock", false, true)).toBe(false);
    expect(obstacleIsAvoided("branch", false, true)).toBe(true);
    expect(obstacleIsAvoided("branch", true, false)).toBe(false);
  });
});
