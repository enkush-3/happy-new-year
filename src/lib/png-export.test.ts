import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTreePng, serializeTreeSvg } from "./png-export";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("tree image export", () => {
  it("serializes a standalone, high-resolution SVG with a dark background", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 560");
    const tree = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tree.setAttribute("d", "M200 0 400 560H0z");
    svg.append(tree);

    const blob = serializeTreeSvg(svg);
    const content = await blob.text();

    expect(blob.type).toContain("image/svg+xml");
    expect(content).toContain('width="1200"');
    expect(content).toContain('height="1680"');
    expect(content).toContain("#10192d");
    expect(content).toContain("M200 0 400 560H0z");
  });

  it("rasterizes the SVG and starts a PNG download", async () => {
    const drawImage = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("happy-new-year-tree.png");
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["png"], { type: "image/png" }));
    });

    let sourceId = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:test-${++sourceId}`);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(window, "setTimeout").mockImplementation((callback) => {
      if (typeof callback === "function") callback();
      return 1;
    });
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    });

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 560");

    await downloadTreePng(svg);

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
});
