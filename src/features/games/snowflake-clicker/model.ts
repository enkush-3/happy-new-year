export const SNOWFLAKE_CLICKER_DURATION_MS = 30_000;

export interface SnowflakeClickerScore {
  score: number;
  hits: number;
}

export function awardSnowflakeHit(current: SnowflakeClickerScore): SnowflakeClickerScore {
  return { score: current.score + 1, hits: current.hits + 1 };
}
