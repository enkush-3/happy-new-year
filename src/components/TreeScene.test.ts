import { describe, expect, it, vi } from "vitest";
import { treeCanvasPointFromClient, treePointFromClient } from "./TreeScene";

describe("tree pointer coordinates", () => {
  it("ignores SVG letterboxing when mapping a pointer into the tree viewBox", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 100, y: 50, left: 100, top: 50, right: 700, bottom: 610, width: 600, height: 560,
      toJSON: () => ({}),
    } as DOMRect);

    expect(treePointFromClient(svg, 350, 330)).toEqual({ x: 0.375, y: 0.5 });
  });

  it("allows the custom canvas to use space outside the preset tree silhouette", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 100, y: 50, left: 100, top: 50, right: 700, bottom: 610, width: 600, height: 560,
      toJSON: () => ({}),
    } as DOMRect);

    expect(treeCanvasPointFromClient(svg, 350, 330)).toEqual({ x: 0.375, y: 0.5 });
    expect(treeCanvasPointFromClient(svg, 100, 330).x).toBe(0.015);
  });
});
