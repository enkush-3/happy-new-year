import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { GameShell, HudBadge, PrimaryButton } from "../../../components/ui/game";
import { advanceRunnerFrame, createRunnerState, startRunnerState, type SleighRunnerState } from "./model";
import { drawRunnerScene } from "./runner-canvas";
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

export default function SleighRunnerGame({ onComplete }: SleighRunnerGameProps) {
  const [game, setGame] = useState(createRunnerState);
  const gameRef = useRef(game);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jumpButtonRef = useRef<HTMLButtonElement>(null);
  const paint = useRef<(() => void) | null>(null);
  const jumpSources = useRef(new Set<string>());
  const pendingInput = useRef({ jumpPressed: false, fastFall: false });
  const hintId = useId();

  const updateRun = useCallback((next: SleighRunnerState) => {
    const previous = gameRef.current;
    gameRef.current = next;
    paint.current?.();

    // Canvas renders every frame; the HUD only needs the displayed values.
    if (next.status !== previous.status || next.score !== previous.score || Math.round(next.speed) !== Math.round(previous.speed)) {
      setGame(next);
    }
  }, []);

  const pressJump = useCallback((source: string) => {
    if (gameRef.current.status !== "running" || jumpSources.current.has(source)) return;
    jumpSources.current.add(source);
    pendingInput.current.jumpPressed = true;
  }, []);

  const clearInput = useCallback(() => {
    jumpSources.current.clear();
    pendingInput.current = { jumpPressed: false, fastFall: false };
    gameRef.current = { ...gameRef.current, jumpBufferMs: 0 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let width = 0;
    let height = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function redraw() {
      if (context && width && height) drawRunnerScene(context, width, height, gameRef.current, reducedMotion.matches);
    }

    function resize() {
      if (!canvas || !context) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * pixelRatio);
      const pixelHeight = Math.round(height * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      redraw();
    }

    paint.current = redraw;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    reducedMotion.addEventListener("change", redraw);
    resize();
    return () => {
      paint.current = null;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      reducedMotion.removeEventListener("change", redraw);
    };
  }, []);

  useEffect(() => {
    if (game.status !== "running") return;

    let animationFrame = 0;
    let lastFrameAt = 0;

    function frame(now: number) {
      if (document.visibilityState === "hidden" || gameRef.current.status !== "running") return;
      const deltaMs = now - lastFrameAt;
      lastFrameAt = now;

      if (deltaMs > 0) {
        const next = advanceRunnerFrame(gameRef.current, deltaMs, {
          ...pendingInput.current,
          jumpHeld: jumpSources.current.size > 0,
        });
        pendingInput.current = { jumpPressed: false, fastFall: false };
        updateRun(next);

        if (next.status === "ended") {
          onCompleteRef.current({
            gameId: "sleigh-runner",
            score: next.score,
            distance: Math.floor(next.distance),
            elapsedMs: Math.floor(next.elapsedMs),
            finalSpeed: Math.round(next.speed),
          });
          return;
        }
      }
      animationFrame = window.requestAnimationFrame(frame);
    }

    function syncVisibility() {
      window.cancelAnimationFrame(animationFrame);
      if (document.visibilityState === "hidden") {
        clearInput();
        return;
      }
      lastFrameAt = performance.now();
      animationFrame = window.requestAnimationFrame(frame);
    }

    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [game.status, updateRun, clearInput]);

  useEffect(() => {
    if (game.status !== "running") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target) || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const source = getJumpKey(event);
      if (source === "space" && event.target !== jumpButtonRef.current && isInteractiveTarget(event.target)) return;

      if (source) {
        event.preventDefault();
        if (!event.repeat) pressJump(source);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!event.repeat) pendingInput.current.fastFall = true;
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const source = getJumpKey(event);
      if (source) jumpSources.current.delete(source);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInput);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
      clearInput();
    };
  }, [game.status, pressJump, clearInput]);

  function startRun() {
    clearInput();
    updateRun(startRunnerState());
  }

  function handleJumpPointerDown(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || gameRef.current.status !== "running") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressJump(`pointer:${event.pointerId}`);
  }

  function handleJumpPointerEnd(event: PointerEvent<HTMLElement>) {
    jumpSources.current.delete(`pointer:${event.pointerId}`);
  }

  function activateJumpButton(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0 && gameRef.current.status === "running") pendingInput.current.jumpPressed = true;
  }

  return (
    <GameShell
      className="runner-game"
      kicker="2D RUNNER"
      title="Чарганы уралдаан"
      description="Гацуурыг давж, аль болох хол яваарай."
      hud={
        <>
          <HudBadge>Оноо <strong>{game.score}</strong></HudBadge>
          <HudBadge>Зай <strong>{Math.floor(game.distance)} м</strong></HudBadge>
          <HudBadge>Хурд <strong>{Math.round(game.speed)} м/с</strong></HudBadge>
        </>
      }
    >
      <div className="runner-content">
        <canvas
          ref={canvasRef}
          className="runner-scene"
          role="img"
          aria-label="Чарга, гацууртай өвлийн зам"
          aria-describedby={hintId}
          onPointerDown={handleJumpPointerDown}
          onPointerUp={handleJumpPointerEnd}
          onPointerCancel={handleJumpPointerEnd}
          onLostPointerCapture={handleJumpPointerEnd}
        />
        {game.status === "ended" && <p className="runner-result" role="status">Саадтай мөргөлдлөө! {game.score} оноо</p>}
        <div className="runner-controls">
          {game.status === "running" ? (
            <PrimaryButton
              ref={jumpButtonRef}
              className="runner-button"
              aria-describedby={hintId}
              onPointerDown={handleJumpPointerDown}
              onPointerUp={handleJumpPointerEnd}
              onPointerCancel={handleJumpPointerEnd}
              onLostPointerCapture={handleJumpPointerEnd}
              onClick={activateJumpButton}
            >
              <span aria-hidden="true">↑</span> Үсрэх
            </PrimaryButton>
          ) : (
            <PrimaryButton className="runner-button" onClick={startRun} aria-describedby={hintId}>
              {game.status === "ended" ? "Дахин уралдах" : "Уралдаж эхлэх"}
            </PrimaryButton>
          )}
        </div>
        <p className="runner-hint" id={hintId}>
          Space, ↑ эсвэл дэлгэц дээр дарж үсэрнэ. Эрт тавибал нам үсэрнэ. ↓ дарвал хурдан бууна.
        </p>
      </div>
    </GameShell>
  );
}

function getJumpKey(event: KeyboardEvent) {
  if (event.code === "Space" || event.key === " ") return "space";
  if (event.key === "ArrowUp") return "up";
  return null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, textarea, select, [contenteditable]"));
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
}
