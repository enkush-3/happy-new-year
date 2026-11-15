export type RunnerLane = 0 | 1 | 2;
export type RunnerObstacleKind = "rock" | "branch";
export type SleighItemKind = "gift" | RunnerObstacleKind;

export interface SleighTrackItem {
  id: string;
  kind: SleighItemKind;
  lane: RunnerLane;
  spawnedAtMs: number;
}

export const RUNNER_LANE_POSITIONS = [23, 50, 77] as const;
export const RUNNER_ITEM_CONTACT_MS = 1_800;
export const RUNNER_ITEM_LIFETIME_MS = 2_100;

export function moveRunnerLane(lane: RunnerLane, direction: -1 | 1): RunnerLane {
  return Math.max(0, Math.min(2, lane + direction)) as RunnerLane;
}

export function getRunnerItemY(item: SleighTrackItem, elapsedMs: number): number {
  const age = Math.max(0, elapsedMs - item.spawnedAtMs);
  return Math.min(88, 8 + (age / RUNNER_ITEM_LIFETIME_MS) * 80);
}

export function obstacleIsAvoided(
  kind: RunnerObstacleKind,
  isJumping: boolean,
  isSliding: boolean,
): boolean {
  return kind === "rock" ? isJumping : isSliding;
}
