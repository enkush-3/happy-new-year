import type { GameId } from "../features/games/shared/types";

export const HOME_PATH = "/";
export const GAMES_PATH = "/games";
export const TREE_GAME_ID: GameId = "tree-decorator";

export function gamePath(gameId: GameId): string {
  return `${GAMES_PATH}/${gameId}`;
}
