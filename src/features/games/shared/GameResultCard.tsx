import type { CSSProperties } from "react";
import { Link } from "react-router";
import ShareButton from "../../../components/share/ShareButton";
import { gamePath } from "../../../app/routeMap";
import type { GameDefinition } from "../gameCatalog";
import type { BestRecords } from "./bestRecords";
import { presentGameResult } from "./gameShare";
import type { GameResult } from "./types";
import "./game-result-card.css";

interface GameResultCardProps {
  result: GameResult;
  bestRecords: BestRecords;
  nextGame: GameDefinition;
  onReplay: () => void;
}

interface ResultHighlight {
  value: string;
  unit: string;
  summary: string;
}

export default function GameResultCard({ result, bestRecords, nextGame, onReplay }: GameResultCardProps) {
  const presentation = presentGameResult(result);
  const details = presentation.details.slice(0, 2).map(toStatistic);
  const statistics = [
    ...details,
    {
      label: "Сессийн шилдэг",
      value: bestRecords.sessionBest ? presentGameResult(bestRecords.sessionBest).text : "Одоогоор бүртгэгдээгүй",
    },
    {
      label: "Төхөөрөмжийн дээд амжилт",
      value: bestRecords.deviceBest ? presentGameResult(bestRecords.deviceBest).text : "Одоогоор бүртгэгдээгүй",
    },
  ];
  const highlight = getResultHighlight(result);

  return (
    <div className="game-result-card">
      <span className="game-result-mark" aria-hidden="true">✦</span>
      <p className="eyebrow">ТАНЫ ҮР ДҮН</p>
      <h1 id="game-result-title">{presentation.title}</h1>
      <div className="game-result-highlight" aria-label={presentation.text}>
        <div className="game-result-scoreline">
          <span className="game-result-score">{highlight.value}</span>
          <span className="game-result-score-unit">{highlight.unit}</span>
        </div>
        <p>{highlight.summary}</p>
      </div>
      <dl className="game-result-stats" aria-label="Тоглолтын статистик">
        {statistics.map(({ label, value }, index) => (
          <div className="game-result-stat" key={label} style={{ "--stat-index": index } as CSSProperties}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="game-result-actions">
        <button className="button button--primary" type="button" onClick={onReplay}>Дахин тоглох</button>
        <ShareButton result={result} />
        <Link className="button button--secondary" to={gamePath(nextGame.id)}>
          Дараагийн тоглоом: {nextGame.title} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

function toStatistic(detail: string) {
  const separatorIndex = detail.indexOf(":");
  if (separatorIndex === -1) return { label: "Дэлгэрэнгүй", value: detail };
  return {
    label: detail.slice(0, separatorIndex).trim(),
    value: detail.slice(separatorIndex + 1).trim(),
  };
}

function getResultHighlight(result: GameResult): ResultHighlight {
  switch (result.gameId) {
    case "gift-catcher":
      return { value: String(result.score), unit: "оноо", summary: `${result.giftsCaught} бэлэг амжилттай тослоо` };
    case "snowflake-clicker":
      return { value: String(result.score), unit: "оноо", summary: `${result.hits} бай амжилттай оноолоо` };
    case "countdown-stopper":
      return {
        value: String(result.deviationMs),
        unit: "мс зөрүү",
        summary: "Зорилтот хугацаанд хэр ойр зогссоноо шалгаарай",
      };
    case "sleigh-runner":
      return { value: String(result.distance), unit: "метр", summary: `${result.giftsCaught} бэлэг цуглууллаа` };
    case "trivia":
      return {
        value: `${result.correctAnswers}/${result.totalQuestions}`,
        unit: "зөв хариулт",
        summary: result.archetype,
      };
  }
}
