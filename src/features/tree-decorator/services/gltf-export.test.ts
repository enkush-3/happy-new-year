import { afterEach, describe, expect, it, vi } from "vitest";
import type { Object3D } from "three";
import { downloadTreeGlb, treeModelCredits } from "./gltf-export";

const exporterHarness = vi.hoisted(() => ({ scene: null as any, options: null as any, result: new ArrayBuffer(8) }));

vi.mock("three/addons/exporters/GLTFExporter.js", () => ({
  GLTFExporter: class {
    async parseAsync(scene: unknown, options: unknown) {
      exporterHarness.scene = scene;
      exporterHarness.options = options;
      return exporterHarness.result;
    }
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  exporterHarness.scene = null;
  exporterHarness.options = null;
});

describe("3D tree export", () => {
  it("downloads one binary GLB with source credits in glTF extras", async () => {
    const root = {
      name: "runtime tree",
      userData: { localOnly: true },
      clone: vi.fn(() => ({ name: "clone", userData: { localOnly: true } })),
    } as unknown as Object3D;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("happy-new-year-tree.glb");
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:tree-glb");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(window, "setTimeout").mockImplementation((callback) => { if (typeof callback === "function") callback(); return 1 as unknown as ReturnType<typeof window.setTimeout>; });

    await downloadTreeGlb(root);

    expect(root.clone).toHaveBeenCalledWith(true);
    expect(root.userData).toEqual({ localOnly: true });
    expect(exporterHarness.options).toEqual({ binary: true });
    expect(exporterHarness.scene.userData.credits).toEqual(treeModelCredits);
    expect(exporterHarness.scene.userData.attribution).toContain("RoboHoloclone12");
    expect(exporterHarness.scene.userData.attribution).toContain("https://sketchfab.com/3d-models/christmas-tree-");
    expect(exporterHarness.scene.userData.attribution).toContain("https://creativecommons.org/licenses/by/4.0/");
    expect(exporterHarness.scene.userData.attribution).toContain("polygon-reduced");
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:tree-glb");
  });

  it("reports a missing model and a non-binary exporter result", async () => {
    await expect(downloadTreeGlb(null)).rejects.toThrow("3D гацуурын загвар олдсонгүй");
    exporterHarness.result = "not-binary" as unknown as ArrayBuffer;
    const root = { clone: () => ({ userData: {} }) } as unknown as Object3D;
    await expect(downloadTreeGlb(root)).rejects.toThrow("GLB файл үүсгэж чадсангүй");
    exporterHarness.result = new ArrayBuffer(8);
  });
});
