export type OrnamentKind = "bauble-red" | "bauble-gold" | "bauble-green" | "candy-cane" | "star";
export type TreeMode = "classic" | "custom";
export type TreePenColor = "snow" | "gold" | "berry" | "ice";
export type TreePenWidth = 5 | 8 | 12;

export interface TreeDecoration {
  id: string;
  kind: OrnamentKind;
  x: number;
  y: number;
}

export interface TreePoint {
  x: number;
  y: number;
}

export interface TreeStroke {
  id: string;
  color: TreePenColor;
  width: TreePenWidth;
  points: TreePoint[];
}

export interface TreeDesign {
  version: 2;
  treeMode: TreeMode;
  decorations: TreeDecoration[];
  strokes: TreeStroke[];
}

export const MAX_DECORATIONS = 48;
export const MAX_DRAWING_STROKES = 16;
export const MAX_DRAWING_POINTS = 320;
export const MAX_POINTS_PER_STROKE = 80;
export const TREE_PLACEMENT_BOUNDS = { minX: 0.16, maxX: 0.84, minY: 0.16, maxY: 0.82 } as const;
export const DEFAULT_TREE_DESIGN: TreeDesign = {
  version: 2,
  treeMode: "classic",
  decorations: [],
  strokes: [],
};

const ornamentKinds = new Set<OrnamentKind>([
  "bauble-red",
  "bauble-gold",
  "bauble-green",
  "candy-cane",
  "star",
]);
const penColors = new Set<TreePenColor>(["snow", "gold", "berry", "ice"]);
const compactKindCode: Record<OrnamentKind, string> = {
  "bauble-red": "r",
  "bauble-gold": "g",
  "bauble-green": "n",
  "candy-cane": "c",
  star: "s",
};
const expandedKindCode = Object.fromEntries(
  Object.entries(compactKindCode).map(([kind, code]) => [code, kind]),
) as Record<string, OrnamentKind>;
const compactPenColor: Record<TreePenColor, string> = { snow: "w", gold: "g", berry: "r", ice: "i" };
const expandedPenColor = Object.fromEntries(
  Object.entries(compactPenColor).map(([color, code]) => [code, color]),
) as Record<string, TreePenColor>;
const compactPenWidth: Record<TreePenWidth, number> = { 5: 0, 8: 1, 12: 2 };
const expandedPenWidth: Record<number, TreePenWidth> = { 0: 5, 1: 8, 2: 12 };
const maxFragmentLength = 8192;

export function addDecoration(design: TreeDesign, decoration: TreeDecoration): TreeDesign {
  if (
    design.decorations.length >= MAX_DECORATIONS ||
    !isDecoration(decoration) ||
    design.decorations.some((existing) => existing.id === decoration.id)
  ) {
    return design;
  }

  return { ...design, decorations: [...design.decorations, { ...decoration }] };
}

export function moveDecoration(design: TreeDesign, id: string, x: number, y: number): TreeDesign {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return design;
  const index = design.decorations.findIndex((decoration) => decoration.id === id);
  if (index < 0) return design;

  const decorations = design.decorations.slice();
  decorations[index] = {
    ...decorations[index],
    x: clamp(x, TREE_PLACEMENT_BOUNDS.minX, TREE_PLACEMENT_BOUNDS.maxX),
    y: clamp(y, TREE_PLACEMENT_BOUNDS.minY, TREE_PLACEMENT_BOUNDS.maxY),
  };
  return { ...design, decorations };
}

export function removeDecoration(design: TreeDesign, id: string): TreeDesign {
  const decorations = design.decorations.filter((decoration) => decoration.id !== id);
  return decorations.length === design.decorations.length ? design : { ...design, decorations };
}

export function addStroke(design: TreeDesign, stroke: TreeStroke): TreeDesign {
  const drawingPoints = countDrawingPoints(design.strokes);
  if (
    design.strokes.length >= MAX_DRAWING_STROKES ||
    drawingPoints + stroke.points.length > MAX_DRAWING_POINTS ||
    !isStroke(stroke) ||
    design.strokes.some((existing) => existing.id === stroke.id)
  ) {
    return design;
  }

  return { ...design, strokes: [...design.strokes, copyStroke(stroke)] };
}

