import {
  RUNNER_JUMP_SPEED,
  RUNNER_SLED_HEIGHT,
  RUNNER_SLED_WIDTH,
  RUNNER_TREES,
  type SleighRunnerState,
  type TreeVariant,
} from "./model";

const sky = "#0f172a";
const snow = "#e2e8f0";
const sledRed = "#ef4444";
const giftGold = "#f5b731";
const stars = [
  [0.07, 0.17, 1], [0.19, 0.29, 1.5], [0.24, 0.12, 1], [0.35, 0.42, 1],
  [0.44, 0.24, 1.5], [0.54, 0.13, 1], [0.65, 0.33, 1], [0.74, 0.2, 1],
  [0.87, 0.37, 1.5], [0.94, 0.14, 1],
] as const;
const groundMarks = [
  [1.25, 0.25, 0.65], [4.1, 0.67, 0.32], [6.6, 0.42, 0.95], [10.3, 0.78, 0.45],
  [12.9, 0.27, 0.38], [15.8, 0.52, 0.78], [18.2, 0.73, 0.25],
] as const;
const groundPeriod = 20;
const landingTiltMs = 105;

export function drawRunnerScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SleighRunnerState,
  reducedMotion: boolean,
) {
  const pixelsPerMeter = Math.max(6.4, width / 64);
  const groundY = height - Math.max(32, Math.min(width * 0.065, 50));
  const playerX = width * 0.17;
  drawSky(context, width, height, reducedMotion ? 0 : state.distance * pixelsPerMeter * 0.085);
  drawGround(context, width, height, groundY, pixelsPerMeter, state.distance);

  if (state.status === "ready") {
    drawTreeGroup(context, "small", width * 0.68, groundY, pixelsPerMeter);
    drawTreeGroup(context, "tall", width * 0.85, groundY, pixelsPerMeter);
  }

  for (const obstacle of state.obstacles) {
    const x = playerX + (obstacle.distance - state.distance) * pixelsPerMeter;
    if (x < width && x + RUNNER_TREES[obstacle.variant].width * pixelsPerMeter > 0) {
      drawTreeGroup(context, obstacle.variant, x, groundY, pixelsPerMeter);
    }
  }

  const pitch = reducedMotion ? 0 : getSledPitch(state);
  drawSled(context, playerX, groundY - state.height * pixelsPerMeter, pixelsPerMeter, pitch);
}

function drawSky(context: CanvasRenderingContext2D, width: number, height: number, parallaxPx: number) {
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#94a3b8";
  const offset = parallaxPx % width;
  for (const [x, y, radius] of stars) {
    const starX = (x * width - offset + width) % width;
    drawDisc(context, starX, y * height, radius);
  }

  const moonX = width * 0.84;
  const moonY = height * 0.21;
  const radius = width < 420 ? 10 : 14;
  context.fillStyle = snow;
  drawDisc(context, moonX, moonY, radius);
  context.fillStyle = sky;
  drawDisc(context, moonX + radius * 0.35, moonY - radius * 0.33, radius * 0.92);
}

function drawGround(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  groundY: number,
  pixelsPerMeter: number,
  distance: number,
) {
  const groundHeight = height - groundY;
  context.fillStyle = snow;
  context.fillRect(0, groundY, width, groundHeight);

  const segmentWidth = groundPeriod * pixelsPerMeter;
  const offset = (distance % groundPeriod) * pixelsPerMeter;
  context.fillStyle = "#94a3b8";
  // The trees and ground marks both translate by the same world distance.
  for (let x = -offset - segmentWidth; x < width; x += segmentWidth) {
    for (const [markX, depth, length] of groundMarks) {
      context.fillRect(x + markX * pixelsPerMeter, groundY + depth * groundHeight, length * pixelsPerMeter, 1.5);
    }
  }
}

function drawTreeGroup(context: CanvasRenderingContext2D, variant: TreeVariant, x: number, groundY: number, scale: number) {
  for (const tree of RUNNER_TREES[variant].trees) {
    const left = x + tree.offset * scale;
    const width = tree.width * scale;
    const height = tree.height * scale;
    const center = left + width / 2;

    context.fillStyle = "#78350f";
    context.fillRect(center - width * 0.09, groundY - height * 0.22, width * 0.18, height * 0.22);
    context.fillStyle = "#059669";
    drawTriangle(context, center, groundY - height * 0.7, width, groundY - height * 0.17);
    context.fillStyle = "#10b981";
    drawTriangle(context, center, groundY - height, width * 0.75, groundY - height * 0.46);
  }
}

function drawTriangle(context: CanvasRenderingContext2D, center: number, top: number, width: number, base: number) {
  context.beginPath();
  context.moveTo(center, top);
  context.lineTo(center + width / 2, base);
  context.lineTo(center - width / 2, base);
  context.closePath();
  context.fill();
}

function drawDisc(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function getSledPitch(state: SleighRunnerState): number {
  if (state.height > 0) {
    const velocity = Math.max(-0.65, Math.min(1, state.verticalVelocity / RUNNER_JUMP_SPEED));
    return -velocity * 7 * Math.PI / 180;
  }
  if (state.lastLandingMs === null) return 0;
  const settling = Math.max(0, 1 - (state.elapsedMs - state.lastLandingMs) / landingTiltMs);
  return settling * 4 * Math.PI / 180;
}

function drawSled(context: CanvasRenderingContext2D, x: number, y: number, scale: number, pitch: number) {
  const halfWidth = RUNNER_SLED_WIDTH / 2;
  const giftSize = 2.2;
  const giftX = -1.5;
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.rotate(pitch);

  context.strokeStyle = snow;
  context.lineWidth = 0.27;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-halfWidth + 0.2, -0.28);
  context.lineTo(halfWidth - 0.8, -0.28);
  context.quadraticCurveTo(halfWidth - 0.14, -0.28, halfWidth - 0.14, -1.18);
  context.moveTo(-2, -0.28);
  context.lineTo(-1.7, -1.37);
  context.moveTo(1.65, -0.28);
  context.lineTo(1.95, -1.37);
  context.stroke();

  context.fillStyle = sledRed;
  context.fillRect(-halfWidth, -1.8, RUNNER_SLED_WIDTH - 0.44, 0.53);
  context.fillStyle = giftGold;
  context.fillRect(giftX, -RUNNER_SLED_HEIGHT, giftSize, giftSize);
  context.fillStyle = sledRed;
  context.fillRect(giftX + 0.9, -RUNNER_SLED_HEIGHT, 0.4, giftSize);
  context.fillRect(giftX, -RUNNER_SLED_HEIGHT + 0.89, giftSize, 0.36);
  context.restore();
}
