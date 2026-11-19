import type { CSSProperties } from "react";
import { Link } from "react-router";
import { TREE_GAME_ID, gamePath } from "../../app/routeMap";
import type { GameDefinition } from "../../features/games/gameCatalog";
import { isBetterGameResult, bestRecordManager } from "../../features/games/shared/bestRecords";
import { presentGameResult } from "../../features/games/shared/gameShare";
import UiIcon from "./UiIcon";

interface GameCardProps {
  game: GameDefinition;
  index: number;
}

export default function GameCard({ game, index }: GameCardProps) {
  const featured = game.id === TREE_GAME_ID;
  const bestRecords = featured ? null : bestRecordManager.get(game.id);
  const personalBest = bestRecords?.sessionBest && bestRecords.deviceBest
    ? isBetterGameResult(bestRecords.sessionBest, bestRecords.deviceBest)
      ? bestRecords.sessionBest
      : bestRecords.deviceBest
    : bestRecords?.sessionBest ?? bestRecords?.deviceBest ?? null;

  return (
    <Link
      className={`game-card ui-card ui-stagger-in${featured ? " game-card--featured" : ""}`}
      data-tone={game.tone}
      style={{ "--i": index } as CSSProperties}
      to={gamePath(game.id)}
    >
      <span className="game-card__preview">
        <span className="game-card__icon"><UiIcon name={game.icon} /></span>
        <span className="game-card__category">{game.badge} · {game.category}</span>
      </span>
      <div className="game-card__body">
        <h2 className="game-card__title">{game.title}</h2>
        <p className="game-card__description">{game.description}</p>
        {!featured && (
          <span className={`game-card__record${personalBest ? " has-record" : ""}`}>
            <UiIcon name={personalBest ? "trophy" : "sparkle"} size={16} />
            {personalBest ? `Миний рекорд: ${presentGameResult(personalBest).text}` : "Тоглож үзээгүй"}
          </span>
        )}
      </div>
      <span className="game-card__action">
        Одоо тоглох <UiIcon name="arrow-right" size={18} />
      </span>
    </Link>
  );
}
