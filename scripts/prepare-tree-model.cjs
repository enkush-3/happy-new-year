const { execFileSync } = require("node:child_process");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const convertFbx = require("fbx2gltf");

async function main() {
  const root = path.resolve(__dirname, "..");
  const archive = path.join(root, "DataModels", "christmas-tree.zip");
  const work = path.join(root, "DataModels", ".tree-build");
  const sourceDirectory = path.join(work, "source");
  const converted = path.join(work, "christmas-tree-source.glb");
  const optimized = path.join(root, "public", "assets", "tree", "christmas-tree.glb");

  mkdirSync(sourceDirectory, { recursive: true });
  execFileSync("unzip", ["-o", archive, "-d", work], { stdio: "inherit" });
  const fbx = path.join(work, "source", "Christmas Tree.fbx");
  await convertFbx(fbx, converted);
  execFileSync(process.env.PYTHON ?? "python3", [
    path.join(root, "scripts", "optimize_tree_asset.py"),
    converted,
    optimized,
  ], { stdio: "inherit" });
  execFileSync(process.execPath, [path.join(root, "scripts", "check-tree-asset.mjs"), optimized], { stdio: "inherit" });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
