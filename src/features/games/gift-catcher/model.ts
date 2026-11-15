export const GIFT_CATCHER_DURATION_MS = 30_000;
export const GIFT_CATCHER_STARTING_LIVES = 3;

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

export function moveBasket(position: number, direction: -1 | 1): number {
  return clamp(position + direction * 6, 8, 92);
}

export function positionBasketAt(position: number): number {
  return clamp(position, 8, 92);
}

export function resolveCatches(
  state: CatchStats,
  objects: FallingObject[],
  basketX: number,
): { state: CatchStats; remaining: FallingObject[] } {
  const caught = objects.filter((item) => item.y >= 80 && item.y <= 94 && Math.abs(item.x - basketX) <= 12);
  const caughtIds = new Set(caught.map(({ id }) => id));
  const gifts = caught.filter(({ kind }) => kind === "gift").length;
  const hazards = caught.length - gifts;

  return {
    state: {
      score: state.score + gifts * 10,
      giftsCaught: state.giftsCaught + gifts,
      hazardsHit: state.hazardsHit + hazards,
      lives: Math.max(0, state.lives - hazards),
    },
    remaining: objects.filter((item) => !caughtIds.has(item.id) && item.y <= 100),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
