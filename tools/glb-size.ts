#!/usr/bin/env node

import { readFile } from "fs/promises";
import path from "path";
import { NullEngine, Scene, SceneLoader, Vector3 } from "@babylonjs/core";
import "@babylonjs/loaders";

const main = async () => {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: node tools/glb-size.ts <path/to/model.glb>");
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  const buffer = await readFile(absolutePath);
  const dataUrl = `data:model/gltf-binary;base64,${buffer.toString("base64")}`;

  const engine = new NullEngine();
  const scene = new Scene(engine);

  const result = await SceneLoader.ImportMeshAsync("", "", dataUrl, scene);
  const meshes = result.meshes.filter((mesh) => mesh.getTotalVertices() > 0);

  if (meshes.length === 0) {
    console.error("No renderable meshes found in the GLB.");
    process.exit(1);
  }

  let min = new Vector3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY
  );
  let max = new Vector3(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  );

  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bounds.minimumWorld);
    max = Vector3.Maximize(max, bounds.maximumWorld);
  }

  const size = max.subtract(min);
  const diameter = Math.max(size.x, size.y, size.z);

  const format = (value: number) => Number(value.toFixed(4));

  console.log(
    JSON.stringify(
      {
        file: absolutePath,
        min: { x: format(min.x), y: format(min.y), z: format(min.z) },
        max: { x: format(max.x), y: format(max.y), z: format(max.z) },
        size: { x: format(size.x), y: format(size.y), z: format(size.z) },
        diameter: format(diameter),
      },
      null,
      2
    )
  );
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
