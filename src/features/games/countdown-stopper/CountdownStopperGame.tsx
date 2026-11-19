import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatStopperTarget, formatStopperTime, getStopperResult, getStopperTargetMs, type CountdownStopperResult } from "./model";
import "./countdown-stopper.css";

export interface CountdownStopperGameProps {
  onComplete: (result: CountdownStopperResult) => void;
}

type Status = "ready" | "running" | "finished";

export default function CountdownStopperGame({ onComplete }: CountdownStopperGameProps) {
  const [status, setStatus] = useState<Status>("ready");
  const [targetMs, setTargetMs] = useState(() => getStopperTargetMs());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<CountdownStopperResult | null>(null);
  const startedAt = useRef<number | null>(null);
  const resultSent = useRef(false);

  useEffect(() => {
    if (status !== "running") return;
    const interval = window.setInterval(() => {
      if (startedAt.current === null) return;
      setElapsedMs(Date.now() - startedAt.current);
    }, 10);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (!result || resultSent.current) return;
    resultSent.current = true;
    onComplete(result);
  }, [onComplete, result]);

  function startGame() {
    if (status === "finished") setTargetMs(getStopperTargetMs());
    resultSent.current = false;
    startedAt.current = Date.now();
    setElapsedMs(0);
    setResult(null);
    setStatus("running");
  }

  function stopGame() {
    if (startedAt.current === null) return;
    const elapsed = Date.now() - startedAt.current;
    setElapsedMs(elapsed);
    setResult(getStopperResult(elapsed, targetMs));
    setStatus("finished");
  }

  function onGameKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.code === "Space" && status === "running") {
      event.preventDefault();
      stopGame();
    } else if ((event.key === "Enter" || event.code === "Space") && status === "ready") {
      event.preventDefault();
      startGame();
    }
  }

  return (
    <section className="mini-game countdown-stopper" aria-labelledby="countdown-stopper-title" tabIndex={0} onKeyDown={onGameKeyDown}>
      <header className="mini-game__header">
        <div>
          <p className="mini-game__eyebrow">2D REACTION · 5–10 СЕКУНД</p>
          <h2 id="countdown-stopper-title">Яг цагт нь зогсоо</h2>
          <p className="mini-game__description">Таны зорилт 5.000–10.000 секундын хооронд санамсаргүй сонгогдоно. 00.00-ээс тоолоод харуулсан хугацаанд ойр зогсоогоорой.</p>
        </div>
        <span className="countdown-stopper__target">Зорилт <b>{formatStopperTarget(targetMs)} сек</b></span>
      </header>

      <div className={`countdown-stopper__dial${status === "running" ? " is-running" : ""}`}>
        <span className="countdown-stopper__label">ӨНГӨРСӨН ХУГАЦАА</span>
        <strong data-testid="stopper-display" aria-live="off">{formatStopperTime(elapsedMs)}</strong>
        <span className="countdown-stopper__unit">секунд</span>
        <div className="countdown-stopper__track" aria-hidden="true" />
      </div>

      <div className="countdown-stopper__action">
        {status !== "running" ? (
          <button type="button" className="mini-game__button ui-btn" onClick={startGame}>{status === "ready" ? "Тоглож эхлэх" : "Дахин тоглох"}</button>
        ) : (
          <button type="button" className="mini-game__button countdown-stopper__stop ui-btn" onClick={stopGame}>Зогсоох</button>
        )}
      </div>

      {result && (
        <div className="countdown-stopper__result" role="status" aria-live="polite">
          <strong>{result.deviationMs === 0 ? "Яг оноолоо!" : `${result.deviationMs} мс зөрлөө`}</strong>
          <span>{(result.elapsedMs / 1_000).toFixed(3)} сек · Зорилт: {formatStopperTarget(result.targetMs)} сек · {result.score} оноо</span>
        </div>
      )}
      <p className="mini-game__hint">Зорилт 5.000–10.000 секундын хооронд санамсаргүй сонгогдоно. Space эсвэл товчийг дарж зогсооно.</p>
    </section>
  );
}
