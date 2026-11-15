#!/usr/bin/env python3
"""Reduce the supplied Sketchfab FBX to a mobile-ready glTF binary."""

from __future__ import annotations

import argparse
from pathlib import Path

import fast_simplification
import trimesh


TRIANGLE_BUDGET = 180_000
FILE_BUDGET_BYTES = 10 * 1024 * 1024


def simplify_scene(source: Path, destination: Path) -> tuple[int, int]:
    scene = trimesh.load(source, force="scene")
    original_triangles = sum(len(mesh.faces) for mesh in scene.geometry.values())

    for name, mesh in list(scene.geometry.items()):
        face_count = len(mesh.faces)
        if face_count > 100_000:
            target_vertices = 20_000
        elif face_count > 500:
            target_vertices = max(80, int(len(mesh.vertices) * 0.1))
        else:
            continue

        vertices, faces = fast_simplification.simplify(
            mesh.vertices,
            mesh.faces,
            target_count=target_vertices,
        )
        reduced = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        reduced.metadata.update(mesh.metadata)
        material = getattr(mesh.visual, "material", None)
        if material is not None:
            reduced.visual = trimesh.visual.texture.TextureVisuals(material=material)
        scene.geometry[name] = reduced

    triangles = sum(len(mesh.faces) for mesh in scene.geometry.values())
    if triangles > TRIANGLE_BUDGET:
        raise RuntimeError(f"Simplified model exceeds {TRIANGLE_BUDGET:,} triangles: {triangles:,}")

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(scene.export(file_type="glb", include_normals=True))
    size_bytes = destination.stat().st_size
    if size_bytes > FILE_BUDGET_BYTES:
        raise RuntimeError(f"Optimized model exceeds {FILE_BUDGET_BYTES:,} bytes: {size_bytes:,}")
    return original_triangles, triangles


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    original, optimized = simplify_scene(args.source, args.destination)
    print(f"Tree model triangles: {original:,} -> {optimized:,}")
    print(f"Tree model size: {args.destination.stat().st_size / (1024 * 1024):.2f} MB")


if __name__ == "__main__":
    main()
