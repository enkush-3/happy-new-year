export const GIFT_CATCHER_STARTING_LIVES = 3;
export const GIFT_CATCHER_BASKET_SPEED_PERCENT_PER_SECOND = 60;
export const GIFT_CATCHER_STARTING_FALL_SPEED = 1;
export const GIFT_CATCHER_MAX_FALL_SPEED = 4;
export const GIFT_CATCHER_RIM_Y = 87;
export const GIFT_CATCHER_WIDTH = 15;
export const GIFT_CATCHER_FIRST_DROP_MS = 700;

const fallSpeedRampMs = 30_000;
const difficultyRampMs = 30_000;
const minimumWaveIntervalMs = 440;
const fallSpeedPercentPerSecond = 32;
const basketMinX = 8;
const basketMaxX = 92;
const giftCatchHalfWidth = 12;
const giftCatchHalfHeight = 7;
const hazardHitboxScale = 0.85;
const hazardCatchHalfWidth = giftCatchHalfWidth * hazardHitboxScale;
const safeLaneHalfWidth = GIFT_CATCHER_WIDTH * 1.45 / 2;
const maxLaneShift = GIFT_CATCHER_BASKET_SPEED_PERCENT_PER_SECOND * minimumWaveIntervalMs / 1_000 * 0.6;
const waveColumns = [8, 20, 32, 44, 56, 68, 80, 92];

export type FallingObjectKind = "gift" | "coal" | "snowball";

export interface FallingObject {
  id: string;
  kind: FallingObjectKind;
  x: number;
  y: number;
}

export interface CatchStats {
  score: number;
  giftsCaught: number;
  hazardsHit: number;
  lives: number;
}

export interface GiftCatcherFrame extends CatchStats {
  elapsedMs: number;
  basketX: number;
  objects: FallingObject[];
  dropsSpawned: number;
  nextWaveAtMs: number;
  safeLaneX: number;
}

export function moveBasket(position: number, direction: -1 | 1): number {
  return positionBasketAt(position + direction * 6);
}

export function moveBasketContinuously(position: number, direction: -1 | 0 | 1, deltaMs: number): number {
  const distance = GIFT_CATCHER_BASKET_SPEED_PERCENT_PER_SECOND * Math.max(0, deltaMs) / 1_000;
  return positionBasketAt(position + direction * distance);
}

export function getFallingSpeedMultiplier(elapsedMs: number): number {
  const activeMs = Math.max(0, elapsedMs);
  const progress = activeMs / (activeMs + fallSpeedRampMs);
  return GIFT_CATCHER_STARTING_FALL_SPEED +
    (GIFT_CATCHER_MAX_FALL_SPEED - GIFT_CATCHER_STARTING_FALL_SPEED) * progress;
}

export function positionBasketAt(position: number): number {
  return clamp(position, basketMinX, basketMaxX);
}

export function getGiftCatcherDifficulty(elapsedMs: number) {
  const progress = clamp(elapsedMs / difficultyRampMs, 0, 1);
  return {
    intervalMs: GIFT_CATCHER_FIRST_DROP_MS - (GIFT_CATCHER_FIRST_DROP_MS - minimumWaveIntervalMs) * progress,
    hazardWeight: 0.25 + 0.35 * progress,
    multiChance: 0.72 * progress,
    tripleChance: 0.34 * progress ** 2,
  };
}

export function advanceGiftCatcherFrame(
  current: GiftCatcherFrame,
  frameMs: number,
  direction: -1 | 0 | 1,
  pointerX: number | null = null,
  random = Math.random,
): GiftCatcherFrame {
  const deltaTime = Math.min(Math.max(0, frameMs / 1_000), 0.05);
  const elapsedMs = current.elapsedMs + deltaTime * 1_000;
  const basketX = pointerX === null
    ? moveBasketContinuously(current.basketX, direction, deltaTime * 1_000)
    : positionBasketAt(pointerX);
  const fallDistance = getFallDistance(current.elapsedMs, elapsedMs);
  const objects = current.objects.map((item) => ({ ...item, y: item.y + fallDistance }));
  let { dropsSpawned, nextWaveAtMs, safeLaneX } = current;

  if (elapsedMs >= nextWaveAtMs) {
    const difficulty = getGiftCatcherDifficulty(nextWaveAtMs);
    const sizeRoll = random();
    const count = sizeRoll < difficulty.tripleChance ? 3 : sizeRoll < difficulty.multiChance ? 2 : 1;
    // Move the safe lane a short, reachable distance between consecutive waves.
    safeLaneX = clamp(safeLaneX + (random() * 2 - 1) * maxLaneShift, basketMinX + safeLaneHalfWidth, basketMaxX - safeLaneHalfWidth);
    const available = [...waveColumns];
    const y = -8 + getFallDistance(nextWaveAtMs, elapsedMs);

    for (let item = 0; item < count; item += 1) {
      const roll = random();
      const kind: FallingObjectKind = roll < 1 - difficulty.hazardWeight ? "gift"
        : roll < 1 - difficulty.hazardWeight / 2 ? "coal" : "snowball";
      const columns = kind === "gift" ? available
        : available.filter((x) => Math.abs(x - safeLaneX) > safeLaneHalfWidth + hazardCatchHalfWidth);
      const x = columns[Math.floor(random() * columns.length)];
      available.splice(available.indexOf(x), 1);
      objects.push({ id: `drop-${dropsSpawned++}`, kind, x, y });
    }
    nextWaveAtMs += difficulty.intervalMs;
  }

  const { state, remaining } = resolveCatches(current, objects, basketX);
  return { ...state, elapsedMs, basketX, objects: remaining, dropsSpawned, nextWaveAtMs, safeLaneX };
}

export function resolveCatches(
  state: CatchStats,
  objects: FallingObject[],
  basketX: number,
): { state: CatchStats; remaining: FallingObject[] } {
  let gifts = 0;
  let hazards = 0;
  const remaining = objects.filter((item) => {
    const isGift = item.kind === "gift";
    const scale = isGift ? 1 : hazardHitboxScale;
    const caught = Math.abs(item.y - GIFT_CATCHER_RIM_Y) <= giftCatchHalfHeight * scale &&
      Math.abs(item.x - basketX) <= giftCatchHalfWidth * scale;

    if (!caught) return item.y <= 100;
    if (isGift) gifts += 1;
    else hazards += 1;
    return false;
  });

  const livesLost = Math.min(hazards, state.lives);
  return {
    state: {
      score: state.score + gifts * 10,
      giftsCaught: state.giftsCaught + gifts,
      hazardsHit: state.hazardsHit + livesLost,
      lives: state.lives - livesLost,
    },
    remaining,
  };
}

function getFallDistance(fromMs: number, toMs: number): number {
  const deltaMs = toMs - fromMs;
  const curveTimeMs = fromMs + fallSpeedRampMs;
  const remainingSpeedGain = GIFT_CATCHER_MAX_FALL_SPEED - getFallingSpeedMultiplier(fromMs);
  // Integrate the speed curve so fall distance does not depend on the frame rate.
  const rampArea = remainingSpeedGain * curveTimeMs * Math.log1p(deltaMs / curveTimeMs);
  return fallSpeedPercentPerSecond * (GIFT_CATCHER_MAX_FALL_SPEED * deltaMs - rampArea) / 1_000;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
