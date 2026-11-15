import { useEffect, useRef, useState, type PointerEvent } from "react";
import { GIFT_CATCHER_DURATION_MS, GIFT_CATCHER_STARTING_LIVES, moveBasket, positionBasketAt, resolveCatches, type CatchStats, type FallingObject, type FallingObjectKind } from "./model";
import "./gift-catcher.css";

export interface GiftCatcherResult {
  gameId: "gift-catcher";
  score: number;
  giftsCaught: number;
  hazardsHit: number;
  elapsedMs: number;
}

export interface GiftCatcherGameProps {
  onComplete: (result: GiftCatcherResult) => void;
}

interface GameState extends CatchStats {
  status: "ready" | "running" | "finished";
  elapsedMs: number;
  basketX: number;
  objects: FallingObject[];
}

const emptyGame: GameState = {
  status: "ready",
  elapsedMs: 0,
  basketX: 50,
  objects: [],
  score: 0,
  giftsCaught: 0,
  hazardsHit: 0,
  lives: GIFT_CATCHER_STARTING_LIVES,
};
const simulationTickMs = 100;

const objectIcons: Record<FallingObjectKind, string> = {
  gift: "🎁",
  coal: "🪨",
  snowball: "❄️",
};

export default function GiftCatcherGame({ onComplete }: GiftCatcherGameProps) {
  const [game, setGame] = useState<GameState>(emptyGame);
  const gameRef = useRef(game);
  gameRef.current = game;
  const nextObjectId = useRef(0);
  const startedAt = useRef(0);
  const lastElapsedMs = useRef(0);
  const nextObjectAtMs = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const resultSent = useRef(false);

  useEffect(() => {
    if (game.status !== "running") return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (isTextEntryTarget(event.target) || gameRef.current.status !== "running") return;
      const key = event.key.toLowerCase();
      const direction = event.key === "ArrowLeft" || event.code === "KeyA" || key === "a"
        ? -1
        : event.key === "ArrowRight" || event.code === "KeyD" || key === "d"
          ? 1
          : 0;
      if (!direction) return;
      event.preventDefault();
      setGame((current) => current.status === "running" ? { ...current, basketX: moveBasket(current.basketX, direction) } : current);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.status]);

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
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const current = gameRef.current;
      if (current.status !== "running") return;
      const elapsedMs = Math.min(Math.max(0, Date.now() - startedAt.current), GIFT_CATCHER_DURATION_MS);
      const deltaMs = Math.max(0, elapsedMs - lastElapsedMs.current);
      lastElapsedMs.current = elapsedMs;
      const objects = current.objects.map((item) => ({ ...item, y: item.y + 3.2 * deltaMs / simulationTickMs }));
      while (elapsedMs >= nextObjectAtMs.current && elapsedMs < GIFT_CATCHER_DURATION_MS) {
        objects.push(makeFallingObject(nextObjectId.current++));
        nextObjectAtMs.current += 700;
      }
      const resolved = resolveCatches(current, objects, current.basketX);
      const status: GameState["status"] = elapsedMs >= GIFT_CATCHER_DURATION_MS || resolved.state.lives <= 0 ? "finished" : "running";
      const nextGame = { ...current, ...resolved.state, elapsedMs, objects: resolved.remaining, status };
      gameRef.current = nextGame;
      setGame(nextGame);
    }, simulationTickMs);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      hiddenAt.current = null;
    };
  }, [game.status]);

  useEffect(() => {
    if (game.status !== "finished" || resultSent.current) return;
    resultSent.current = true;
    onComplete({
      gameId: "gift-catcher",
      score: game.score,
      giftsCaught: game.giftsCaught,
      hazardsHit: game.hazardsHit,
      elapsedMs: game.elapsedMs,
    });
  }, [game, onComplete]);

  function startGame() {
    resultSent.current = false;
    nextObjectId.current = 0;
    startedAt.current = Date.now();
    lastElapsedMs.current = 0;
    nextObjectAtMs.current = 700;
    hiddenAt.current = null;
    const nextGame = { ...emptyGame, status: "running" as const };
    gameRef.current = nextGame;
    setGame(nextGame);
  }

  function onArenaPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (game.status !== "running") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    setGame((current) => ({ ...current, basketX: positionBasketAt(((event.clientX - bounds.left) / bounds.width) * 100) }));
  }

  const secondsLeft = Math.ceil((GIFT_CATCHER_DURATION_MS - game.elapsedMs) / 1000);
  const finishedByHazard = game.status === "finished" && game.lives === 0;

  return (
    <section className="mini-game gift-catcher" aria-labelledby="gift-catcher-title">
      <header className="mini-game__header">
        <div>
          <p className="mini-game__eyebrow">2D ARCADE · 30 СЕКУНД</p>
          <h2 id="gift-catcher-title">Бэлэг баригч</h2>
          <p className="mini-game__description">Бэлгээ тосоод, нүүрс болон цасан бөмбөгөөс бултаарай.</p>
        </div>
        <div className="gift-catcher__stats" aria-live="polite">
          <span>Оноо <b>{game.score}</b></span>
          <span>⏱ {secondsLeft} сек</span>
          <span aria-label={`${game.lives} амь үлдсэн`}>❤️ {game.lives}</span>
        </div>
      </header>

      <div
        className="gift-catcher__arena"
        role="application"
        aria-label="Бэлэг баригч тоглоом"
        tabIndex={0}
        onPointerMove={onArenaPointerMove}
      >
        <span className="gift-catcher__cloud gift-catcher__cloud--one" aria-hidden="true">☁</span>
        <span className="gift-catcher__cloud gift-catcher__cloud--two" aria-hidden="true">☁</span>
        {game.objects.map((item) => (
          <span
            key={item.id}
            className={`gift-catcher__falling gift-catcher__falling--${item.kind}`}
            style={{ left: `${item.x}%`, top: `${item.y}%`, transition: "top 100ms linear" }}
            aria-hidden="true"
            data-testid={`falling-${item.kind}`}
          >{objectIcons[item.kind]}</span>
        ))}
        <div className="gift-catcher__basket" data-testid="gift-catcher-basket" style={{ left: `${game.basketX}%` }} aria-label="Бэлгийн сагс">
          <span aria-hidden="true">🧺</span>
        </div>
        {game.status !== "running" && (
          <div className="mini-game__overlay">
            {game.status === "ready" ? (
              <>
                <span className="mini-game__overlay-icon" aria-hidden="true">🎁</span>
                <p>30 секундэд аль болох олон бэлэг тосоорой.</p>
                <button type="button" className="mini-game__button" onClick={startGame}>Тоглож эхлэх</button>
              </>
            ) : (
              <>
                <span className="mini-game__overlay-icon" aria-hidden="true">{finishedByHazard ? "🪨" : "🎉"}</span>
                <p>{finishedByHazard ? "Гурван удаа сааданд оногдлоо." : "Раунд дууслаа!"} {game.score} оноо</p>
                <button type="button" className="mini-game__button" onClick={startGame}>Дахин тоглох</button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="gift-catcher__mobile-controls" aria-label="Сагсаа удирдах">
        <button type="button" aria-label="Сагсыг зүүн тийш" disabled={game.status !== "running"} onClick={() => setGame((current) => ({ ...current, basketX: moveBasket(current.basketX, -1) }))}>←</button>
        <span>Сагсаа хөдөлгө</span>
        <button type="button" aria-label="Сагсыг баруун тийш" disabled={game.status !== "running"} onClick={() => setGame((current) => ({ ...current, basketX: moveBasket(current.basketX, 1) }))}>→</button>
      </div>
      <p className="mini-game__hint">Хулганаар чирэх, суман товч эсвэл A/D дарж сагсаа хөдөлгөнө.</p>
    </section>
  );
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
}

function makeFallingObject(index: number): FallingObject {
  const value = Math.random();
  const kind: FallingObjectKind = value < 0.68 ? "gift" : value < 0.84 ? "coal" : "snowball";
  return {
    id: `drop-${index}`,
    kind,
    x: 8 + Math.random() * 84,
    y: -8,
  };
}
