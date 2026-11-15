import { useEffect, useRef, useState } from "react";
import {
  getRunnerItemY,
  moveRunnerLane,
  obstacleIsAvoided,
  RUNNER_ITEM_CONTACT_MS,
  RUNNER_ITEM_LIFETIME_MS,
  RUNNER_LANE_POSITIONS,
  type RunnerLane,
  type SleighTrackItem,
} from "./model";
import "./sleigh-runner.css";

export interface SleighRunnerResult {
  gameId: "sleigh-runner";
  distance: number;
  giftsCaught: number;
}

interface SleighRunnerGameProps {
  onComplete: (result: SleighRunnerResult) => void;
}

interface RunnerState {
  status: "ready" | "running" | "ended";
  elapsedMs: number;
  distance: number;
  giftsCaught: number;
  lane: RunnerLane;
  isJumping: boolean;
  isSliding: boolean;
  items: SleighTrackItem[];
}

const initialGame: RunnerState = {
  status: "ready",
  elapsedMs: 0,
  distance: 0,
  giftsCaught: 0,
  lane: 1,
  isJumping: false,
  isSliding: false,
  items: [],
};

const simulationTickMs = 100;
const motionDurationMs = 700;
const waveIntervalMs = 3_500;

export default function SleighRunnerGame({ onComplete }: SleighRunnerGameProps) {
  const [game, setGame] = useState<RunnerState>(initialGame);
  const gameRef = useRef(game);
  gameRef.current = game;
  const startedAt = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const jumpUntil = useRef(0);
  const slideUntil = useRef(0);
  const nextWaveAt = useRef(waveIntervalMs);
  const nextItemId = useRef(2);
  const finished = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  function commit(next: RunnerState) {
    gameRef.current = next;
    setGame(next);
  }

  function steer(direction: -1 | 1) {
    const current = gameRef.current;
    if (current.status !== "running") return;
    commit({ ...current, lane: moveRunnerLane(current.lane, direction) });
  }

  function jump() {
    const current = gameRef.current;
    if (current.status !== "running") return;
    jumpUntil.current = elapsedRef.current + motionDurationMs;
    commit({ ...current, isJumping: true, isSliding: false });
  }

  function slide() {
    const current = gameRef.current;
    if (current.status !== "running") return;
    slideUntil.current = elapsedRef.current + motionDurationMs;
    commit({ ...current, isJumping: false, isSliding: true });
  }

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

      const elapsedMs = Math.max(0, Date.now() - startedAt.current);
      elapsedRef.current = elapsedMs;
      const jumping = elapsedMs < jumpUntil.current;
      const sliding = elapsedMs < slideUntil.current;
      let items = [...current.items];
      while (elapsedMs >= nextWaveAt.current) {
        const wave = Math.floor(nextWaveAt.current / waveIntervalMs);
        items.push(
          { id: `gift-${nextItemId.current++}`, kind: "gift", lane: (wave % 3) as RunnerLane, spawnedAtMs: nextWaveAt.current },
          {
            id: `hazard-${nextItemId.current++}`,
            kind: wave % 2 === 0 ? "rock" : "branch",
            lane: ((wave + 1) % 3) as RunnerLane,
            spawnedAtMs: nextWaveAt.current + 900,
          },
        );
        nextWaveAt.current += waveIntervalMs;
      }

      let giftsCaught = current.giftsCaught;
      let crashed = false;
      const remaining: SleighTrackItem[] = [];
      for (const item of items) {
        const age = elapsedMs - item.spawnedAtMs;
        if (age < RUNNER_ITEM_CONTACT_MS) {
          if (age < RUNNER_ITEM_LIFETIME_MS) remaining.push(item);
          continue;
        }

        if (item.lane === current.lane) {
          if (item.kind === "gift") giftsCaught += 1;
          else if (!obstacleIsAvoided(item.kind, jumping, sliding)) crashed = true;
        }
      }

      if (crashed && !finished.current) {
        finished.current = true;
        const distance = Math.floor(elapsedMs / 250);
        commit({ ...current, status: "ended", elapsedMs, distance, giftsCaught, items: [] });
        onCompleteRef.current({ gameId: "sleigh-runner", distance, giftsCaught });
        return;
      }

      commit({
        ...current,
        elapsedMs,
        distance: Math.floor(elapsedMs / 250),
        giftsCaught,
        isJumping: jumping,
        isSliding: sliding,
        items: remaining,
      });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const timer = window.setInterval(tick, simulationTickMs);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(timer);
      hiddenAt.current = null;
    };
  }, [game.status]);

  useEffect(() => {
    if (game.status !== "running") return;
    function onKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) return;
      if ((event.code === "Space" || event.key === " ") && isInteractiveTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (event.key === "ArrowLeft" || event.code === "KeyA" || key === "a") {
        event.preventDefault();
        steer(-1);
      } else if (event.key === "ArrowRight" || event.code === "KeyD" || key === "d") {
        event.preventDefault();
        steer(1);
      } else if (event.key === "ArrowUp" || event.code === "Space") {
        event.preventDefault();
        jump();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        slide();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.status]);

  function startRun() {
    startedAt.current = Date.now();
    hiddenAt.current = null;
    elapsedRef.current = 0;
    jumpUntil.current = 0;
    slideUntil.current = 0;
    nextWaveAt.current = waveIntervalMs;
    nextItemId.current = 2;
    finished.current = false;
    commit({
      ...initialGame,
      status: "running",
      items: [
        { id: "gift-first", kind: "gift", lane: 1, spawnedAtMs: 0 },
        { id: "rock-first", kind: "rock", lane: 1, spawnedAtMs: 1_100 },
      ],
    });
  }

  return (
    <section className="runner-game" aria-labelledby="runner-title">
      <div className="runner-scorebar">
        <p id="runner-title">Чарганы уралдаан</p>
        <div aria-live="polite">
          <span>Зай: <strong>{game.distance} м</strong></span>
          <span role="status" aria-label={`Авсан бэлэг: ${game.giftsCaught}`}>Авсан бэлэг: <strong>{game.giftsCaught}</strong></span>
          {game.status === "running" && <span role="status" aria-label="Гүйж байна">Гүйж байна</span>}
        </div>
      </div>

      <div className="runner-scene" role="img" aria-label="Чарганы 2D өвлийн уулын уралдаан">
        <span className="runner-moon" aria-hidden="true">☾</span>
        <span className="runner-aurora" aria-hidden="true" />
        <span className="runner-mountain runner-mountain--far" aria-hidden="true" />
        <span className="runner-mountain runner-mountain--near" aria-hidden="true" />
        <span className="runner-tree runner-tree--one" aria-hidden="true">🌲</span>
        <span className="runner-tree runner-tree--two" aria-hidden="true">🌲</span>
        <div className="runner-slope" aria-hidden="true">
          <span className="runner-lane-mark runner-lane-mark--one" />
          <span className="runner-lane-mark runner-lane-mark--two" />
          <span className="runner-track__dash" />
          <span className="runner-track__dash" />
          <span className="runner-track__dash" />
        </div>
        {game.status === "running" && (
          <>
            <div
              className="runner-player"
              data-testid="runner-player"
              data-lane={game.lane}
              data-jumping={game.isJumping ? "true" : "false"}
              data-sliding={game.isSliding ? "true" : "false"}
              style={{ left: `${RUNNER_LANE_POSITIONS[game.lane]}%` }}
              aria-hidden="true"
            >🛷</div>
            {game.items.filter((item) => item.spawnedAtMs <= game.elapsedMs).map((item) => (
              <span
                key={item.id}
                className={`runner-item runner-item--${item.kind}`}
                style={{ left: `${RUNNER_LANE_POSITIONS[item.lane]}%`, top: `${getRunnerItemY(item, game.elapsedMs)}%` }}
                aria-hidden="true"
              >{item.kind === "gift" ? "🎁" : item.kind === "rock" ? "🪨" : "🌲"}</span>
            ))}
          </>
        )}
        {game.status === "ended" && <p className="runner-crash" role="status">Саадтай мөргөлдлөө!</p>}
        {game.status === "ready" && <div className="runner-intro"><span aria-hidden="true">🛷</span><p>Уулын замаар гулгаж бэлэг цуглуулаарай.</p></div>}
      </div>

      <p className="runner-hint">← / → эсвэл A / D чиглүүлнэ · ↑ үсэрнэ · ↓ намхан мөчрийн доогуур гулсана · Space үсэрнэ</p>
      <div className="runner-controls">
        {game.status === "running" ? (
          <div className="runner-touch-controls" aria-label="Чарганы удирдлага">
            <button className="runner-button runner-button--secondary" type="button" aria-label="Зүүн тийш чиглүүлэх" onClick={() => steer(-1)}>←</button>
            <button className="runner-button runner-button--primary" type="button" aria-label="Үсрэх" onClick={jump}>↑<span>Үсрэх</span></button>
            <button className="runner-button runner-button--secondary" type="button" aria-label="Доош гулгах" onClick={slide}>↓</button>
            <button className="runner-button runner-button--secondary" type="button" aria-label="Баруун тийш чиглүүлэх" onClick={() => steer(1)}>→</button>
          </div>
        ) : (
          <button className="runner-button runner-button--primary" type="button" onClick={startRun}>{game.status === "ended" ? "Дахин уралдах" : "Уралдаж эхлэх"}</button>
        )}
        {game.status === "ended" && <p className="runner-result">Таны зай: <strong>{game.distance} м</strong> · Авсан бэлэг: <strong>{game.giftsCaught}</strong></p>}
      </div>
    </section>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest("button, a, input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
}
