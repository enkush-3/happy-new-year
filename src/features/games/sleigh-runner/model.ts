export type TreeVariant = "small" | "tall" | "cluster";

export interface RunnerObstacle {
  id: number;
  distance: number;
  variant: TreeVariant;
}

interface TreeShape {
  offset: number;
  width: number;
  height: number;
}

export const RUNNER_TREES: Record<TreeVariant, { width: number; trees: readonly TreeShape[] }> = {
  small: { width: 3.8, trees: [{ offset: 0, width: 3.8, height: 4.3 }] },
  tall: { width: 4.5, trees: [{ offset: 0, width: 4.5, height: 6.4 }] },
  cluster: {
    width: 7.2,
    trees: [
      { offset: 0, width: 3.6, height: 4.3 },
      { offset: 3.4, width: 3.8, height: 5.1 },
    ],
  },
};

interface RunnerJump {
  height: number;
  verticalVelocity: number;
  jumpBufferMs: number;
  coyoteMs: number;
  fastFalling: boolean;
  lastLandingMs: number | null;
}

export interface SleighRunnerState extends RunnerJump {
  status: "ready" | "running" | "ended";
  elapsedMs: number;
  distance: number;
  score: number;
  speed: number;
  obstacles: RunnerObstacle[];
  nextObstacleDistance: number;
  nextObstacleId: number;
}

export interface RunnerInput {
  jumpPressed?: boolean;
  jumpHeld?: boolean;
  fastFall?: boolean;
}

export const RUNNER_START_SPEED = 32;
export const RUNNER_MAX_SPEED = 70;
export const RUNNER_SLED_WIDTH = 6.4;
export const RUNNER_SLED_HEIGHT = 4;
export const RUNNER_JUMP_SPEED = 40;
export const RUNNER_JUMP_BUFFER_MS = 100;
export const RUNNER_COYOTE_MS = 60;
export const RUNNER_CLUSTER_WARMUP_DISTANCE = 175;

const acceleration = 0.9;
const gravity = 100;
const fastFallGravity = gravity * 2.5;
const shortJumpSpeed = 30.5;
const jumpAirTime = 2 * RUNNER_JUMP_SPEED / gravity;
const stepLimitSeconds = 1 / 240;
const firstObstacleDistance = 46;
const firstObstacleExtraDistance = 12;
const lookAheadDistance = 64;
const behindDistance = 16;
const safetyMargin = RUNNER_SLED_WIDTH + 5;
const maxRandomExtraGap = 19;
const hitboxInset = 0.1;

export function createRunnerState(): SleighRunnerState {
  return {
    status: "ready",
    elapsedMs: 0,
    distance: 0,
    score: 0,
    speed: RUNNER_START_SPEED,
    height: 0,
    verticalVelocity: 0,
    jumpBufferMs: 0,
    coyoteMs: RUNNER_COYOTE_MS,
    fastFalling: false,
    lastLandingMs: null,
    obstacles: [],
    nextObstacleDistance: firstObstacleDistance,
    nextObstacleId: 1,
  };
}

export function startRunnerState(random = Math.random): SleighRunnerState {
  return {
    ...createRunnerState(),
    status: "running",
    nextObstacleDistance: firstObstacleDistance + random() * firstObstacleExtraDistance,
  };
}

export function getRunnerSpeed(elapsedMs: number): number {
  return Math.min(RUNNER_MAX_SPEED, RUNNER_START_SPEED + acceleration * Math.max(0, elapsedMs) / 1_000);
}

export function getMinimumTreeGap(speed: number): number {
  return speed * jumpAirTime * 0.85 + safetyMargin;
}

export function advanceRunnerFrame(
  state: SleighRunnerState,
  frameMs: number,
  input: RunnerInput = {},
  random = Math.random,
): SleighRunnerState {
  const deltaTime = Math.min(Math.max(frameMs / 1_000, 0), 0.05);
  if (state.status !== "running" || deltaTime === 0) return state;

  let next = {
    ...state,
    jumpBufferMs: input.jumpPressed ? RUNNER_JUMP_BUFFER_MS : state.jumpBufferMs,
  };

  if (input.fastFall && state.height > 0) {
    next.fastFalling = true;
    next.verticalVelocity = Math.min(0, state.verticalVelocity);
  }

  // Small steps keep the hitboxes accurate during a delayed display frame.
  const steps = Math.ceil(deltaTime / stepLimitSeconds);
  for (let step = 0; step < steps && next.status === "running"; step += 1) {
    next = advanceStep(next, deltaTime / steps, Boolean(input.jumpHeld), random);
  }
  return next;
}

