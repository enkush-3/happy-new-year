import { describe, expect, it } from "vitest";
import {
  addDecoration,
  decodeTreeFragment,
  DEFAULT_TREE_DESIGN,
  duplicateDecoration,
  encodeTreeFragment,
  MAX_DECORATIONS,
  moveDecoration,
  removeDecoration,
  setSlotDecoration,
  transformDecoration,
  TREE_SLOTS,
  type TreeDecoration,
  type TreeDesign,
} from "./tree-state";

const ornament = (id: string, x = 0.5, y = 0.5): TreeDecoration => ({
  id,
  kind: "bauble-red",
  x,
  y,
  angle: Math.round((0.5 + (x - 0.5) * 0.8) * 1000) / 1000,
  radius: 0.5,
  rotation: 0,
  scale: 1,
  color: "#d96b5e",
});

describe("tree design state", () => {
  it("exposes 29 fixed nodes with a star-only topper and short slot-based shares", () => {
    expect(TREE_SLOTS).toHaveLength(29);
    expect(TREE_SLOTS.filter((slot) => slot.tier !== "topper").map((slot) => slot.tier)).toEqual([
      ...Array.from({ length: 4 }, () => "upper"),
      ...Array.from({ length: 6 }, () => "mid-upper"),
      ...Array.from({ length: 8 }, () => "mid-lower"),
      ...Array.from({ length: 10 }, () => "bottom"),
    ]);
    expect(setSlotDecoration(DEFAULT_TREE_DESIGN, "slot-1", "star")).toBe(DEFAULT_TREE_DESIGN);

    const placed = setSlotDecoration(DEFAULT_TREE_DESIGN, "slot-1", "bauble-red");
    const fragment = encodeTreeFragment(placed);
    const restored = decodeTreeFragment(fragment);

    expect(fragment.length).toBeLessThan(180);
    expect(restored.valid).toBe(true);
    expect(restored.design.decorations[0]).toMatchObject({ slotId: "slot-1", kind: "bauble-red" });
  });

  it("round-trips advanced ornament styling alongside fixed slot ids", () => {
    const placed = setSlotDecoration(DEFAULT_TREE_DESIGN, "slot-0", "star");
    const styled = transformDecoration(placed, "decor-slot-0", { scale: 1.3, rotation: 30, color: "#98d8f2" });
    const restored = decodeTreeFragment(encodeTreeFragment(styled));

    expect(restored.valid).toBe(true);
    expect(restored.design.decorations[0]).toMatchObject({ slotId: "slot-0", scale: 1.3, rotation: 30, color: "#98d8f2" });
  });

  it("stores configurable twinkling strand settings in the current share version", () => {
    const design = {
      ...DEFAULT_TREE_DESIGN,
      lights: { enabled: true, color: "#98d8f2", brightness: 0.65, twinkle: false },
    } as TreeDesign;

    const restored = decodeTreeFragment(encodeTreeFragment(design));

    expect(restored.valid).toBe(true);
    expect(restored.design.version).toBe(4);
    expect(restored.design.lights).toEqual({ enabled: true, color: "#98d8f2", brightness: 0.65, twinkle: false });
  });

  it("keeps ornaments from old hand-drawn links and reports discarded strokes", () => {
    const legacyBase64 = btoa(JSON.stringify({
      v: 3,
      m: "c",
      d: [["old-star", "s", 500, 300, 500, 0, 100, "s"]],
      s: [["old-ink", "w", 1, "AAEAAQ"]],
    })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");

    const restored = decodeTreeFragment(`#tree=${legacyBase64}`);

    expect(restored.valid).toBe(true);
    expect(restored.discardedLegacyDrawing).toBe(true);
    expect(restored.design.version).toBe(4);
    expect(restored.design.decorations).toHaveLength(1);
  });

  it("round-trips 3D ornament edits through the next share format", () => {
    const editedDecoration = {
      ...ornament("edited-star", 0.55, 0.3),
      angle: 0.63,
      rotation: 42,
      scale: 1.4,
      color: "#98d8f2",
    } as unknown as TreeDecoration;
    const design = { ...DEFAULT_TREE_DESIGN, decorations: [editedDecoration] };
    const restored = decodeTreeFragment(encodeTreeFragment(design));

    expect(restored.valid).toBe(true);
    expect(restored.design.decorations[0]).toMatchObject({
      angle: 0.63,
      rotation: 42,
      scale: 1.4,
      color: "#98d8f2",
    });
  });

  it("updates and duplicates an ornament with bounded editor controls", () => {
    const design = { ...DEFAULT_TREE_DESIGN, decorations: [ornament("star", 0.5, 0.32)] };
    const transformed = transformDecoration(design, "star", { rotation: 35, scale: 1.4, color: "#98d8f2" });
    const duplicated = duplicateDecoration(transformed, "star", "star-copy");

    expect(transformed.decorations[0]).toMatchObject({ rotation: 35, scale: 1.4, color: "#98d8f2" });
    expect(duplicated.decorations).toHaveLength(2);
    expect(duplicated.decorations[1].id).toBe("star-copy");
    expect(duplicated.decorations[1].x).not.toBe(duplicated.decorations[0].x);
  });

  it("restores legacy version 1 links as classic trees", () => {
    const legacyBase64 = btoa(JSON.stringify({
      v: 1,
      d: [["legacy-star", "s", 500, 300]],
    })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    const legacy = `#tree=${legacyBase64}`;

    expect(decodeTreeFragment(legacy)).toEqual({
      design: {
        version: 4,
        lights: DEFAULT_TREE_DESIGN.lights,
        decorations: [{
          id: "legacy-star", kind: "star", x: 0.5, y: 0.3,
          angle: 0.5, radius: expect.any(Number), rotation: 0, scale: 1, color: "#ffd978",
        }],
      },
      valid: true,
    });
  });

  it("migrates previous v2 links into the 3D editor model", () => {
    const legacyBase64 = btoa(JSON.stringify({
      v: 2,
      m: "p",
      d: [["old-bauble", "r", 600, 400]],
      s: [],
    })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    const restored = decodeTreeFragment(`#tree=${legacyBase64}`);

    expect(restored.valid).toBe(true);
    expect(restored.design.version).toBe(4);
    expect(restored.design.decorations[0]).toMatchObject({
      id: "old-bauble", kind: "bauble-red", x: 0.6, y: 0.4,
      angle: 0.58, radius: expect.any(Number), rotation: 0, scale: 1, color: "#d96b5e",
    });
  });

  it.each([
    [1, { v: 1, d: [["crafted", "constructor", 500, 300]] }],
    [1, { v: 1, d: [["crafted", "toString", 500, 300]] }],
    [2, { v: 2, m: "p", d: [["crafted", "constructor", 500, 300]], s: [] }],
    [2, { v: 2, m: "p", d: [["crafted", "toString", 500, 300]], s: [] }],
    [3, { v: 3, m: "p", d: [["crafted", "constructor", 500, 300, 500, 0, 100, "r"]], s: [] }],
    [3, { v: 3, m: "p", d: [["crafted", "r", 500, 300, 500, 0, 100, "constructor"]], s: [] }],
    [3, { v: 3, m: "p", d: [["crafted", "r", 500, 300, 500, 0, 100, "toString"]], s: [] }],
    [2, { v: 2, m: "c", d: [], s: [["ink", "constructor", 1, "AAEAAQ"]] }],
    [2, { v: 2, m: "c", d: [], s: [["ink", "toString", 1, "AAEAAQ"]] }],
  ] as const)("rejects inherited lookup codes from crafted v%s share data", (_version, payload) => {
    const encoded = btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");

    expect(decodeTreeFragment(`#tree=${encoded}`)).toEqual({ design: DEFAULT_TREE_DESIGN, valid: false });
  });

  it("rejects an unsupported number of freehand strokes", () => {
    const strokes = Array.from({ length: 17 }, (_, index) => ({
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
