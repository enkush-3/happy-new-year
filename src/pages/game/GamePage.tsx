import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import TreeGame from "../../features/tree-decorator/TreeGame";
import CountdownStopperGame from "../../features/games/countdown-stopper/CountdownStopperGame";
import FortuneCookieGame from "../../features/games/fortune-cookie/FortuneCookieGame";
import GiftCatcherGame from "../../features/games/gift-catcher/GiftCatcherGame";
import SleighRunnerGame from "../../features/games/sleigh-runner/SleighRunnerGame";
import SnowflakeClickerGame from "../../features/games/snowflake-clicker/SnowflakeClickerGame";
import TriviaGame from "../../features/games/trivia/TriviaGame";
import { findGame } from "../../features/games/gameCatalog";
import GameResultCard from "../../features/games/shared/GameResultCard";
import { decodeGameResult, encodeGameResult } from "../../features/games/shared/gameShare";
import type { GameId, GameResult } from "../../features/games/shared/types";

export default function GamePage() {
  const { gameId: routeGameId } = useParams();
  const game = findGame(routeGameId);
  const [searchParams, setSearchParams] = useSearchParams();
  const encodedResult = searchParams.get("result") ?? "";
  const sharedResult = useMemo(
    () => game && game.id !== "tree-decorator" ? decodeGameResult(encodedResult, game.id) : null,
    [encodedResult, game],
  );
  const [result, setResult] = useState<GameResult | null>(sharedResult);

  useEffect(() => {
    setResult(sharedResult);
  }, [routeGameId, sharedResult]);

  if (!game) {
    return (
      <section className="message-page">
        <p className="eyebrow">❄ ӨВЛИЙН УРЛАН</p>
        <h1>Тоглоом олдсонгүй</h1>
        <p>Энэ тоглоомын хаяг байхгүй байна.</p>
        <Link className="button button--primary" to="/games">Тоглоомууд руу буцах</Link>
      </section>
    );
  }

  if (game.id === "tree-decorator") return <TreeGame />;

  function completeGame(nextResult: GameResult) {
    setResult(nextResult);
    setSearchParams({ result: encodeGameResult(nextResult) }, { replace: true });
  }

  function replay() {
    setResult(null);
    setSearchParams({}, { replace: true });
  }

  return (
    <section className="game-page" aria-labelledby="game-page-title">
      <div className="game-page-heading">
        <Link to="/games" className="back-link"><span aria-hidden="true">←</span> Бүх тоглоом</Link>
        <p className="eyebrow"><span aria-hidden="true">✧</span> 2D БАЯРЫН ТОГЛООМ <span aria-hidden="true">✧</span></p>
        <h1 id="game-page-title">{game.title}</h1>
        <p className="hero-copy">{game.description}</p>
      </div>
      <div className="game-play-surface">
        {result ? (
          <GameResultCard result={result} onReplay={replay} />
        ) : (
          <GameInstance gameId={game.id} onComplete={completeGame} />
        )}
      </div>
    </section>
  );
}

function GameInstance({ gameId, onComplete }: { gameId: Exclude<GameId, "tree-decorator">; onComplete: (result: GameResult) => void }) {
  switch (gameId) {
    case "gift-catcher": return <GiftCatcherGame onComplete={onComplete} />;
    case "snowflake-clicker": return <SnowflakeClickerGame onComplete={onComplete} />;
    case "countdown-stopper": return <CountdownStopperGame onComplete={onComplete} />;
    case "sleigh-runner": return <SleighRunnerGame onComplete={onComplete} />;
    case "fortune-cookie": return <FortuneCookieGame onComplete={onComplete} />;
    case "trivia": return <TriviaGame onComplete={onComplete} />;
  }
}
