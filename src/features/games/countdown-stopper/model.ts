export const COUNTDOWN_STOPPER_TARGET_MS = 10_000;

export interface CountdownStopperResult {
  gameId: "countdown-stopper";
  deviationMs: number;
  score: number;
}

export function getStopperResult(elapsedMs: number): CountdownStopperResult {
  const deviationMs = Math.abs(Math.round(elapsedMs) - COUNTDOWN_STOPPER_TARGET_MS);
  return {
    gameId: "countdown-stopper",
    deviationMs,
    score: Math.max(0, 1_000 - deviationMs),
  };
}

export function formatStopperTime(elapsedMs: number): string {
  const remainingMs = COUNTDOWN_STOPPER_TARGET_MS - Math.max(0, elapsedMs);
  if (remainingMs >= 0) return (remainingMs / 1_000).toFixed(2);
  return `+${(Math.abs(remainingMs) / 1_000).toFixed(2)}`;
}
