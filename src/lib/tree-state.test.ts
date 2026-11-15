import { describe, expect, it } from "vitest";
import {
  addDecoration,
  decodeTreeFragment,
  DEFAULT_TREE_DESIGN,
  encodeTreeFragment,
  MAX_DECORATIONS,
  moveDecoration,
  removeDecoration,
  type TreeDecoration,
  type TreeDesign,
} from "./tree-state";

const ornament = (id: string, x = 0.5, y = 0.5): TreeDecoration => ({
  id,
  kind: "bauble-red",
  x,
  y,
});

describe("tree design state", () => {
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
      version: 1,
      decorations: Array.from({ length: MAX_DECORATIONS }, (_, index) => ornament(String(index))),
    };

    expect(addDecoration(full, ornament("overflow"))).toBe(full);
  });

  it("round-trips a tree through a versioned URL fragment", () => {
    const design: TreeDesign = { version: 1, decorations: [ornament("a", 0.2, 0.4), ornament("b", 0.7, 0.8)] };
    const fragment = encodeTreeFragment(design);

    expect(fragment.startsWith("#tree=")).toBe(true);
    expect(decodeTreeFragment(fragment)).toEqual({ design, valid: true });
  });

  it("keeps a full 48-decoration tree shareable", () => {
    const design: TreeDesign = {
      version: 1,
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
    `#tree=${btoa(JSON.stringify({ version: 9, decorations: [] }))}`,
    `#tree=${btoa(JSON.stringify({ version: 1, decorations: Array.from({ length: 49 }, (_, i) => ornament(String(i))) }))}`,
    `#tree=${btoa(JSON.stringify({ version: 1, decorations: [{ ...ornament("bad"), x: 3 }] }))}`,
  ])("recovers to a clean tree for invalid shared data: %s", (fragment) => {
    expect(decodeTreeFragment(fragment)).toEqual({ design: DEFAULT_TREE_DESIGN, valid: false });
  });

  it("does not treat an unrelated fragment as a shared tree", () => {
    expect(decodeTreeFragment("#section-about")).toEqual({ design: DEFAULT_TREE_DESIGN, valid: true });
  });
});
