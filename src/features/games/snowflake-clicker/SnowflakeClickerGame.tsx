import { useEffect, useRef, useState } from "react";
import { awardSnowflakeHit, SNOWFLAKE_CLICKER_DURATION_MS } from "./model";
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

export default function SnowflakeClickerGame({ onComplete }: SnowflakeClickerGameProps) {
  const [game, setGame] = useState<GameState>(emptyGame);
  const nextTargetId = useRef(0);
  const resultSent = useRef(false);

  useEffect(() => {
    if (game.status !== "running") return;

    const interval = window.setInterval(() => {
      setGame((current) => {
        if (current.status !== "running") return current;
        const elapsedMs = Math.min(current.elapsedMs + 100, SNOWFLAKE_CLICKER_DURATION_MS);
        const targets = current.targets.filter((target) => target.expiresAtMs > elapsedMs);
        if (elapsedMs % 700 === 0) targets.push(createTarget(nextTargetId.current++, elapsedMs));
        return {
          ...current,
          elapsedMs,
          targets,
          status: elapsedMs >= SNOWFLAKE_CLICKER_DURATION_MS ? "finished" : "running",
        };
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [game.status]);

  useEffect(() => {
    if (game.status !== "finished" || resultSent.current) return;
    resultSent.current = true;
    onComplete({ gameId: "snowflake-clicker", score: game.score, hits: game.hits, elapsedMs: game.elapsedMs });
  }, [game, onComplete]);

  function startGame() {
    resultSent.current = false;
    nextTargetId.current = 1;
    setGame({
      ...emptyGame,
      status: "running",
      targets: [{ id: 0, x: 50, y: 50, expiresAtMs: 2_000 }],
    });
  }

  function hitTarget(id: number) {
    setGame((current) => {
      if (current.status !== "running") return current;
      const target = current.targets.find((item) => item.id === id);
      if (!target) return current;
      const result = awardSnowflakeHit(current);
      return { ...current, ...result, targets: current.targets.filter((item) => item.id !== id) };
    });
  }

  const secondsLeft = Math.ceil((SNOWFLAKE_CLICKER_DURATION_MS - game.elapsedMs) / 1000);

  return (
    <section className="mini-game snowflake-clicker" aria-labelledby="snowflake-clicker-title">
      <header className="mini-game__header">
        <div>
          <p className="mini-game__eyebrow">2D REACTION · 30 СЕКУНД</p>
          <h2 id="snowflake-clicker-title">Цасан ширхэгийн сорил</h2>
          <p className="mini-game__description">Гарч ирсэн цасан ширхэгийг хурдан товшиж оноогоо нэмээрэй.</p>
        </div>
        <div className="snowflake-clicker__stats" aria-live="polite">
          <span><b>{game.score}</b> оноо</span>
          <span>⏱ {secondsLeft} сек</span>
        </div>
      </header>

      <div className="snowflake-clicker__arena" aria-label="Цасан ширхэг дарах талбай">
        {game.targets.map((target) => (
          <button
            key={target.id}
            type="button"
            className="snowflake-clicker__target"
            style={{ left: `${target.x}%`, top: `${target.y}%` }}
            aria-label="Цасан ширхэг дарах"
            onClick={() => hitTarget(target.id)}
          >❄</button>
        ))}
        {game.status !== "running" && (
          <div className="mini-game__overlay">
            <span className="mini-game__overlay-icon" aria-hidden="true">{game.status === "ready" ? "❄️" : "✨"}</span>
            <p>{game.status === "ready" ? "30 секундэд аль болох олон цасан ширхэг дарна." : `Сорил дууслаа! ${game.hits} цасан ширхэг дарлаа.`}</p>
            <button type="button" className="mini-game__button" onClick={startGame}>{game.status === "ready" ? "Тоглож эхлэх" : "Дахин тоглох"}</button>
          </div>
        )}
      </div>
      {game.status === "running" && <p className="snowflake-clicker__score" aria-live="polite">{game.score} оноо</p>}
      <p className="mini-game__hint">Хулганаар товших эсвэл touch дэлгэц дээр хүрэхэд хангалттай.</p>
    </section>
  );
}

function createTarget(id: number, elapsedMs: number): Target {
  return {
    id,
    x: 9 + Math.random() * 82,
    y: 12 + Math.random() * 70,
    expiresAtMs: elapsedMs + 1_800,
  };
}
