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
    const selection = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    selection.setAttribute("class", "tree-decoration-selection");
    const hint = document.createElementNS("http://www.w3.org/2000/svg", "text");
    hint.setAttribute("class", "draw-empty-hint");
    hint.textContent = "Модоо энд зураарай";
    svg.append(tree, selection, hint);

    const blob = serializeTreeSvg(svg);
    const content = await blob.text();

    expect(blob.type).toContain("image/svg+xml");
    expect(content).toContain('width="1200"');
    expect(content).toContain('height="1680"');
    expect(content).toContain("#10192d");
    expect(content).toContain("M200 0 400 560H0z");
    expect(content).not.toContain("tree-decoration-selection");
    expect(content).not.toContain("draw-empty-hint");
    expect(content).not.toContain("Модоо энд зураарай");
  });

  it("rasterizes the SVG and starts a PNG download", async () => {
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("happy-new-year-tree.png");
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage, fillRect } as unknown as CanvasRenderingContext2D);
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

  it("contains the current 3D render canvas on a dark PNG background", async () => {
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage, fillRect } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["png"], { type: "image/png" }));
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:tree-render");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(window, "setTimeout").mockImplementation((callback) => {
      if (typeof callback === "function") callback();
      return 1;
    });
    const renderCanvas = document.createElement("canvas");

    await downloadTreePng(renderCanvas);

    expect(fillRect).toHaveBeenCalledWith(0, 0, 1200, 1680);
    expect(drawImage).toHaveBeenCalledWith(renderCanvas, 0, 540, 1200, 600);
  });

  it("contains a wide 3D canvas with dark padding instead of stretching it", async () => {
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage, fillRect } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["png"], { type: "image/png" }));
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:tree-render");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(window, "setTimeout").mockImplementation((callback) => {
      if (typeof callback === "function") callback();
      return 1;
    });
    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = 1600;
    renderCanvas.height = 800;

    await downloadTreePng(renderCanvas);

    expect(fillRect).toHaveBeenCalledWith(0, 0, 1200, 1680);
    expect(drawImage).toHaveBeenCalledWith(renderCanvas, 0, 540, 1200, 600);
  });
});
