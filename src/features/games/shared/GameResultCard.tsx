import ShareButton from "../../../components/share/ShareButton";
import type { BestRecords } from "./bestRecords";
import { presentGameResult } from "./gameShare";
import type { GameResult } from "./types";

interface GameResultCardProps {
  result: GameResult;
  bestRecords: BestRecords;
  onReplay: () => void;
}

export default function GameResultCard({ result, bestRecords, onReplay }: GameResultCardProps) {
  const presentation = presentGameResult(result);
  const sessionBest = bestRecords.sessionBest ? presentGameResult(bestRecords.sessionBest).text : "Одоогоор бүртгэгдээгүй";
  const deviceBest = bestRecords.deviceBest ? presentGameResult(bestRecords.deviceBest).text : "Одоогоор бүртгэгдээгүй";

  return (
    <section className="game-result-card" aria-labelledby="game-result-title">
      <span className="game-result-mark" aria-hidden="true">✦</span>
      <p className="eyebrow">ТАНЫ ҮР ДҮН</p>
      <h2 id="game-result-title">{presentation.title}</h2>
      <p className="game-result-copy">{presentation.text}</p>
      <ul className="game-result-copy" aria-label="Тоглолтын дэлгэрэнгүй">
        {presentation.details.map((detail) => <li key={detail}>{detail}</li>)}
      </ul>
      <div className="game-result-records" aria-label="Таны шилдэг амжилтууд">
        <p className="game-result-copy"><strong>Энэ сессийн шилдэг:</strong> {sessionBest}</p>
        <p className="game-result-copy"><strong>Энэ төхөөрөмжийн шилдэг:</strong> {deviceBest}</p>
      </div>
      <div className="game-result-actions">
        <ShareButton result={result} />
        <button className="button button--tonal" type="button" onClick={onReplay}>Дахин тоглох</button>
      </div>
    </section>
  );
}
