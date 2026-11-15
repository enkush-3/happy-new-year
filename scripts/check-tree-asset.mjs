import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelPath = path.resolve(process.argv[2] ?? path.join(projectRoot, "public/assets/tree/christmas-tree.glb"));
const maxTriangles = 180_000;
const maxBytes = 10 * 1024 * 1024;

const binary = await readFile(modelPath);
if (binary.toString("ascii", 0, 4) !== "glTF" || binary.readUInt32LE(4) !== 2) {
  throw new Error(`Not a glTF 2.0 binary: ${modelPath}`);
}
const jsonLength = binary.readUInt32LE(12);
const document = JSON.parse(binary.toString("utf8", 20, 20 + jsonLength));
const meshInstances = new Map();
for (const node of document.nodes ?? []) {
  if (typeof node.mesh === "number") meshInstances.set(node.mesh, (meshInstances.get(node.mesh) ?? 0) + 1);
}
const triangles = (document.meshes ?? []).reduce((total, mesh, meshIndex) => {
  const instances = meshInstances.get(meshIndex) ?? 0;
  const meshTriangles = mesh.primitives.reduce((primitiveTotal, primitive) => {
    const indexCount = typeof primitive.indices === "number"
      ? document.accessors[primitive.indices]?.count ?? 0
      : document.accessors[primitive.attributes.POSITION]?.count ?? 0;
    return primitiveTotal + Math.floor(indexCount / 3);
  }, 0);
  return total + meshTriangles * instances;
}, 0);
const { size } = await stat(modelPath);

if (!triangles || triangles > maxTriangles) throw new Error(`Tree triangle budget failed: ${triangles.toLocaleString()} / ${maxTriangles.toLocaleString()}`);
if (size > maxBytes) throw new Error(`Tree file budget failed: ${size.toLocaleString()} / ${maxBytes.toLocaleString()} bytes`);
console.log(`Tree asset OK: ${triangles.toLocaleString()} triangles, ${(size / 1_048_576).toFixed(2)} MB`);
