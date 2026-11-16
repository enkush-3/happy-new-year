export type GameId =
  | "gift-catcher"
  | "snowflake-clicker"
  | "countdown-stopper"
  | "sleigh-runner"
  | "tree-decorator";

export type GameResult =
  | { gameId: "gift-catcher"; score: number; giftsCaught: number; hazardsHit: number; elapsedMs: number }
  | { gameId: "snowflake-clicker"; score: number; hits: number; elapsedMs: number }
  | { gameId: "countdown-stopper"; elapsedMs: number; targetMs: number; deviationMs: number; score: number }
  | { gameId: "countdown-stopper"; elapsedMs: number; deviationMs: number; score: number }
  | { gameId: "countdown-stopper"; deviationMs: number; score: number }
  | { gameId: "sleigh-runner"; score: number; distance: number; elapsedMs: number; finalSpeed: number }
  | { gameId: "sleigh-runner"; distance: number; giftsCaught: number };

export interface GameResultPresentation {
  title: string;
  text: string;
  details: string[];
}
