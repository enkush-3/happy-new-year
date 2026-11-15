import { describe, expect, it } from "vitest";
import {
  addDecoration,
  addStroke,
  decodeTreeFragment,
  DEFAULT_TREE_DESIGN,
  encodeTreeFragment,
  MAX_DECORATIONS,
  MAX_POINTS_PER_STROKE,
  MAX_DRAWING_STROKES,
  moveDecoration,
  removeDecoration,
  removeStroke,
  type TreeDecoration,
  type TreeDesign,
  type TreeStroke,
} from "./tree-state";

const ornament = (id: string, x = 0.5, y = 0.5): TreeDecoration => ({
  id,
  kind: "bauble-red",
  x,
  y,
});

describe("tree design state", () => {
  it("adds and removes a freehand stroke without mutating earlier state", () => {
    const stroke: TreeStroke = {
      id: "ink-1",
      color: "berry",
      width: 8,
      points: [{ x: 0.2, y: 0.3 }, { x: 0.4, y: 0.5 }],
    };
    const drawn = addStroke(DEFAULT_TREE_DESIGN, stroke);

    expect(drawn.strokes).toEqual([stroke]);
    expect(DEFAULT_TREE_DESIGN.strokes).toEqual([]);
    expect(removeStroke(drawn, stroke.id).strokes).toEqual([]);
  });

  it("round-trips a custom tree drawing and ornaments through a share fragment", () => {
    const design: TreeDesign = {
      version: 2,
      treeMode: "custom",
      decorations: [ornament("bauble", 0.4, 0.5)],
      strokes: [{
        id: "ink-1",
        color: "snow",
        width: 8,
        points: [{ x: 0.18, y: 0.2 }, { x: 0.51, y: 0.55 }, { x: 0.82, y: 0.2 }],
      }],
    };

    const fragment = encodeTreeFragment(design);

    expect(fragment.length).toBeLessThan(4096);
    expect(decodeTreeFragment(fragment)).toEqual({ design, valid: true });
  });

  it("round-trips the maximum-length stroke through a share fragment", () => {
    const points = Array.from({ length: MAX_POINTS_PER_STROKE }, (_, index) => ({
      x: Math.round((index / (MAX_POINTS_PER_STROKE - 1)) * 1000) / 1000,
      y: Math.round(((index % 9) / 8) * 1000) / 1000,
    }));
    const design: TreeDesign = {
      ...DEFAULT_TREE_DESIGN,
      treeMode: "custom",
      strokes: [{ id: "long-stroke", color: "ice", width: 12, points }],
    };
    const fragment = encodeTreeFragment(design);

    expect(decodeTreeFragment(fragment)).toEqual({ design, valid: true });
  });

  it("restores legacy version 1 links as classic trees", () => {
    const legacyBase64 = btoa(JSON.stringify({
      v: 1,
      d: [["legacy-star", "s", 500, 300]],
    })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    const legacy = `#tree=${legacyBase64}`;

    expect(decodeTreeFragment(legacy)).toEqual({
      design: {
        version: 2,
        treeMode: "classic",
        decorations: [{ id: "legacy-star", kind: "star", x: 0.5, y: 0.3 }],
        strokes: [],
      },
      valid: true,
    });
  });

  it("rejects an unsupported number of freehand strokes", () => {
    const strokes = Array.from({ length: MAX_DRAWING_STROKES + 1 }, (_, index) => ({
      id: `ink-${index}`,
      color: "snow",
      width: 7,
      points: [{ x: 0.2, y: 0.3 }, { x: 0.4, y: 0.5 }],
    }));

    expect(decodeTreeFragment(`#tree=${btoa(JSON.stringify({ v: 2, m: "c", d: [], s: strokes }))}`))
      .toEqual({ design: DEFAULT_TREE_DESIGN, valid: false });
  });

  it("adds, moves, and removes an ornament without mutating earlier state", () => {
    const placed = addDecoration(DEFAULT_TREE_DESIGN, ornament("one", 0.3, 0.4));
    expect(placed.decorations).toEqual([ornament("one", 0.3, 0.4)]);

    const moved = moveDecoration(placed, "one", 0.8, 0.7);
    expect(moved.decorations).toEqual([ornament("one", 0.8, 0.7)]);
    expect(placed.decorations).toEqual([ornament("one", 0.3, 0.4)]);

    expect(removeDecoration(moved, "one").decorations).toEqual([]);
  });

  it("limits designs to 48 decorations", () => {
    const full: TreeDesign = {
      ...DEFAULT_TREE_DESIGN,
      decorations: Array.from({ length: MAX_DECORATIONS }, (_, index) => ornament(String(index))),
    };

    expect(addDecoration(full, ornament("overflow"))).toBe(full);
  });

  it("round-trips a tree through a versioned URL fragment", () => {
    const design: TreeDesign = {
      ...DEFAULT_TREE_DESIGN,
      decorations: [ornament("a", 0.2, 0.4), ornament("b", 0.7, 0.8)],
    };
    const fragment = encodeTreeFragment(design);

    expect(fragment.startsWith("#tree=")).toBe(true);
    expect(decodeTreeFragment(fragment)).toEqual({ design, valid: true });
  });

  it("keeps a full 48-decoration tree shareable", () => {
    const design: TreeDesign = {
      ...DEFAULT_TREE_DESIGN,
      decorations: Array.from({ length: MAX_DECORATIONS }, (_, index) =>
        ornament(index.toString(36).padStart(16, "a"), index / MAX_DECORATIONS, index / MAX_DECORATIONS),
      ),
    };

    const fragment = encodeTreeFragment(design);
    expect(fragment.length).toBeLessThan(4096);
    expect(decodeTreeFragment(fragment).valid).toBe(true);
  });

  it.each([
    "#tree=not-base64!",
    `#tree=${btoa(JSON.stringify({ v: 9, d: [] }))}`,
    `#tree=${btoa(JSON.stringify({ v: 1, d: Array.from({ length: 49 }, (_, i) => [String(i), "r", 500, 500]) }))}`,
    `#tree=${btoa(JSON.stringify({ v: 1, d: [["bad", "r", 3000, 500]] }))}`,
  ])("recovers to a clean tree for invalid shared data: %s", (fragment) => {
    expect(decodeTreeFragment(fragment)).toEqual({ design: DEFAULT_TREE_DESIGN, valid: false });
  });

  it("does not treat an unrelated fragment as a shared tree", () => {
    expect(decodeTreeFragment("#section-about")).toEqual({ design: DEFAULT_TREE_DESIGN, valid: true });
  });
});