function advanceStep(state: SleighRunnerState, seconds: number, jumpHeld: boolean, random: () => number): SleighRunnerState {
  const elapsedMs = state.elapsedMs + seconds * 1_000;
  const speed = getRunnerSpeed(elapsedMs);
  const acceleratingSeconds = Math.min(seconds, (RUNNER_MAX_SPEED - state.speed) / acceleration);
  const distance = state.distance + speed * seconds - acceleration * acceleratingSeconds ** 2 / 2;
  const jump = advanceJump(state, seconds, jumpHeld);
  const obstacles = state.obstacles.filter(
    (item) => item.distance + RUNNER_TREES[item.variant].width >= distance - behindDistance,
  );
  let nextObstacleDistance = state.nextObstacleDistance;
  let nextObstacleId = state.nextObstacleId;

  if (nextObstacleDistance <= distance + lookAheadDistance) {
    const variant = chooseTreeVariant(nextObstacleDistance, random());
    obstacles.push({ id: nextObstacleId++, distance: nextObstacleDistance, variant });
    const gap = getMinimumTreeGap(speed) + random() * maxRandomExtraGap;
    nextObstacleDistance += RUNNER_TREES[variant].width + gap;
  }

  return {
    ...jump,
    status: obstacles.some((item) => hitsTree(distance, jump.height, item)) ? "ended" : "running",
    elapsedMs,
    distance,
    score: Math.floor(distance),
    speed,
    obstacles,
    nextObstacleDistance,
    nextObstacleId,
  };
}

function advanceJump(state: SleighRunnerState, seconds: number, jumpHeld: boolean): RunnerJump {
  let { height, verticalVelocity, coyoteMs, jumpBufferMs, fastFalling, lastLandingMs } = state;
  const onGround = height === 0 && verticalVelocity === 0;
  const launchVelocity = jumpHeld ? RUNNER_JUMP_SPEED : shortJumpSpeed;

  if (jumpBufferMs > 0 && (onGround || coyoteMs > 0)) {
    verticalVelocity = launchVelocity;
    coyoteMs = 0;
    jumpBufferMs = 0;
    fastFalling = false;
  } else if (onGround) {
    return { height, verticalVelocity, coyoteMs: RUNNER_COYOTE_MS, jumpBufferMs: 0, fastFalling: false, lastLandingMs };
  }

  if (!jumpHeld) verticalVelocity = Math.min(verticalVelocity, shortJumpSpeed);

  const appliedGravity = fastFalling ? fastFallGravity : gravity;
  const nextHeight = height + verticalVelocity * seconds - appliedGravity * seconds ** 2 / 2;
  if (nextHeight > 0) {
    return {
      height: nextHeight,
      verticalVelocity: verticalVelocity - appliedGravity * seconds,
      coyoteMs: Math.max(0, coyoteMs - seconds * 1_000),
      jumpBufferMs: Math.max(0, jumpBufferMs - seconds * 1_000),
      fastFalling,
      lastLandingMs,
    };
  }

  const landingSeconds = (verticalVelocity + Math.sqrt(verticalVelocity ** 2 + 2 * appliedGravity * height)) / appliedGravity;
  lastLandingMs = state.elapsedMs + landingSeconds * 1_000;

  if (jumpBufferMs > landingSeconds * 1_000) {
    const remaining = Math.max(0, seconds - landingSeconds);
    height = launchVelocity * remaining - gravity * remaining ** 2 / 2;
    return {
      height,
      verticalVelocity: launchVelocity - gravity * remaining,
      coyoteMs: 0,
      jumpBufferMs: 0,
      fastFalling: false,
      lastLandingMs,
    };
  }

  return { height: 0, verticalVelocity: 0, coyoteMs: RUNNER_COYOTE_MS, jumpBufferMs: 0, fastFalling: false, lastLandingMs };
}

function chooseTreeVariant(distance: number, roll: number): TreeVariant {
  if (roll >= 0.82 && distance >= RUNNER_CLUSTER_WARMUP_DISTANCE) return "cluster";
  return roll < 0.62 ? "small" : "tall";
}

function hitsTree(distance: number, height: number, obstacle: RunnerObstacle): boolean {
  const sledHalfWidth = RUNNER_SLED_WIDTH * (0.5 - hitboxInset);
  const sledBottom = height + RUNNER_SLED_HEIGHT * hitboxInset;
  const sledTop = height + RUNNER_SLED_HEIGHT * (1 - hitboxInset);

  return RUNNER_TREES[obstacle.variant].trees.some(({ offset, width, height: treeHeight }) => {
    const treeLeft = obstacle.distance + offset + width * hitboxInset;
    const treeRight = obstacle.distance + offset + width * (1 - hitboxInset);
    return distance + sledHalfWidth > treeLeft &&
      distance - sledHalfWidth < treeRight &&
      sledBottom < treeHeight * (1 - hitboxInset) &&
      sledTop > treeHeight * hitboxInset;
  });
}