export function removeStroke(design: TreeDesign, id: string): TreeDesign {
  const strokes = design.strokes.filter((stroke) => stroke.id !== id);
  return strokes.length === design.strokes.length ? design : { ...design, strokes };
}

export function encodeTreeFragment(design: TreeDesign): string {
  if (!isTreeDesign(design)) throw new Error("Модны өгөгдөл буруу байна.");
  const json = JSON.stringify({
    v: 2,
    m: design.treeMode === "custom" ? "c" : "p",
    d: design.decorations.map((decoration) => [
      decoration.id,
      compactKindCode[decoration.kind],
      Math.round(decoration.x * 1000),
      Math.round(decoration.y * 1000),
    ]),
    s: design.strokes.map((stroke) => [
      stroke.id,
      compactPenColor[stroke.color],
      compactPenWidth[stroke.width],
      encodePoints(stroke.points),
    ]),
  });
  const encoded = toBase64Url(json);
  if (encoded.length + "#tree=".length > maxFragmentLength) {
    throw new Error("Модны share линк хэт урт байна.");
  }

  return `#tree=${encoded}`;
}

export function decodeTreeFragment(fragment: string): { design: TreeDesign; valid: boolean } {
  const value = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!value || !value.startsWith("tree=")) return { design: DEFAULT_TREE_DESIGN, valid: true };

  const encoded = value.slice("tree=".length);
  if (!encoded || encoded.length + "#tree=".length > maxFragmentLength || !/^[A-Za-z0-9_-]+$/u.test(encoded)) {
    return { design: DEFAULT_TREE_DESIGN, valid: false };
  }

  try {
    const json = fromBase64Url(encoded);
    const payload: unknown = JSON.parse(json);
    const design = expandCompactDesign(payload);
    if (!design) return { design: DEFAULT_TREE_DESIGN, valid: false };
    return { design, valid: true };
  } catch {
    return { design: DEFAULT_TREE_DESIGN, valid: false };
  }
}

function expandCompactDesign(value: unknown): TreeDesign | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as { v?: unknown; m?: unknown; d?: unknown; s?: unknown };
  if (!Array.isArray(payload.d) || payload.d.length > MAX_DECORATIONS) return null;

  if (payload.v === 1) {
    const decorations = expandDecorations(payload.d);
    return decorations ? { ...DEFAULT_TREE_DESIGN, decorations } : null;
  }
  if (payload.v !== 2 || (payload.m !== "c" && payload.m !== "p") || !Array.isArray(payload.s)) return null;

  const decorations = expandDecorations(payload.d);
  if (!decorations || payload.s.length > MAX_DRAWING_STROKES) return null;

  const strokes: TreeStroke[] = [];
  for (const entry of payload.s) {
    const stroke = expandStroke(entry);
    if (!stroke || strokes.some((existing) => existing.id === stroke.id)) return null;
    strokes.push(stroke);
  }

  if (countDrawingPoints(strokes) > MAX_DRAWING_POINTS) return null;
  return {
    version: 2,
    treeMode: payload.m === "c" ? "custom" : "classic",
    decorations,
    strokes,
  };
}

function expandDecorations(value: unknown[]): TreeDecoration[] | null {
  const decorations: TreeDecoration[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 4) return null;
    const [id, code, x, y] = entry as unknown[];
    const kind = typeof code === "string" ? expandedKindCode[code] : undefined;
    if (
      typeof id !== "string" ||
      !validId(id) ||
      typeof x !== "number" || !Number.isInteger(x) || x < 0 || x > 1000 ||
      typeof y !== "number" || !Number.isInteger(y) || y < 0 || y > 1000 ||
      !kind || decorations.some((decoration) => decoration.id === id)
    ) {
      return null;
    }
    decorations.push({ id, kind, x: x / 1000, y: y / 1000 });
  }
  return decorations;
}

function expandStroke(value: unknown): TreeStroke | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const [id, colorCode, widthCode, encodedPoints] = value as unknown[];
  const color = typeof colorCode === "string" ? expandedPenColor[colorCode] : undefined;
  const width = typeof widthCode === "number" ? expandedPenWidth[widthCode] : undefined;
  if (!validId(id) || !color || !width || typeof encodedPoints !== "string") return null;

  const points = decodePoints(encodedPoints);
  if (!points) return null;
  const stroke: TreeStroke = { id, color, width, points };
  return isStroke(stroke) ? stroke : null;
}

