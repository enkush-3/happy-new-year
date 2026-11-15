export type GameId =
  | "gift-catcher"
  | "snowflake-clicker"
  | "countdown-stopper"
  | "sleigh-runner"
  | "fortune-cookie"
  | "trivia"
  | "tree-decorator";

export type GameResult =
  | { gameId: "gift-catcher"; score: number; giftsCaught: number; hazardsHit: number; elapsedMs: number }
  | { gameId: "snowflake-clicker"; score: number; hits: number; elapsedMs: number }
  | { gameId: "countdown-stopper"; deviationMs: number; score: number }
  | { gameId: "sleigh-runner"; distance: number; giftsCaught: number }
  | { gameId: "fortune-cookie"; fortunes: string[] }
  | { gameId: "trivia"; correctAnswers: number; totalQuestions: 10; archetype: string };

export interface GameResultPresentation {
  title: string;
  text: string;
}
