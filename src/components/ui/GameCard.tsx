import type { CSSProperties } from "react";
import { Link } from "react-router";
import { gamePath } from "../../app/routeMap";
import type { GameDefinition } from "../../features/games/gameCatalog";
import { isBetterGameResult, bestRecordManager } from "../../features/games/shared/bestRecords";
import { presentGameResult } from "../../features/games/shared/gameShare";

interface GameCardProps {
  game: GameDefinition;
  index: number;
}

export default function GameCard({ game, index }: GameCardProps) {
  const bestRecords = game.id === "tree-decorator" ? null : bestRecordManager.get(game.id);
  const personalBest = bestRecords?.sessionBest && bestRecords.deviceBest
    ? isBetterGameResult(bestRecords.sessionBest, bestRecords.deviceBest)
      ? bestRecords.sessionBest
      : bestRecords.deviceBest
    : bestRecords?.sessionBest ?? bestRecords?.deviceBest ?? null;

  return (
    <Link
      className="game-card"
      data-tone={game.tone}
      style={{ "--card-index": index } as CSSProperties}
      to={gamePath(game.id)}
    >
      <span className="game-card__preview">
        <span className="game-card__icon" aria-hidden="true">{game.icon}</span>
        <span className="game-card__category">{game.badge} · {game.category}</span>
      </span>
      <div className="game-card__body">
        <h2 className="game-card__title">{game.title}</h2>
        <p className="game-card__description">{game.description}</p>
        <span className={`game-card__record${personalBest ? " has-record" : ""}`}>
          {game.id === "tree-decorator"
            ? "🎄 Бүтээлч урлан · Өөрийн гацуураа урла"
            : personalBest
              ? `🏆 Миний рекорд: ${presentGameResult(personalBest).text}`
              : "✨ Шинэ — Тоглож үзээгүй"}
        </span>
      </div>
      <span className="game-card__action">
        Одоо тоглох <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
