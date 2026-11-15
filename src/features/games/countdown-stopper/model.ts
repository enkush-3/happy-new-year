export const COUNTDOWN_STOPPER_MIN_TARGET_MS = 5_000;
export const COUNTDOWN_STOPPER_MAX_TARGET_MS = 10_000;

export interface CountdownStopperResult {
  gameId: "countdown-stopper";
  elapsedMs: number;
  targetMs: number;
  deviationMs: number;
  score: number;
}

export function getStopperTargetMs(random: () => number = Math.random): number {
  const targetRange = COUNTDOWN_STOPPER_MAX_TARGET_MS - COUNTDOWN_STOPPER_MIN_TARGET_MS + 1;
  return COUNTDOWN_STOPPER_MIN_TARGET_MS + Math.floor(random() * targetRange);
}

export function getStopperResult(elapsedMs: number, targetMs: number): CountdownStopperResult {
  const safeElapsed = Math.max(0, Math.round(elapsedMs));
  const deviationMs = Math.abs(safeElapsed - targetMs);
  return {
    gameId: "countdown-stopper",
    elapsedMs: safeElapsed,
    targetMs,
    deviationMs,
    score: Math.max(0, 1_000 - deviationMs),
  };
}

export function formatStopperTime(elapsedMs: number): string {
  return (Math.max(0, elapsedMs) / 1_000).toFixed(2);
}

export function formatStopperTarget(targetMs: number): string {
  return (targetMs / 1_000).toFixed(3);
}