function encodePoints(points: TreePoint[]): string {
  const bytes: number[] = [];
  for (const point of points) {
    for (const value of [point.x, point.y]) {
      const coordinate = Math.round(value * 1000);
      bytes.push((coordinate >> 8) & 0xff, coordinate & 0xff);
    }
  }
  const binary = String.fromCharCode(...bytes);
  return toBase64Url(binary);
}

function decodePoints(encoded: string): TreePoint[] | null {
  const maxEncodedPointLength = Math.ceil((MAX_POINTS_PER_STROKE * 16) / 3) + 4;
  if (!encoded || encoded.length > maxEncodedPointLength || !/^[A-Za-z0-9_-]+$/u.test(encoded)) {
    return null;
  }

  try {
    const binary = fromBase64Url(encoded);
    if (!binary.length || binary.length % 4 !== 0 || binary.length / 4 > MAX_POINTS_PER_STROKE) return null;
    const points: TreePoint[] = [];
    for (let index = 0; index < binary.length; index += 4) {
      const x = (binary.charCodeAt(index) << 8) | binary.charCodeAt(index + 1);
      const y = (binary.charCodeAt(index + 2) << 8) | binary.charCodeAt(index + 3);
      if (x > 1000 || y > 1000) return null;
      points.push({ x: x / 1000, y: y / 1000 });
    }
    return points;
  } catch {
    return null;
  }
}

function toBase64Url(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}

function isTreeDesign(value: unknown): value is TreeDesign {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TreeDesign>;
  if (
    candidate.version !== 2 ||
    (candidate.treeMode !== "classic" && candidate.treeMode !== "custom") ||
    !Array.isArray(candidate.decorations) || candidate.decorations.length > MAX_DECORATIONS ||
    !Array.isArray(candidate.strokes) || candidate.strokes.length > MAX_DRAWING_STROKES ||
    countDrawingPoints(candidate.strokes) > MAX_DRAWING_POINTS
  ) return false;

  const decorationIds = new Set<string>();
  if (!candidate.decorations.every((decoration) => {
    if (!isDecoration(decoration) || decorationIds.has(decoration.id)) return false;
    decorationIds.add(decoration.id);
    return true;
  })) return false;

  const strokeIds = new Set<string>();
  return candidate.strokes.every((stroke) => {
    if (!isStroke(stroke) || strokeIds.has(stroke.id)) return false;
    strokeIds.add(stroke.id);
    return true;
  });
}

function isStroke(value: unknown): value is TreeStroke {
  if (!value || typeof value !== "object") return false;
  const stroke = value as Partial<TreeStroke>;
  return (
    validId(stroke.id) &&
    penColors.has(stroke.color as TreePenColor) &&
    (stroke.width === 5 || stroke.width === 8 || stroke.width === 12) &&
    Array.isArray(stroke.points) && stroke.points.length > 0 && stroke.points.length <= MAX_POINTS_PER_STROKE &&
    stroke.points.every(isTreePoint)
  );
}

function isTreePoint(value: unknown): value is TreePoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<TreePoint>;
  return (
    typeof point.x === "number" && Number.isFinite(point.x) && point.x >= 0 && point.x <= 1 &&
    typeof point.y === "number" && Number.isFinite(point.y) && point.y >= 0 && point.y <= 1
  );
}

function isDecoration(value: unknown): value is TreeDecoration {
  if (!value || typeof value !== "object") return false;
  const decoration = value as Partial<TreeDecoration>;
  return (
    validId(decoration.id) &&
    ornamentKinds.has(decoration.kind as OrnamentKind) &&
    typeof decoration.x === "number" && Number.isFinite(decoration.x) && decoration.x >= 0 && decoration.x <= 1 &&
    typeof decoration.y === "number" && Number.isFinite(decoration.y) && decoration.y >= 0 && decoration.y <= 1
  );
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/u.test(value);
}

function countDrawingPoints(strokes: TreeStroke[] | undefined): number {
  return strokes?.reduce((total, stroke) => total + (Array.isArray(stroke.points) ? stroke.points.length : 0), 0) ?? 0;
}

function copyStroke(stroke: TreeStroke): TreeStroke {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
