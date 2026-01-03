#!/usr/bin/env node

import path from "path";
import { NodeIO } from "@gltf-transform/core";
import { getBounds } from "@gltf-transform/functions";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";

const main = async () => {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error(
      "Usage: pnpm exec tsx tools/resize-glb.ts <input.glb> [output.glb]"
    );
    process.exit(1);
  }

  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(
    outputPath ?? absoluteInput.replace(/\.glb$/i, "-1m.glb")
  );

  const io = new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]);
  const document = await io.read(absoluteInput);
  const scene = document.getRoot().listScenes()[0];
  if (!scene) {
    console.error("No scene found in the GLB.");
    process.exit(1);
  }

  const bounds = getBounds(scene);
  const size = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const radius = Math.max(...size) * 0.5;

  if (radius <= 0) {
    console.error("Invalid mesh bounds; radius is zero.");
    process.exit(1);
  }

  const scaleFactor = 0.5 / radius;
  for (const node of scene.listChildren()) {
    const current = node.getScale();
    node.setScale([
      current[0] * scaleFactor,
      current[1] * scaleFactor,
      current[2] * scaleFactor,
    ]);
  }
  await io.write(absoluteOutput, document);

  console.log(`Wrote resized GLB to ${absoluteOutput}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
