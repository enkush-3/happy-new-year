export type OrnamentKind = "bauble-red" | "bauble-gold" | "bauble-green" | "candy-cane" | "star";

export interface TreeDecoration {
  id: string;
  kind: OrnamentKind;
  x: number;
  y: number;
}

export interface TreeDesign {
  version: 1;
  decorations: TreeDecoration[];
}

export const MAX_DECORATIONS = 48;
export const TREE_PLACEMENT_BOUNDS = { minX: 0.16, maxX: 0.84, minY: 0.16, maxY: 0.82 } as const;
export const DEFAULT_TREE_DESIGN: TreeDesign = { version: 1, decorations: [] };

const ornamentKinds = new Set<OrnamentKind>([
  "bauble-red",
  "bauble-gold",
  "bauble-green",
  "candy-cane",
  "star",
]);
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
const maxFragmentLength = 4096;

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

export function encodeTreeFragment(design: TreeDesign): string {
  if (!isTreeDesign(design)) throw new Error("Модны өгөгдөл буруу байна.");
  const json = JSON.stringify({
    v: 1,
    d: design.decorations.map((decoration) => [
      decoration.id,
      compactKindCode[decoration.kind],
      Math.round(decoration.x * 1000),
      Math.round(decoration.y * 1000),
    ]),
  });
  if (json.length > maxFragmentLength) throw new Error("Модны share линк хэт урт байна.");

  const encoded = btoa(json).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  return `#tree=${encoded}`;
}

export function decodeTreeFragment(fragment: string): { design: TreeDesign; valid: boolean } {
  const value = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!value || !value.startsWith("tree=")) return { design: DEFAULT_TREE_DESIGN, valid: true };

  const encoded = value.slice("tree=".length);
  if (!encoded || encoded.length > maxFragmentLength || !/^[A-Za-z0-9_-]+$/u.test(encoded)) {
    return { design: DEFAULT_TREE_DESIGN, valid: false };
  }

  try {
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
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
  const payload = value as { v?: unknown; d?: unknown };
  if (payload.v !== 1 || !Array.isArray(payload.d) || payload.d.length > MAX_DECORATIONS) return null;

  const decorations: TreeDecoration[] = [];
  for (const entry of payload.d) {
    if (!Array.isArray(entry) || entry.length !== 4) return null;
    const [id, code, x, y] = entry as unknown[];
    const kind = typeof code === "string" ? expandedKindCode[code] : undefined;
    if (
      typeof id !== "string" ||
      typeof x !== "number" || !Number.isInteger(x) || x < 0 || x > 1000 ||
      typeof y !== "number" || !Number.isInteger(y) || y < 0 || y > 1000 ||
      !kind
    ) {
      return null;
    }
    decorations.push({ id, kind, x: x / 1000, y: y / 1000 });
  }

  const design: TreeDesign = { version: 1, decorations };
  return isTreeDesign(design) ? design : null;
}

function isTreeDesign(value: unknown): value is TreeDesign {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TreeDesign>;
  if (candidate.version !== 1 || !Array.isArray(candidate.decorations)) return false;
  if (candidate.decorations.length > MAX_DECORATIONS) return false;

  const ids = new Set<string>();
  return candidate.decorations.every((decoration) => {
    if (!isDecoration(decoration) || ids.has(decoration.id)) return false;
    ids.add(decoration.id);
    return true;
  });
}

function isDecoration(value: unknown): value is TreeDecoration {
  if (!value || typeof value !== "object") return false;
  const decoration = value as Partial<TreeDecoration>;
  return (
    typeof decoration.id === "string" &&
    /^[A-Za-z0-9_-]{1,40}$/u.test(decoration.id) &&
    ornamentKinds.has(decoration.kind as OrnamentKind) &&
    typeof decoration.x === "number" &&
    Number.isFinite(decoration.x) &&
    decoration.x >= 0 &&
    decoration.x <= 1 &&
    typeof decoration.y === "number" &&
    Number.isFinite(decoration.y) &&
    decoration.y >= 0 &&
    decoration.y <= 1
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
