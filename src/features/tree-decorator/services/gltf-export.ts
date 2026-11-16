import type { Object3D } from "three";

export const treeModelCredits = [
  {
    title: "Christmas Tree",
    author: "RoboHoloclone12",
    source: "https://sketchfab.com/3d-models/christmas-tree-742b8a73f28c4749a51d756332809375",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    changes: "Converted from FBX to glTF and polygon-reduced for interactive web use.",
  },
];

export async function downloadTreeGlb(root: Object3D | null): Promise<void> {
  if (!root) throw new Error("3D гацуурын загвар олдсонгүй.");

  const exportRoot = root.clone(true);
  exportRoot.name = "Happy New Year Tree";
  const editorMarkers: Object3D[] = [];
  if (typeof exportRoot.traverse === "function") {
    exportRoot.traverse((object) => {
      if (object.userData.emptySlotMarker === true || object.userData.editorOnly === true) editorMarkers.push(object);
    });
  }
  editorMarkers.forEach((object) => object.parent?.remove(object));
  exportRoot.userData = {
    ...exportRoot.userData,
    title: "Happy New Year 3D Tree",
    credits: treeModelCredits,
    attribution: treeModelCredits.map(({ title, author, source, license, licenseUrl, changes }) =>
      `${title} by ${author}; source: ${source}; licensed under ${license} (${licenseUrl}); changes: ${changes}`,
    ).join("; "),
  };

  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(exportRoot, { binary: true });
  if (!(result instanceof ArrayBuffer)) throw new Error("GLB файл үүсгэж чадсангүй.");

  const url = URL.createObjectURL(new Blob([result], { type: "model/gltf-binary" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "happy-new-year-tree.glb";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
