import { useCallback, useEffect, useRef, useState } from "react";
import "./sleigh-runner.css";

export interface SleighRunnerResult {
  gameId: "sleigh-runner";
  distance: number;
  giftsCaught: number;
}

interface SleighRunnerGameProps {
  onComplete: (result: SleighRunnerResult) => void;
}

const tickMs = 100;
const obstacleIntervalMs = 4000;
const jumpDurationMs = 850;
const giftWindowStartMs = 2000;
const giftWindowEndMs = 3600;

export default function SleighRunnerGame({ onComplete }: SleighRunnerGameProps) {
  const [running, setRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [distance, setDistance] = useState(0);
  const [giftsCaught, setGiftsCaught] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const elapsedRef = useRef(0);
  const jumpUntilRef = useRef(0);
  const giftsRef = useRef(0);
  const nextObstacleRef = useRef(obstacleIntervalMs);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);
  onCompleteRef.current = onComplete;

  const jump = useCallback(() => {
    if (!running || ended) return;
    jumpUntilRef.current = elapsedRef.current + jumpDurationMs;
    setIsJumping(true);
  }, [ended, running]);

  const collectGift = useCallback(() => {
    if (!running || ended || elapsedRef.current % obstacleIntervalMs < giftWindowStartMs || elapsedRef.current % obstacleIntervalMs > giftWindowEndMs) return;
    giftsRef.current += 1;
    setGiftsCaught(giftsRef.current);
  }, [ended, running]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    setEnded(true);
    onCompleteRef.current({
      gameId: "sleigh-runner",
      distance: Math.floor(elapsedRef.current / 250),
      giftsCaught: giftsRef.current,
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const nextElapsed = elapsedRef.current + tickMs;
      elapsedRef.current = nextElapsed;
      setElapsedMs(nextElapsed);
      setDistance(Math.floor(nextElapsed / 250));
      setIsJumping(nextElapsed < jumpUntilRef.current);

      if (nextElapsed >= nextObstacleRef.current) {
        if (nextElapsed >= jumpUntilRef.current) {
          finish();
          return;
        }
        nextObstacleRef.current += obstacleIntervalMs;
      }
    }, tickMs);
    return () => window.clearInterval(timer);
  }, [finish, running]);

  useEffect(() => {
    if (!running) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" || event.key === "ArrowUp") {
        event.preventDefault();
        jump();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        collectGift();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collectGift, jump, running]);

  function startRun() {
    elapsedRef.current = 0;
    jumpUntilRef.current = 0;
    giftsRef.current = 0;
    nextObstacleRef.current = obstacleIntervalMs;
    finishedRef.current = false;
    setElapsedMs(0);
    setDistance(0);
    setGiftsCaught(0);
    setIsJumping(false);
    setEnded(false);
    setRunning(true);
  }

  const giftVisible = running && elapsedMs % obstacleIntervalMs >= giftWindowStartMs && elapsedMs % obstacleIntervalMs <= giftWindowEndMs;

  return (
    <section className="runner-game" aria-labelledby="runner-title">
      <div className="runner-scorebar">
        <p id="runner-title">Чарганы уралдаан</p>
        <div aria-live="polite"><span>Зай: <strong>{distance} м</strong></span><span role="status" aria-label={`Авсан бэлэг: ${giftsCaught}`}>Авсан бэлэг: <strong>{giftsCaught}</strong></span>{running && <span role="status" aria-label="Гүйж байна">Гүйж байна</span>}</div>
      </div>
      <div className="runner-scene" role="img" aria-label="Чарганы 2D уралдаан">
        <span className="runner-moon" aria-hidden="true">☾</span>
        <span className="runner-snow runner-snow--one" aria-hidden="true">✦</span>
        <span className="runner-snow runner-snow--two" aria-hidden="true">·</span>
        <div className="runner-track" aria-hidden="true">
          <span className="runner-track__dash" />
          <span className="runner-track__dash" />
          <span className="runner-track__dash" />
        </div>
        {running && (
          <>
            <div className="runner-player" data-testid="runner-player" data-jumping={isJumping ? "true" : "false"} aria-hidden="true">🛷</div>
            <div className="runner-obstacle" aria-hidden="true">{Math.floor(elapsedMs / obstacleIntervalMs) % 2 === 0 ? "☃️" : "🌲"}</div>
            {giftVisible && <div className="runner-gift" aria-hidden="true">🎁</div>}
          </>
        )}
        {ended && <p className="runner-crash" role="status">Саадтай мөргөлдлөө!</p>}
        {!running && !ended && <div className="runner-intro"><span aria-hidden="true">🛷</span><p>Саадыг хараад үсрээрэй!</p></div>}
      </div>
      <p className="runner-hint">Space, ↑ эсвэл товчоор үсэрнэ. Бэлэг гарвал ↓ эсвэл “Бэлгийг авах” дээр дарна.</p>
      <div className="runner-controls">
        {running ? (
          <>
            <button className="runner-button runner-button--primary" type="button" onClick={jump}>Үсрэх</button>
            {giftVisible && <button className="runner-button runner-button--secondary" type="button" onClick={collectGift}>Бэлгийг авах</button>}
          </>
        ) : (
          <button className="runner-button runner-button--primary" type="button" onClick={startRun}>{ended ? "Дахин уралдах" : "Уралдаж эхлэх"}</button>
        )}
        {ended && <p className="runner-result">Таны зай: <strong>{distance} м</strong></p>}
      </div>
    </section>
  );
}
