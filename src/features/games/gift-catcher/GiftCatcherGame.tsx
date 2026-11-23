import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { GameShell, HudBadge, PrimaryButton, SecondaryButton } from "../../../components/ui/game";
import { BasketSprite, FallingSprite, WinterScenery } from "./GiftCatcherArt";
import { advanceGiftCatcherFrame, GIFT_CATCHER_DURATION_MS, GIFT_CATCHER_RIM_Y, GIFT_CATCHER_STARTING_LIVES, moveBasket, type GiftCatcherFrame } from "./model";
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

interface PickupFeedback {
  atMs: number;
  x: number;
  kind: "gift" | "hazard";
  text: string;
}

interface GameState extends GiftCatcherFrame {
  status: "ready" | "running" | "finished";
  roundElapsedMs: number;
  basketTilt: number;
  feedback: PickupFeedback | null;
}

const emptyGame: GameState = {
  status: "ready",
  elapsedMs: 0,
  roundElapsedMs: 0,
  basketX: 50,
  basketTilt: 0,
  objects: [],
  dropsSpawned: 0,
  score: 0,
  giftsCaught: 0,
  hazardsHit: 0,
  lives: GIFT_CATCHER_STARTING_LIVES,
  feedback: null,
};
const tiltHoldMs = 120;
const feedbackDurationMs = 360;
const arenaStyle = {
  "--gift-rim-y": `${GIFT_CATCHER_RIM_Y}%`,
  "--gift-feedback-duration": `${feedbackDurationMs}ms`,
} as CSSProperties;
type Direction = -1 | 1;

