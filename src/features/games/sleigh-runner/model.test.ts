import { describe, expect, it } from "vitest";
import {
  advanceRunnerFrame,
  createRunnerState,
  getMinimumTreeGap,
  getRunnerSpeed,
  RUNNER_CLUSTER_WARMUP_DISTANCE,
  RUNNER_COYOTE_MS,
  RUNNER_JUMP_BUFFER_MS,
  RUNNER_MAX_SPEED,
  RUNNER_START_SPEED,
  RUNNER_TREES,
  startRunnerState,
  type RunnerInput,
  type RunnerObstacle,
  type SleighRunnerState,
  type TreeVariant,
} from "./model";

const noTrees: SleighRunnerState = { ...startRunnerState(() => 0), nextObstacleDistance: Infinity };

function playFor(state: SleighRunnerState, milliseconds: number, input: RunnerInput = {}) {
  let next = state;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) {
    next = advanceRunnerFrame(next, Math.min(10, milliseconds - elapsed), input);
  }
  return next;
}

describe("sleigh runner model", () => {
  it("starts an endless run with a randomized first obstacle and a smooth capped speed", () => {
    expect(createRunnerState()).toMatchObject({
      status: "ready",
      elapsedMs: 0,
      distance: 0,
      score: 0,
      speed: RUNNER_START_SPEED,
    });
    expect(startRunnerState(() => 0).nextObstacleDistance).toBeLessThan(startRunnerState(() => 0.99).nextObstacleDistance);
    expect(getRunnerSpeed(1)).toBeGreaterThan(RUNNER_START_SPEED);
    expect(getRunnerSpeed(100_000)).toBe(RUNNER_MAX_SPEED);
  });

  it("caps a stalled frame at 50 ms and preserves travel and jump height at 60, 120 and 144 Hz", () => {
    const stalled = advanceRunnerFrame(noTrees, 4_000, { jumpPressed: true, jumpHeld: true });
    expect(stalled.elapsedMs).toBeCloseTo(50);
    expect(stalled.distance).toBeCloseTo(1.601125);
    expect(stalled.height).toBeCloseTo(1.875);

    for (const refreshrate of [60, 120, 144]) {
      let state = noTrees;
      for (let frame = 0; frame < refreshrate / 2; frame += 1) {
        state = advanceRunnerFrame(state, 1_000 / refreshrate, { jumpPressed: frame === 0, jumpHeld: true });
      }
      expect(state.elapsedMs).toBeCloseTo(500, 8);
      expect(state.distance).toBeCloseTo(16.1125, 8);
      expect(state.speed).toBeCloseTo(32.45, 8);
      expect(state.height).toBeCloseTo(7.5, 8);
    }
  });

  it("dampens an early release and lets ArrowDown accelerate the fall", () => {
    const rising = advanceRunnerFrame(noTrees, 20, { jumpPressed: true, jumpHeld: true });
    const full = playFor(rising, 380, { jumpHeld: true });
    const short = playFor(rising, 380);
    expect(full.height).toBeCloseTo(8);
    expect(short.height).toBeLessThan(6);
    expect(short.height).toBeGreaterThan(3.5);

    const diving = advanceRunnerFrame(rising, 20, { jumpHeld: true, fastFall: true });
    expect(diving.verticalVelocity).toBeLessThan(0);
    expect(playFor(diving, 150, { jumpHeld: true }).height).toBe(0);
    expect(playFor(rising, 170, { jumpHeld: true }).height).toBeGreaterThan(0);
  });

  it("uses a buffered jump on touchdown and expires an early press", () => {
    const dropping = { ...noTrees, height: 0.85, verticalVelocity: -12, coyoteMs: 0 };
    const buffered = advanceRunnerFrame(dropping, 10, { jumpPressed: true, jumpHeld: true });
    expect(buffered.jumpBufferMs).toBeCloseTo(RUNNER_JUMP_BUFFER_MS - 10);
    const bounced = playFor(buffered, 70, { jumpHeld: true });
    expect(bounced.lastLandingMs).not.toBeNull();
    expect(bounced.verticalVelocity).toBeGreaterThan(0);
    expect(bounced.jumpBufferMs).toBe(0);

    const tooEarly = advanceRunnerFrame({ ...noTrees, height: 8, coyoteMs: 0 }, 10, { jumpPressed: true, jumpHeld: true });
    const landed = playFor(tooEarly, 460, { jumpHeld: true });
    expect(landed.height).toBe(0);
    expect(landed.verticalVelocity).toBe(0);
  });

  it("preserves 60 ms of coyote time without allowing a second jump during ascent", () => {
    const unsupported = { ...noTrees, height: 0.9, verticalVelocity: -1, coyoteMs: RUNNER_COYOTE_MS };
    const graceJump = advanceRunnerFrame(playFor(unsupported, 45), 5, { jumpPressed: true, jumpHeld: true });
    expect(graceJump.verticalVelocity).toBeGreaterThan(30);
    expect(graceJump.coyoteMs).toBe(0);
    const expiredJump = advanceRunnerFrame(playFor(unsupported, 65), 5, { jumpPressed: true, jumpHeld: true });
    expect(expiredJump.verticalVelocity).toBeLessThan(0);

    const firstJump = advanceRunnerFrame(noTrees, 30, { jumpPressed: true, jumpHeld: true });
    const retry = advanceRunnerFrame(firstJump, 10, { jumpPressed: true, jumpHeld: true });
    expect(retry.verticalVelocity).toBeLessThan(firstJump.verticalVelocity);
  });

  it("randomizes free gaps above the safe minimum and unlocks clusters after warming up", () => {
    const preview = { ...noTrees, distance: 18, nextObstacleDistance: 50 };
    const early = advanceRunnerFrame(preview, 1, {}, () => 0.99);
    const lowGap = advanceRunnerFrame(preview, 1, {}, () => 0);
    const wideGap = advanceRunnerFrame(preview, 1, {}, (() => {
      const rolls = [0, 0.99];
      return () => rolls.shift() ?? 0;
    })());
    expect(early.obstacles[0].variant).toBe("tall");
    expect(lowGap.obstacles[0].variant).toBe("small");
    expect(lowGap.nextObstacleDistance - 50 - RUNNER_TREES.small.width).toBeCloseTo(getMinimumTreeGap(lowGap.speed));
    expect(wideGap.nextObstacleDistance).toBeGreaterThan(lowGap.nextObstacleDistance + 10);
    expect(getMinimumTreeGap(RUNNER_MAX_SPEED)).toBeGreaterThan(getMinimumTreeGap(RUNNER_START_SPEED));

    const warm = advanceRunnerFrame({
      ...noTrees,
      distance: RUNNER_CLUSTER_WARMUP_DISTANCE - 30,
      nextObstacleDistance: RUNNER_CLUSTER_WARMUP_DISTANCE,
    }, 1, {}, () => 0.99);
    expect(warm.obstacles[0].variant).toBe("cluster");
  });

  it.each([RUNNER_START_SPEED, RUNNER_MAX_SPEED])("can clear successive tall trees and clusters at %i m/s with the tightest spacing", (speed) => {
    const variants: TreeVariant[] = ["tall", "cluster", "tall", "small"];
    const obstacles: RunnerObstacle[] = [];
    let distance = 34;
    for (const variant of variants) {
      obstacles.push({ id: obstacles.length, distance, variant });
      distance += RUNNER_TREES[variant].width + getMinimumTreeGap(speed);
    }

    let state: SleighRunnerState = { ...noTrees, speed, elapsedMs: speed === RUNNER_MAX_SPEED ? 60_000 : 0, obstacles };
    let jumps = 0;
    for (let frame = 0; frame < 1_200 && state.status === "running" && state.distance < distance; frame += 1) {
      const nextTree = obstacles[jumps];
      const center = nextTree ? nextTree.distance + RUNNER_TREES[nextTree.variant].width / 2 : Infinity;
      const jumpPressed = state.height === 0 && center - state.distance <= state.speed * 0.4;
      state = advanceRunnerFrame(state, 1_000 / 120, { jumpPressed, jumpHeld: true });
      if (jumpPressed) jumps += 1;
    }

    expect(state.status).toBe("running");
    expect(jumps).toBe(variants.length);
    expect(state.distance).toBeGreaterThanOrEqual(distance);
  });

  it("allows near misses on either axis while detecting a direct hit", () => {
    const standing = { ...noTrees, obstacles: [{ id: 1, distance: 9, variant: "small" as const }] };
    const edge = advanceRunnerFrame({ ...standing, distance: 6.1 }, 4);
    const overTip = advanceRunnerFrame({ ...standing, distance: 9, height: 3.49 }, 4);
    const collision = advanceRunnerFrame({ ...standing, distance: 7.1 }, 4);
    expect(edge.status).toBe("running");
    expect(overTip.status).toBe("running");
    expect(collision.status).toBe("ended");
  });
});
