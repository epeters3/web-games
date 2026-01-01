"use client";

import { useEffect, useRef } from "react";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders";

export default function BabylonScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.04, 0.05, 0.09);

    const camera = new ArcRotateCamera(
      "camera",
      Math.PI / 2,
      Math.PI / 3,
      6,
      new Vector3(0, 1, 0),
      scene
    );
    camera.attachControl(canvasRef.current, true);

    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.9;

    const sphere = MeshBuilder.CreateSphere(
      "sphere",
      { diameter: 1.6, segments: 32 },
      scene
    );
    sphere.position.y = 1.2;

    const material = new StandardMaterial("glow", scene);
    material.diffuseColor = new Color3(0.95, 0.39, 0.62);
    material.emissiveColor = new Color3(0.35, 0.1, 0.25);
    sphere.material = material;

    MeshBuilder.CreateGround("ground", { width: 8, height: 8 }, scene);

    engine.runRenderLoop(() => {
      scene.render();
    });

    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="babylon-canvas" />;
}
