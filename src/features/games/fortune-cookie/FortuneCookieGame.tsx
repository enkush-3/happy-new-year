import { useState } from "react";
import { drawFortunes } from "./fortunes";
import "./fortune-cookie.css";

export interface FortuneCookieResult {
  gameId: "fortune-cookie";
  fortunes: string[];
}

interface FortuneCookieGameProps {
  onComplete: (result: FortuneCookieResult) => void;
}

export default function FortuneCookieGame({ onComplete }: FortuneCookieGameProps) {
  const [fortunes, setFortunes] = useState<string[]>([]);

  function revealFortunes() {
    const nextFortunes = drawFortunes(fortunes);
    setFortunes(nextFortunes);
    onComplete({ gameId: "fortune-cookie", fortunes: nextFortunes });
  }

  return (
    <section className="fortune-game" aria-labelledby="fortune-title">
      <div className={`fortune-gift${fortunes.length ? " fortune-gift--open" : ""}`} aria-hidden="true">
        <span>✦</span>
        <span>🎁</span>
        <span>✦</span>
      </div>
      <h2 id="fortune-title">Ирэх жилийн ерөөл</h2>
      <p className="fortune-intro">Бэлгээ нээгээд шинэ жилийн гурван ерөөлөө уншаарай.</p>
      {!fortunes.length ? (
        <button className="fortune-open-button ui-btn" type="button" onClick={revealFortunes}>
          Бэлгээ нээх
        </button>
      ) : (
        <>
          <ol className="fortune-list" aria-label="Таны гурван ерөөл" aria-live="polite">
            {fortunes.map((fortune, index) => <li key={fortune}><span>{index + 1}</span>{fortune}</li>)}
          </ol>
          <button className="fortune-open-button fortune-open-button--tonal ui-btn" type="button" onClick={revealFortunes}>
            Шинэ ерөөл авах
          </button>
        </>
      )}
    </section>
  );
}