export default function GiftCatcherGame({ onComplete }: GiftCatcherGameProps) {
  const [game, setGame] = useState<GameState>(emptyGame);
  const gameRef = useRef(game);
  const pendingBasketX = useRef<number | null>(null);
  const resultSent = useRef(false);
  const heldDirections = useRef(new Map<string, Direction>());

  const commit = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  useEffect(() => {
    if (game.status !== "running") return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (isTextEntryTarget(event.target) || gameRef.current.status !== "running") return;
      const input = getKeyboardInput(event);
      if (!input) return;
      event.preventDefault();
      heldDirections.current.set(input.id, input.direction);
    }

    function onKeyUp(event: globalThis.KeyboardEvent) {
      const input = getKeyboardInput(event);
      if (!input) return;
      event.preventDefault();
      heldDirections.current.delete(input.id);
    }

    function onPointerEnd(event: globalThis.PointerEvent) {
      heldDirections.current.delete(`pointer:${event.pointerId}`);
    }

    function stopMovement() {
      heldDirections.current.clear();
      pendingBasketX.current = null;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("lostpointercapture", onPointerEnd);
    window.addEventListener("blur", stopMovement);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("lostpointercapture", onPointerEnd);
      window.removeEventListener("blur", stopMovement);
      stopMovement();
    };
  }, [game.status]);

  useEffect(() => {
    if (game.status !== "running") return;

    let animationFrame = 0;
    let lastFrameAt = 0;
    let lastBasketMoveMs = 0;

    function frame(now: number) {
      if (document.visibilityState === "hidden") return;
      const current = gameRef.current;
      if (current.status !== "running") return;
      // Keep the countdown on the visible round clock while the model caps gameplay motion.
      const roundElapsedMs = Math.min(current.roundElapsedMs + Math.max(0, now - lastFrameAt), GIFT_CATCHER_DURATION_MS);
      const direction = resolveHeldDirection(heldDirections.current);
      const next = advanceGiftCatcherFrame(current, roundElapsedMs - current.roundElapsedMs, direction, pendingBasketX.current);
      lastFrameAt = now;
      pendingBasketX.current = null;

      let basketTilt = current.basketTilt;
      if (next.basketX !== current.basketX) {
        lastBasketMoveMs = next.elapsedMs;
        basketTilt = Math.sign(next.basketX - current.basketX) * 6;
      } else if (next.elapsedMs - lastBasketMoveMs >= tiltHoldMs) {
        basketTilt = 0;
      }

      const status = roundElapsedMs >= GIFT_CATCHER_DURATION_MS || next.lives === 0 ? "finished" : "running";
      commit({ ...next, roundElapsedMs, basketTilt, status, feedback: getCatchFeedback(current, next) });
      if (status === "running") animationFrame = window.requestAnimationFrame(frame);
    }

    function handleVisibilityChange() {
      window.cancelAnimationFrame(animationFrame);
      if (document.visibilityState === "hidden") {
        heldDirections.current.clear();
        pendingBasketX.current = null;
        return;
      }
      lastFrameAt = performance.now();
      animationFrame = window.requestAnimationFrame(frame);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [game.status, commit]);

  useEffect(() => {
    if (game.status !== "finished" || resultSent.current) return;
    function complete() {
      resultSent.current = true;
      if (game.feedback) commit({ ...game, feedback: null });
      onComplete({
        gameId: "gift-catcher",
        score: game.score,
        giftsCaught: game.giftsCaught,
        hazardsHit: game.hazardsHit,
        elapsedMs: Math.floor(game.roundElapsedMs),
      });
    }

    if (!game.feedback || game.roundElapsedMs >= GIFT_CATCHER_DURATION_MS) {
      complete();
      return;
    }
    const timeout = window.setTimeout(complete, feedbackDurationMs);
    return () => window.clearTimeout(timeout);
  }, [game, onComplete, commit]);

  function startGame() {
    resultSent.current = false;
    pendingBasketX.current = null;
    commit({ ...emptyGame, status: "running" });
  }

  function onArenaPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (gameRef.current.status !== "running" || !event.isPrimary) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;

    pendingBasketX.current = ((event.clientX - bounds.left) / bounds.width) * 100;
  }

  function onArenaPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (gameRef.current.status !== "running" || !event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onArenaPointerMove(event);
  }

  function onControlPointerDown(event: PointerEvent<HTMLButtonElement>, direction: Direction) {
    if (gameRef.current.status !== "running" || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    heldDirections.current.set(`pointer:${event.pointerId}`, direction);
  }

  function onControlClick(event: MouseEvent<HTMLButtonElement>, direction: Direction) {
    const current = gameRef.current;
    if (event.detail !== 0 || current.status !== "running") return;
    pendingBasketX.current = moveBasket(current.basketX, direction);
  }

  const secondsLeft = Math.ceil((GIFT_CATCHER_DURATION_MS - game.roundElapsedMs) / 1_000);
  const isFinished = game.status === "finished";
  const outOfLives = game.lives === 0;
  const showOverlay = game.status === "ready" || (isFinished && !game.feedback);

  return (
    <GameShell
      className="gift-catcher"
      kicker="2D ARCADE"
      title="Бэлэг баригч"
      description="Бэлгээ тосоод, нүүрс болон цасан бөмбөгөөс бултаарай."
      hud={
        <>
          <HudBadge aria-live="polite" aria-atomic="true">Оноо <strong>{game.score}</strong></HudBadge>
          <HudBadge role="timer" aria-label="Үлдсэн хугацаа"><strong>{secondsLeft} сек</strong></HudBadge>
          <HudBadge role="status" aria-label="Амь" aria-atomic="true">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M8 14.3 2.35 8.65a3.55 3.55 0 0 1 5.02-5.02L8 4.26l.63-.63a3.55 3.55 0 0 1 5.02 5.02Z" fill="#f87171" />
            </svg>
            <strong>{game.lives}</strong>
          </HudBadge>
        </>
      }
    >
      <div className="gift-catcher__content">
        <div
          className={`gift-catcher__arena${game.status === "running" ? " is-running" : ""}`}
          style={arenaStyle}
          role="application"
          aria-label="Бэлэг баригч тоглоом"
          tabIndex={0}
          onPointerDown={onArenaPointerDown}
          onPointerMove={onArenaPointerMove}
        >
          <WinterScenery />
          {game.objects.map((item) => (
            <span
              key={item.id}
              className="gift-catcher__falling"
              style={{ transform: `translate(calc(${item.x}cqw - 50%), calc(${item.y}cqh - 50%))` }}
              aria-hidden="true"
              data-testid={`falling-${item.kind}`}
            ><FallingSprite kind={item.kind} /></span>
          ))}
          <div
            className="gift-catcher__basket"
            data-testid="gift-catcher-basket"
            style={{
              "--gift-basket-x": `${game.basketX}cqw`,
              "--gift-basket-tilt": `${game.basketTilt}deg`,
            } as CSSProperties}
            aria-hidden="true"
          >
            <BasketSprite />
          </div>
          {game.feedback && (
            <span
              key={game.feedback.atMs}
              className={`gift-catcher__feedback gift-catcher__feedback--${game.feedback.kind}`}
              style={{ left: `${game.feedback.x}%` }}
              aria-hidden="true"
            >{game.feedback.text}</span>
          )}
          {showOverlay && (
            <div className="gift-catcher__overlay">
              <span className="gift-catcher__overlay-art"><FallingSprite kind={outOfLives ? "coal" : "gift"} /></span>
              {isFinished && <p>{outOfLives ? "Гурван удаа сааданд оногдлоо." : "Хугацаа дууслаа."} {game.score} оноо</p>}
              <PrimaryButton onClick={startGame}>{game.status === "ready" ? "Тоглож эхлэх" : "Дахин тоглох"}</PrimaryButton>
            </div>
          )}
        </div>

        <div className="gift-catcher__controls" role="group" aria-label="Сагсаа удирдах">
          <SecondaryButton
            aria-label="Сагсыг зүүн тийш"
            disabled={game.status !== "running"}
            onPointerDown={(event) => onControlPointerDown(event, -1)}
            onClick={(event) => onControlClick(event, -1)}
          >←</SecondaryButton>
          <SecondaryButton
            aria-label="Сагсыг баруун тийш"
            disabled={game.status !== "running"}
            onPointerDown={(event) => onControlPointerDown(event, 1)}
            onClick={(event) => onControlClick(event, 1)}
          >→</SecondaryButton>
        </div>
        <p className="gift-catcher__hint">Хулганаар чирэх, A/D эсвэл суман товчоор хөдөлгөнө.</p>
      </div>
    </GameShell>
  );
}

function getKeyboardInput(event: globalThis.KeyboardEvent): { id: string; direction: Direction } | null {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowLeft" || event.code === "KeyA" || key === "a") {
    return { id: event.code || event.key, direction: -1 };
  }
  if (event.key === "ArrowRight" || event.code === "KeyD" || key === "d") {
    return { id: event.code || event.key, direction: 1 };
  }
  return null;
}

function resolveHeldDirection(held: ReadonlyMap<string, Direction>): -1 | 0 | 1 {
  let left = false;
  let right = false;
  for (const direction of held.values()) {
    left ||= direction === -1;
    right ||= direction === 1;
  }
  if (left === right) return 0;
  return left ? -1 : 1;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
}

function getCatchFeedback(current: GameState, next: GiftCatcherFrame): PickupFeedback | null {
  const points = next.score - current.score;
  const livesLost = current.lives - next.lives;
  if (points || livesLost) {
    return {
      atMs: next.elapsedMs,
      x: next.basketX,
      kind: livesLost ? "hazard" : "gift",
      text: livesLost ? `−${livesLost}` : `+${points}`,
    };
  }
  if (current.feedback && next.elapsedMs - current.feedback.atMs < feedbackDurationMs) return current.feedback;
  return null;
}
