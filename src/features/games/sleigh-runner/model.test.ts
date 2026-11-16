import { describe, expect, it } from "vitest";
import {
  advanceRunnerFrame,
  createRunnerState,
  getJumpHeight,
  getRunnerSpeed,
  RUNNER_FIRST_OBSTACLE_DISTANCE,
  RUNNER_JUMP_DURATION_MS,
  RUNNER_MAX_SPEED,
  RUNNER_START_SPEED,
  startRunnerState,
} from "./model";

describe("sleigh runner model", () => {
  it("starts a fresh endless run at zero with one decorated-tree obstacle queued", () => {
    expect(createRunnerState()).toMatchObject({
      status: "ready",
      elapsedMs: 0,
      distance: 0,
      score: 0,
      speed: RUNNER_START_SPEED,
    });
    expect(startRunnerState()).toMatchObject({ status: "running", nextObstacleDistance: RUNNER_FIRST_OBSTACLE_DISTANCE });
  });

  it("advances distance, score, and speed with elapsed frame time", () => {
    const firstFrame = advanceRunnerFrame(startRunnerState(), 1_000).state;

    expect(firstFrame.elapsedMs).toBe(100);
    expect(firstFrame.distance).toBeCloseTo(3.2);
    expect(firstFrame.score).toBe(3);
    expect(firstFrame.speed).toBeCloseTo(getRunnerSpeed(3));
    expect(firstFrame.obstacles).toHaveLength(1);
  });

  it("caps the score-based speed and gives jumps a smooth arc", () => {
    expect(getRunnerSpeed(0)).toBe(RUNNER_START_SPEED);
    expect(getRunnerSpeed(100)).toBeGreaterThan(RUNNER_START_SPEED);
    expect(getRunnerSpeed(100_000)).toBe(RUNNER_MAX_SPEED);
    expect(getJumpHeight(RUNNER_JUMP_DURATION_MS)).toBe(0);
    expect(getJumpHeight(RUNNER_JUMP_DURATION_MS / 2)).toBeGreaterThan(90);
    expect(getJumpHeight(0)).toBe(0);
  });

  it("keeps jump height steady when reduced motion is preferred", () => {
    expect(getJumpHeight(650, true)).toBe(70);
    expect(getJumpHeight(180, true)).toBe(70);
    expect(getJumpHeight(0, true)).toBe(0);
  });

  it("ends when the sled reaches a tree unless a jump is active", () => {
    const approachingTree = {
      ...startRunnerState(),
      distance: 47,
      score: 47,
      speed: getRunnerSpeed(47),
      obstacles: [{ id: 1, distance: 48 }],
      nextObstacleDistance: 1_000,
      nextObstacleId: 2,
    };

    const collision = advanceRunnerFrame(approachingTree, 30);
    expect(collision.crashed).toBe(true);
    expect(collision.state.status).toBe("ended");

    const jumped = advanceRunnerFrame({ ...approachingTree, jumpRemainingMs: 300 }, 30);
    expect(jumped.crashed).toBe(false);
    expect(jumped.state.status).toBe("running");
  });
});
