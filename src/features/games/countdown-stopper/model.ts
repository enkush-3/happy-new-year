export const COUNTDOWN_STOPPER_TARGET_MS = 20_270;

export interface CountdownStopperResult {
  gameId: "countdown-stopper";
  elapsedMs: number;
  deviationMs: number;
  score: number;
}

export function getStopperResult(elapsedMs: number): CountdownStopperResult {
  const safeElapsed = Math.max(0, Math.round(elapsedMs));
  const deviationMs = Math.abs(safeElapsed - COUNTDOWN_STOPPER_TARGET_MS);
  return {
    gameId: "countdown-stopper",
    elapsedMs: safeElapsed,
    deviationMs,
    score: Math.max(0, 1_000 - deviationMs),
  };
}

export function formatStopperTime(elapsedMs: number): string {
  return (Math.max(0, elapsedMs) / 1_000).toFixed(2);
}
