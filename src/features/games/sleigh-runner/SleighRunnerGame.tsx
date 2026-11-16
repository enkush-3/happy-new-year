import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  advanceRunnerFrame,
  createRunnerState,
  getJumpHeight,
  RUNNER_VIEW_DISTANCE,
  startRunnerState,
  type SleighRunnerState,
} from "./model";
import "./sleigh-runner.css";

export interface SleighRunnerResult {
  gameId: "sleigh-runner";
  score: number;
  distance: number;
  elapsedMs: number;
  finalSpeed: number;
}

interface SleighRunnerGameProps {
  onComplete: (result: SleighRunnerResult) => void;
}

const runnerPlayerPosition = 20;

export default function SleighRunnerGame({ onComplete }: SleighRunnerGameProps) {
  const [game, setGame] = useState(createRunnerState);
  const gameRef = useRef(game);
  const jumpRequested = useRef(false);
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);
  gameRef.current = game;
  onCompleteRef.current = onComplete;

  const commit = useCallback((next: SleighRunnerState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const jump = useCallback(() => {
    if (gameRef.current.status === "running" && gameRef.current.jumpRemainingMs <= 0) {
      jumpRequested.current = true;
    }
  }, []);

  useEffect(() => {
    if (game.status !== "running") return;

    let animationFrame = 0;
    let previousFrame: number | null = null;

    function frame(now: number) {
      if (document.visibilityState !== "hidden") {
        const deltaMs = previousFrame === null ? 0 : now - previousFrame;
        previousFrame = now;
        const advanced = advanceRunnerFrame(gameRef.current, deltaMs, jumpRequested.current);
        jumpRequested.current = false;
        commit(advanced.state);

        if (advanced.crashed && !completed.current) {
          completed.current = true;
          onCompleteRef.current({
            gameId: "sleigh-runner",
            score: advanced.state.score,
            distance: Math.floor(advanced.state.distance),
            elapsedMs: Math.floor(advanced.state.elapsedMs),
            finalSpeed: Math.round(advanced.state.speed),
          });
          return;
        }
      } else {
        previousFrame = null;
        jumpRequested.current = false;
      }

      animationFrame = window.requestAnimationFrame(frame);
    }

    animationFrame = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [game.status, commit]);

  useEffect(() => {
    if (game.status !== "running") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target) || event.repeat) return;
      const isJumpKey = event.code === "Space" || event.key === " " || event.key === "ArrowUp";
      if (!isJumpKey) return;
      if (event.code === "Space" && isInteractiveTarget(event.target)) return;
      event.preventDefault();
      jump();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.status, jump]);

  function startRun() {
    completed.current = false;
    jumpRequested.current = false;
    commit(startRunnerState());
  }

  const runDuration = (57_600 / game.speed / 1_000).toFixed(2) + "s";
  const sceneStyle = { "--runner-duration": runDuration } as CSSProperties;
  const prefersReducedMotion = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const jumpHeight = getJumpHeight(game.jumpRemainingMs, prefersReducedMotion);

  return (
    <section className="runner-game" aria-labelledby="runner-title">
      <div className="runner-scorebar">
        <p id="runner-title">Чарганы уралдаан</p>
        <div>
          <span>Оноо: <strong data-testid="runner-score">{game.score}</strong></span>
          <span>Зай: <strong data-testid="runner-distance">{Math.floor(game.distance)} м</strong></span>
          <span>Хурд: <strong data-testid="runner-speed">{Math.round(game.speed)} м/с</strong></span>
        </div>
      </div>

      <div
        className="runner-scene"
        role="img"
        aria-label="Чимэглэсэн гацуур саадтай чарганы 2D уралдаан"
        style={sceneStyle}
        onPointerDown={game.status === "running" ? jump : undefined}
      >
        <span className="runner-moon" aria-hidden="true">☾</span>
        <span className="runner-aurora" aria-hidden="true" />
        <span className="runner-mountain runner-mountain--far" aria-hidden="true" />
        <span className="runner-mountain runner-mountain--near" aria-hidden="true" />
        <span className="runner-background-tree runner-background-tree--one" aria-hidden="true">🌲</span>
        <span className="runner-background-tree runner-background-tree--two" aria-hidden="true">🌲</span>
        <div className="runner-ground" aria-hidden="true">
          <span className="runner-ground-line" />
          <span className="runner-ground-dash" />
          <span className="runner-ground-dash" />
          <span className="runner-ground-dash" />
          <span className="runner-ground-snow" />
        </div>

        {game.status === "running" && (
          <>
            <div
              className="runner-player"
              data-testid="runner-player"
              data-jumping={game.jumpRemainingMs > 0 ? "true" : "false"}
              style={{
                left: runnerPlayerPosition + "%",
                transform: "translate(-50%, " + -jumpHeight + "px)",
              }}
              aria-hidden="true"
            >
              <span className="runner-sleigh-snow" />
              <span className="runner-sleigh">🛷</span>
              <span className="runner-sleigh-trail" />
            </div>
            {game.obstacles
              .filter((obstacle) => obstacle.distance - game.distance <= RUNNER_VIEW_DISTANCE)
              .map((obstacle) => {
                const gap = obstacle.distance - game.distance;
                const left = runnerPlayerPosition + gap / RUNNER_VIEW_DISTANCE * (100 - runnerPlayerPosition);
                return (
                  <span
                    key={obstacle.id}
                    className="runner-obstacle"
                    data-testid="runner-obstacle"
                    style={{ left: left + "%" }}
                    aria-hidden="true"
                  >
                    <DecoratedTree />
                  </span>
                );
              })}
          </>
        )}

        {game.status === "ended" && (
          <div className="runner-crash" role="status">
            <span aria-hidden="true">❄</span>
            <strong>Саадтай мөргөлдлөө!</strong>
            <span>{game.score} оноо · {Math.floor(game.distance)} м</span>
          </div>
        )}
        {game.status === "ready" && (
          <div className="runner-intro">
            <span aria-hidden="true">🛷</span>
            <p>Гацуур дээгүүр харайж аль болох хол яваарай.</p>
          </div>
        )}
      </div>

      <p className="runner-hint">Space, ↑, товшилт эсвэл “Үсрэх” товчоор харайна</p>
      <div className="runner-controls">
        {game.status === "running" ? (
          <button className="runner-button runner-button--primary runner-button--jump" type="button" onClick={jump}>
            ↑ <span>Үсрэх</span>
          </button>
        ) : (
          <button className="runner-button runner-button--primary" type="button" onClick={startRun}>
            {game.status === "ended" ? "Дахин уралдах" : "Уралдаж эхлэх"}
          </button>
        )}
        {game.status === "ended" && (
          <p className="runner-result">
            Туулсан зай: <strong>{Math.floor(game.distance)} м</strong> ·
            Тоглосон хугацаа: <strong>{(game.elapsedMs / 1_000).toFixed(1)} сек</strong> ·
            Эцсийн хурд: <strong>{Math.round(game.speed)} м/с</strong>
          </p>
        )}
      </div>
    </section>
  );
}

