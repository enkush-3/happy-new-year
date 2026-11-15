import ShareButton from "../../../components/share/ShareButton";
import { presentGameResult } from "./gameShare";
import type { GameResult } from "./types";

interface GameResultCardProps {
  result: GameResult;
  onReplay: () => void;
}

export default function GameResultCard({ result, onReplay }: GameResultCardProps) {
  const presentation = presentGameResult(result);

  return (
    <section className="game-result-card" aria-labelledby="game-result-title">
      <span className="game-result-mark" aria-hidden="true">✦</span>
      <p className="eyebrow">ТАНЫ ҮР ДҮН</p>
      <h2 id="game-result-title">{presentation.title}</h2>
      <p className="game-result-copy">{presentation.text}</p>
      <div className="game-result-actions">
        <ShareButton result={result} />
        <button className="button button--tonal" type="button" onClick={onReplay}>Дахин тоглох</button>
      </div>
    </section>
  );
}
