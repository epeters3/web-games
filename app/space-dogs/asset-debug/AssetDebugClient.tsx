"use client";

import { useEffect, useRef } from "react";
import {
  ArcRotateCamera,
  AbstractMesh,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { useSearchParams } from "next/navigation";
import { boundsToCollision, getBoundsFromMeshes, refreshMeshBounds } from "../engine/bounds";
import "@babylonjs/loaders";

const GRID_HALF_SIZE = 50;
const GRID_STEP = 1;
const GRID_MAJOR_STEP = 5;

/**
 * Builds a 1-unit grid with major ticks to serve as a visual ruler for scale
 * checks while inspecting assets.
 */
const createRulerGrid = (scene: Scene) => {
  const minorLines: Vector3[][] = [];
  const majorLines: Vector3[][] = [];

  for (let i = -GRID_HALF_SIZE; i <= GRID_HALF_SIZE; i += GRID_STEP) {
    const line = [
      new Vector3(i, 0, -GRID_HALF_SIZE),
      new Vector3(i, 0, GRID_HALF_SIZE),
    ];
    if (i % GRID_MAJOR_STEP === 0) {
      majorLines.push(line);
    } else {
      minorLines.push(line);
    }
  }

  for (let i = -GRID_HALF_SIZE; i <= GRID_HALF_SIZE; i += GRID_STEP) {
    const line = [
      new Vector3(-GRID_HALF_SIZE, 0, i),
      new Vector3(GRID_HALF_SIZE, 0, i),
    ];
    if (i % GRID_MAJOR_STEP === 0) {
      majorLines.push(line);
    } else {
      minorLines.push(line);
    }
  }

  const minor = MeshBuilder.CreateLineSystem(
    "ruler-grid-minor",
    { lines: minorLines },
    scene
  );
  minor.color = new Color3(0.12, 0.18, 0.28);

  const major = MeshBuilder.CreateLineSystem(
    "ruler-grid-major",
    { lines: majorLines },
    scene
  );
  major.color = new Color3(0.28, 0.45, 0.65);
};

/**
 * Draws a wireframe box for the combined bounds of the loaded meshes so
 * collision extents can be inspected at a glance.
 */
const createCollisionBox = (scene: Scene, meshes: AbstractMesh[]) => {
  if (meshes.length === 0) return;
  refreshMeshBounds(meshes);
  const bounds = getBoundsFromMeshes(meshes);
  const collision = boundsToCollision(bounds);
  if (collision.radius <= 0) return;

  const box = MeshBuilder.CreateBox(
    "collision-box",
    {
      width: collision.radii.x * 2,
      height: collision.radii.y * 2,
      depth: collision.radii.z * 2,
    },
    scene
  );
  box.position.copyFrom(collision.center);
  const mat = new StandardMaterial("collision-box-mat", scene);
  mat.emissiveColor = new Color3(0.2, 0.85, 1);
  mat.alpha = 0.4;
  mat.wireframe = true;
  mat.disableLighting = true;
  box.material = mat;
  box.isPickable = false;
};

export const AssetDebugClient = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const searchParams = useSearchParams();
  const assetName =
    searchParams.get("asset") ?? "large_asteroid_small_moon_1k.glb";
  const scaleRaw = searchParams.get("scale");
  const scale = Number.isFinite(Number(scaleRaw)) ? Number(scaleRaw) : 1;
  const rotXRaw = searchParams.get("rotX");
  const rotYRaw = searchParams.get("rotY");
  const rotZRaw = searchParams.get("rotZ");
  const rotX = Number.isFinite(Number(rotXRaw)) ? Number(rotXRaw) : 0;
  const rotY = Number.isFinite(Number(rotYRaw)) ? Number(rotYRaw) : 0;
  const rotZ = Number.isFinite(Number(rotZRaw)) ? Number(rotZRaw) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.04, 0.08, 1);

    const camera = new ArcRotateCamera(
      "asset-camera",
      Math.PI / 4,
      Math.PI / 3,
      12,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 60;
    camera.minZ = 0.1;

    const hemi = new HemisphericLight(
      "hemi",
      new Vector3(0, 1, 0),
      scene
    );
    hemi.intensity = 0.35;

    const dir = new DirectionalLight(
      "dir",
      new Vector3(-0.4, -0.9, -0.3),
      scene
    );
    dir.intensity = 1.2;
    dir.position = new Vector3(12, 18, 12);

    createRulerGrid(scene);

    const assetRoot = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
      /\/$/,
      ""
    );
    const assetPath = assetRoot ? `${assetRoot}/` : "/";

    let disposed = false;

    const loadAsset = async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          "",
          assetPath,
          assetName,
          scene
        );
        if (disposed) return;
        const root =
          result.meshes.find((mesh) => mesh.parent === null) ??
          result.meshes[0];
        if (root) {
          root.scaling = new Vector3(scale, scale, scale);
          root.rotationQuaternion = Quaternion.Identity();
          root.rotation = new Vector3(
            (rotX * Math.PI) / 180,
            (rotY * Math.PI) / 180,
            (rotZ * Math.PI) / 180
          );
        }

        const meshes = result.meshes.filter(
          (mesh): mesh is Mesh =>
            mesh instanceof Mesh && mesh.getTotalVertices() > 0
        );

        refreshMeshBounds(meshes);
        const initialBounds = getBoundsFromMeshes(meshes);
        const initialCollision = boundsToCollision(initialBounds);

        if (root && initialCollision.radius > 0) {
          root.position.subtractInPlace(initialCollision.center);
          refreshMeshBounds(meshes);
        }

        const bounds = getBoundsFromMeshes(meshes);
        const collision = boundsToCollision(bounds);

        camera.target.copyFrom(collision.center);
        camera.radius = Math.max(collision.radius * 2.4, 4);

        createCollisionBox(scene, meshes);
      } catch (error) {
        console.error("Failed to load asset", error);
      }
    };

    void loadAsset();

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    engine.runRenderLoop(() => scene.render());

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      scene.dispose();
      engine.dispose();
    };
  }, [assetName, scale, rotX, rotY, rotZ]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};
