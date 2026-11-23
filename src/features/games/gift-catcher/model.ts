export const GIFT_CATCHER_STARTING_LIVES = 3;
export const GIFT_CATCHER_BASKET_SPEED_PERCENT_PER_SECOND = 60;
export const GIFT_CATCHER_STARTING_FALL_SPEED = 1;
export const GIFT_CATCHER_MAX_FALL_SPEED = 4;
export const GIFT_CATCHER_RIM_Y = 87;

const fallSpeedRampMs = 30_000;
const dropIntervalMs = 700;
const fallSpeedPercentPerSecond = 32;
const giftCatchHalfWidth = 12;
const giftCatchHalfHeight = 7;
const hazardHitboxScale = 0.85;

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
}

export function moveBasket(position: number, direction: -1 | 1): number {
  return clamp(position + direction * 6, 8, 92);
}

export function moveBasketContinuously(position: number, direction: -1 | 0 | 1, deltaMs: number): number {
  const distance = GIFT_CATCHER_BASKET_SPEED_PERCENT_PER_SECOND * Math.max(0, deltaMs) / 1_000;
  return clamp(position + direction * distance, 8, 92);
}

export function getFallingSpeedMultiplier(elapsedMs: number): number {
  const activeMs = Math.max(0, elapsedMs);
  const progress = activeMs / (activeMs + fallSpeedRampMs);
  return GIFT_CATCHER_STARTING_FALL_SPEED +
    (GIFT_CATCHER_MAX_FALL_SPEED - GIFT_CATCHER_STARTING_FALL_SPEED) * progress;
}

export function positionBasketAt(position: number): number {
  return clamp(position, 8, 92);
}

export function advanceGiftCatcherFrame(
  current: GiftCatcherFrame,
  frameMs: number,
  direction: -1 | 0 | 1,
  pointerX: number | null = null,
): GiftCatcherFrame {
  const deltaTime = Math.min(Math.max(0, frameMs / 1_000), 0.05);
  const elapsedMs = current.elapsedMs + deltaTime * 1_000;
  const basketX = pointerX === null
    ? moveBasketContinuously(current.basketX, direction, deltaTime * 1_000)
    : positionBasketAt(pointerX);
  const fallDistance = getFallDistance(current.elapsedMs, elapsedMs);
  const objects = current.objects.map((item) => ({ ...item, y: item.y + fallDistance }));
  let dropsSpawned = current.dropsSpawned;
  const nextDropAtMs = (dropsSpawned + 1) * dropIntervalMs;

  if (elapsedMs >= nextDropAtMs) {
    const roll = Math.random();
    const kind: FallingObjectKind = roll < 0.68 ? "gift" : roll < 0.84 ? "coal" : "snowball";
    objects.push({
      id: `drop-${dropsSpawned++}`,
      kind,
      x: 8 + Math.random() * 84,
      y: -8 + getFallDistance(nextDropAtMs, elapsedMs),
    });
  }

  const { state, remaining } = resolveCatches(current, objects, basketX);
  return { ...state, elapsedMs, basketX, objects: remaining, dropsSpawned };
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

  return {
    state: {
      score: state.score + gifts * 10,
      giftsCaught: state.giftsCaught + gifts,
      hazardsHit: state.hazardsHit + hazards,
      lives: Math.max(0, state.lives - hazards),
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
