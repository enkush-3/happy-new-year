import { afterEach, describe, expect, it, vi } from "vitest";
import type { Object3D } from "three";
import { Group } from "three";
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

  it("keeps ornament rotations in the GLB scene and removes editor-only visuals", async () => {
    const root = new Group();
    const ornament = new Group();
    ornament.name = "Selected bauble";
    ornament.rotation.set(Math.PI / 6, -Math.PI / 4, 0.2, "YXZ");
    ornament.userData.decoration = { rotX: 30, rotY: -45, rotation: 11 };
    root.add(ornament);
    const marker = new Group();
    marker.name = "Empty slot marker";
    marker.userData.emptySlotMarker = true;
    root.add(marker);
    const halo = new Group();
    halo.name = "Selected ornament soft glow";
    halo.userData.editorOnly = true;
    root.add(halo);

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:tree-glb");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(window, "setTimeout").mockImplementation((callback) => { if (typeof callback === "function") callback(); return 1 as unknown as ReturnType<typeof window.setTimeout>; });

    await downloadTreeGlb(root);

    const exportedOrnament = exporterHarness.scene.getObjectByName("Selected bauble");
    expect(exportedOrnament.rotation.x).toBeCloseTo(Math.PI / 6);
    expect(exportedOrnament.rotation.y).toBeCloseTo(-Math.PI / 4);
    expect(exportedOrnament.userData.decoration).toEqual({ rotX: 30, rotY: -45, rotation: 11 });
    expect(exporterHarness.scene.getObjectByName("Empty slot marker")).toBeUndefined();
    expect(exporterHarness.scene.getObjectByName("Selected ornament soft glow")).toBeUndefined();
  });
});
