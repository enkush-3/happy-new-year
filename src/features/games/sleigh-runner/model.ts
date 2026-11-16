export interface RunnerObstacle {
  id: number;
  distance: number;
}

export type RunnerStatus = "ready" | "running" | "ended";

export interface SleighRunnerState {
  status: RunnerStatus;
  elapsedMs: number;
  distance: number;
  score: number;
  speed: number;
  jumpRemainingMs: number;
  obstacles: RunnerObstacle[];
  nextObstacleDistance: number;
  nextObstacleId: number;
  obstacleGapIndex: number;
}

export const RUNNER_START_SPEED = 32;
export const RUNNER_MAX_SPEED = 72;
export const RUNNER_SPEED_PER_POINT = 0.025;
export const RUNNER_VIEW_DISTANCE = 50;
export const RUNNER_FIRST_OBSTACLE_DISTANCE = 48;
export const RUNNER_JUMP_DURATION_MS = 820;
export const RUNNER_JUMP_HEIGHT_PX = 94;
export const RUNNER_COLLISION_RADIUS = 3;
export const RUNNER_OBSTACLE_GAPS = [34, 39, 32, 43, 36] as const;

const maxFrameDeltaMs = 100;

export function createRunnerState(): SleighRunnerState {
  return {
    status: "ready",
    elapsedMs: 0,
    distance: 0,
    score: 0,
    speed: RUNNER_START_SPEED,
    jumpRemainingMs: 0,
    obstacles: [],
    nextObstacleDistance: RUNNER_FIRST_OBSTACLE_DISTANCE,
    nextObstacleId: 1,
    obstacleGapIndex: 0,
  };
}

export function startRunnerState(): SleighRunnerState {
  return { ...createRunnerState(), status: "running" };
}

export function getRunnerSpeed(score: number): number {
  return Math.min(RUNNER_MAX_SPEED, RUNNER_START_SPEED + Math.max(0, score) * RUNNER_SPEED_PER_POINT);
}

export function getJumpHeight(remainingMs: number, prefersReducedMotion = false): number {
  if (remainingMs <= 0) return 0;
  if (prefersReducedMotion) return 70;
  const progress = 1 - Math.min(remainingMs, RUNNER_JUMP_DURATION_MS) / RUNNER_JUMP_DURATION_MS;
  return Math.sin(Math.PI * progress) * RUNNER_JUMP_HEIGHT_PX;
}

export function advanceRunnerFrame(
  state: SleighRunnerState,
  deltaMs: number,
  jumpRequested = false,
): { state: SleighRunnerState; crashed: boolean } {
  if (state.status !== "running") return { state, crashed: false };

  const elapsedDelta = Math.min(Math.max(deltaMs, 0), maxFrameDeltaMs);
  const elapsedMs = state.elapsedMs + elapsedDelta;
  const distance = state.distance + state.speed * elapsedDelta / 1_000;
  const score = Math.floor(distance);
  const speed = getRunnerSpeed(score);
  const jumpRemainingMs = jumpRequested && state.jumpRemainingMs <= 0
    ? RUNNER_JUMP_DURATION_MS
    : Math.max(0, state.jumpRemainingMs - elapsedDelta);

  let nextObstacleDistance = state.nextObstacleDistance;
  let nextObstacleId = state.nextObstacleId;
  let obstacleGapIndex = state.obstacleGapIndex;
  const obstacles = [...state.obstacles];

  while (nextObstacleDistance <= distance + RUNNER_VIEW_DISTANCE) {
    obstacles.push({ id: nextObstacleId, distance: nextObstacleDistance });
    nextObstacleId += 1;
    nextObstacleDistance += RUNNER_OBSTACLE_GAPS[obstacleGapIndex % RUNNER_OBSTACLE_GAPS.length];
    obstacleGapIndex += 1;
  }

  const crashed = jumpRemainingMs <= 0 && obstacles.some((obstacle) => {
    const previousGap = obstacle.distance - state.distance;
    const currentGap = obstacle.distance - distance;
    return previousGap >= -RUNNER_COLLISION_RADIUS && currentGap <= RUNNER_COLLISION_RADIUS;
  });

  const nextState: SleighRunnerState = {
    ...state,
    status: crashed ? "ended" : "running",
    elapsedMs,
    distance,
    score,
    speed,
    jumpRemainingMs,
    obstacles: obstacles.filter((obstacle) => obstacle.distance - distance >= -RUNNER_COLLISION_RADIUS),
    nextObstacleDistance,
    nextObstacleId,
    obstacleGapIndex,
  };

  return { state: nextState, crashed };
}
