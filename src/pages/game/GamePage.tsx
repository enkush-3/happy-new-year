import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import TreeGame from "../../features/tree-decorator/TreeGame";
import CountdownStopperGame from "../../features/games/countdown-stopper/CountdownStopperGame";
import GiftCatcherGame from "../../features/games/gift-catcher/GiftCatcherGame";
import SleighRunnerGame from "../../features/games/sleigh-runner/SleighRunnerGame";
import SnowflakeClickerGame from "../../features/games/snowflake-clicker/SnowflakeClickerGame";
import { findGame, gameCatalog } from "../../features/games/gameCatalog";
import GameResultCard from "../../features/games/shared/GameResultCard";
import { decodeGameResult, encodeGameResult } from "../../features/games/shared/gameShare";
import { bestRecordManager, type BestRecords } from "../../features/games/shared/bestRecords";
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
  const [bestRecords, setBestRecords] = useState<BestRecords>(() => game ? bestRecordManager.get(game.id) : emptyBestRecords());

  useEffect(() => {
    setResult(sharedResult);
  }, [routeGameId, sharedResult]);

  useEffect(() => {
    setBestRecords(game ? bestRecordManager.get(game.id) : emptyBestRecords());
  }, [routeGameId, game]);

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
  const currentGameIndex = gameCatalog.findIndex((catalogGame) => catalogGame.id === game.id);
  const nextGame = gameCatalog[(currentGameIndex + 1) % gameCatalog.length] ?? game;

  function completeGame(nextResult: GameResult) {
    setBestRecords(bestRecordManager.record(nextResult));
    setResult(nextResult);
    setSearchParams({ result: encodeGameResult(nextResult) }, { replace: true });
  }

  function replay() {
    setResult(null);
    setSearchParams({}, { replace: true });
  }

  return (
    <section className={`game-page${result ? " is-result" : ""}`} aria-labelledby={result ? "game-result-title" : "game-page-title"}>
      <div className="game-page-heading">
        <Link to="/games" className={`back-link${result ? " game-result-back" : ""}`}><span aria-hidden="true">←</span> Бүх тоглоом</Link>
        {!result && (
          <>
            <p className="eyebrow"><span aria-hidden="true">✧</span> 2D БАЯРЫН ТОГЛООМ <span aria-hidden="true">✧</span></p>
            <h1 id="game-page-title">{game.title}</h1>
            <p className="hero-copy">{game.description}</p>
          </>
        )}
      </div>
      <div className={`game-play-surface${result ? " is-result" : ""}`}>
        {result ? (
          <GameResultCard result={result} bestRecords={bestRecords} nextGame={nextGame} onReplay={replay} />
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
  }
}

function emptyBestRecords(): BestRecords {
  return { sessionBest: null, deviceBest: null };
}
