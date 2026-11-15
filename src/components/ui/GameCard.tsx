import type { CSSProperties } from "react";
import { Link } from "react-router";
import { gamePath } from "../../app/routeMap";
import type { GameDefinition } from "../../features/games/gameCatalog";

interface GameCardProps {
  game: GameDefinition;
  index: number;
}

export default function GameCard({ game, index }: GameCardProps) {
  return (
    <article className="game-card" style={{ "--card-index": index } as CSSProperties}>
      <div className="game-card__topline">
        <span className="game-card__icon" aria-hidden="true">{game.icon}</span>
        <span className="game-card__category">{game.category}</span>
      </div>
      <h2>{game.title}</h2>
      <p>{game.description}</p>
      <Link className="button button--tonal" to={gamePath(game.id)}>
        Тоглох <span aria-hidden="true">↗</span>
      </Link>
    </article>
  );
}