function DecoratedTree() {
  return (
    <svg className="runner-tree-obstacle" viewBox="0 0 74 112" aria-hidden="true">
      <ellipse cx="37" cy="105" rx="29" ry="5" fill="rgba(10, 20, 34, .3)" />
      <path d="M32 79h10v24H32z" fill="#79533b" />
      <path d="m37 2-18 31h11L12 55h17L5 81h64L45 55h17L44 33h11z" fill="#146b4c" stroke="#c8e4d6" strokeWidth="2" strokeLinejoin="round" />
      <path d="m37 4-17 30h10L13 56h16L7 79h13L37 8z" fill="#218261" opacity=".7" />
      <path d="M18 53q16 5 38 0M12 79q22 6 50 0" fill="none" stroke="#f3c75e" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="36" cy="35" r="3.6" fill="#f87171" />
      <circle cx="24" cy="62" r="3.6" fill="#f5cf70" />
      <circle cx="50" cy="58" r="3.6" fill="#91d8ef" />
      <circle cx="43" cy="80" r="3.6" fill="#f87171" />
      <path d="m37 0 2.1 4.6 5 .5-3.7 3.3 1 4.8-4.4-2.5-4.4 2.5 1-4.8-3.7-3.3 5-.5z" fill="#ffd978" />
    </svg>
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
