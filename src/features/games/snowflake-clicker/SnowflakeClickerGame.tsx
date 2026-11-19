import { useEffect, useRef, useState } from "react";
import { awardSnowflakeHit, getSnowflakeDifficulty, SNOWFLAKE_CLICKER_DURATION_MS } from "./model";
import "./snowflake-clicker.css";

export interface SnowflakeClickerResult {
  gameId: "snowflake-clicker";
  score: number;
  hits: number;
  elapsedMs: number;
}

export interface SnowflakeClickerGameProps {
  onComplete: (result: SnowflakeClickerResult) => void;
}

interface Target {
  id: number;
  x: number;
  y: number;
  expiresAtMs: number;
}

interface GameState {
  status: "ready" | "running" | "finished";
  elapsedMs: number;
  score: number;
  hits: number;
  targets: Target[];
}

const emptyGame: GameState = { status: "ready", elapsedMs: 0, score: 0, hits: 0, targets: [] };
const clockCheckMs = 100;

export default function SnowflakeClickerGame({ onComplete }: SnowflakeClickerGameProps) {
  const [game, setGame] = useState<GameState>(emptyGame);
  const gameRef = useRef(game);
  const startedAt = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const nextTargetId = useRef(0);
  const nextSpawnAt = useRef(0);
  const resultSent = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (game.status !== "running") return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current ??= Date.now();
      } else if (hiddenAt.current !== null) {
        startedAt.current += Date.now() - hiddenAt.current;
        hiddenAt.current = null;
      }
    }

    if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
    function tick() {
      if (document.visibilityState === "hidden") return;
      const current = gameRef.current;
      if (current.status !== "running") return;

      const elapsedMs = Math.min(Math.max(0, Date.now() - startedAt.current), SNOWFLAKE_CLICKER_DURATION_MS);
      const targets = current.targets.filter((target) => target.expiresAtMs > elapsedMs);
      while (nextSpawnAt.current <= elapsedMs && elapsedMs < SNOWFLAKE_CLICKER_DURATION_MS) {
        const spawnAt = nextSpawnAt.current;
        const pace = getSnowflakeDifficulty(spawnAt);
        targets.push(createTarget(nextTargetId.current++, spawnAt, pace.lifetimeMs));
        nextSpawnAt.current += pace.spawnIntervalMs;
      }

      if (elapsedMs >= SNOWFLAKE_CLICKER_DURATION_MS) {
        const finalGame = { ...current, status: "finished" as const, elapsedMs: SNOWFLAKE_CLICKER_DURATION_MS, targets: [] };
        commit(finalGame);
        if (!resultSent.current) {
          resultSent.current = true;
          onCompleteRef.current({
            gameId: "snowflake-clicker",
            score: finalGame.score,
            hits: finalGame.hits,
            elapsedMs: finalGame.elapsedMs,
          });
        }
        return;
      }

      const displayElapsedMs = Math.floor(elapsedMs / 1_000) * 1_000;
      const targetsChanged = targets.length !== current.targets.length || targets.some((target, index) => target.id !== current.targets[index]?.id);
      if (displayElapsedMs !== current.elapsedMs || targetsChanged) {
        commit({ ...current, elapsedMs: displayElapsedMs, targets });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const timer = window.setInterval(tick, clockCheckMs);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(timer);
      hiddenAt.current = null;
    };
  }, [game.status]);

  function commit(next: GameState) {
    gameRef.current = next;
    setGame(next);
  }

  function startGame() {
    resultSent.current = false;
    nextTargetId.current = 1;
    nextSpawnAt.current = getSnowflakeDifficulty(0).spawnIntervalMs;
    startedAt.current = Date.now();
    hiddenAt.current = null;
    commit({
      ...emptyGame,
      status: "running",
      targets: [createTarget(0, 0, getSnowflakeDifficulty(0).lifetimeMs)],
    });
  }

  function hitTarget(id: number) {
    const current = gameRef.current;
    if (current.status !== "running") return;
    const target = current.targets.find((item) => item.id === id);
    if (!target) return;
    const next = {
      ...current,
      ...awardSnowflakeHit(current),
      targets: current.targets.filter((item) => item.id !== id),
    };
    commit(next);
  }

  const secondsLeft = Math.ceil((SNOWFLAKE_CLICKER_DURATION_MS - game.elapsedMs) / 1_000);

  return (
    <section className="mini-game snowflake-clicker" aria-labelledby="snowflake-clicker-title">
      <header className="mini-game__header">
        <div>
          <p className="mini-game__eyebrow">2D REACTION · 30 СЕКУНД</p>
          <h2 id="snowflake-clicker-title">Цасан ширхэгийн сорил</h2>
          <p className="mini-game__description">Гарч ирсэн цасан ширхэгийг хурдан товшиж оноогоо нэмээрэй. Цаг дуусах тусам хэцүү болно.</p>
        </div>
        <div className="snowflake-clicker__stats" aria-live="polite">
          <span><b>{game.score}</b> оноо</span>
          <span>⏱ {secondsLeft} сек</span>
        </div>
      </header>

      <div className="snowflake-clicker__arena" role="region" aria-label="Цасан ширхэг дарах талбай">
        {game.targets.map((target) => (
          <button
            key={target.id}
            type="button"
            className="snowflake-clicker__target ui-btn"
            style={{ left: `${target.x}%`, top: `${target.y}%` }}
            aria-label="Цасан ширхэг дарах"
            onClick={() => hitTarget(target.id)}
          >❄</button>
        ))}
        {game.status !== "running" && (
          <div className="mini-game__overlay">
            <span className="mini-game__overlay-icon" aria-hidden="true">{game.status === "ready" ? "❄️" : "✨"}</span>
            <p>{game.status === "ready" ? "30 секундэд аль болох олон цасан ширхэг дарна." : `Сорил дууслаа! ${game.hits} цасан ширхэг дарлаа.`}</p>
            <button type="button" className="mini-game__button ui-btn" onClick={startGame}>{game.status === "ready" ? "Тоглож эхлэх" : "Дахин тоглох"}</button>
          </div>
        )}
      </div>
      {game.status === "running" && <p className="snowflake-clicker__score" aria-live="polite">{game.score} оноо</p>}
      <p className="mini-game__hint">Хулганаар товших эсвэл touch дэлгэц дээр хүрэхэд хангалттай.</p>
    </section>
  );
}

function createTarget(id: number, spawnAtMs: number, lifetimeMs: number): Target {
  return {
    id,
    x: 9 + Math.random() * 82,
    y: 12 + Math.random() * 70,
    expiresAtMs: spawnAtMs + lifetimeMs,
  };
}
