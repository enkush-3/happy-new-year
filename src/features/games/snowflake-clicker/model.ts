export const SNOWFLAKE_CLICKER_DURATION_MS = 30_000;

export interface SnowflakeDifficulty {
  spawnIntervalMs: number;
  lifetimeMs: number;
}

export function getSnowflakeDifficulty(elapsedMs: number): SnowflakeDifficulty {
  const progress = clamp(elapsedMs / SNOWFLAKE_CLICKER_DURATION_MS, 0, 1);
  return {
    spawnIntervalMs: Math.round(850 - progress * 570),
    lifetimeMs: Math.round(1_800 - progress * 1_150),
  };
}

export interface SnowflakeClickerScore {
  score: number;
  hits: number;
}

export function awardSnowflakeHit(current: SnowflakeClickerScore): SnowflakeClickerScore {
  return { score: current.score + 1, hits: current.hits + 1 };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
