"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  Axis,
  Color3,
  Color4,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Matrix,
  PointLight,
  Quaternion,
  Scene,
  SceneLoader,
  Space,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders";

export default function SpaceDogsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [velocity, setVelocity] = useState(0);

  useEffect(() => {
    const assetRoot = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
      /\/$/,
      ""
    );
    const assetPath = assetRoot ? `${assetRoot}/` : "/";
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.04, 0.08, 1);

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.15;

    const glow = new GlowLayer("glow", scene, {
      blurKernelSize: 64,
    });
    glow.intensity = 0.9;

    const planetPosition = new Vector3(-18, -10, 0);
    let planetCenter = planetPosition.clone();
    let planetRadius = 18;
    let planetMeshes: Mesh[] = [];

    const starLight = new PointLight(
      "starLight",
      planetPosition.clone(),
      scene
    );
    starLight.intensity = 2.6;
    starLight.range = 220;

    const loadPlanet = async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          "",
          assetPath,
          "fire_planet_4k.glb",
          scene
        );
        const root =
          result.meshes.find((mesh) => mesh.parent === null) ??
          result.meshes[0];
        if (root) {
          root.position = planetPosition.clone();
          root.scaling = new Vector3(80, 80, 80);
        }

        planetMeshes = result.meshes.filter(
          (mesh): mesh is Mesh =>
            mesh instanceof Mesh && mesh.getTotalVertices() > 0
        );
        planetMeshes.forEach((mesh) => glow.addIncludedOnlyMesh(mesh));

        if (root) {
          root.computeWorldMatrix(true);
          const bounds = root.getHierarchyBoundingVectors(true);
          planetCenter = bounds.min.add(bounds.max).scale(0.5);
          const extent = bounds.max.subtract(bounds.min);
          planetRadius = Math.max(extent.x, extent.y, extent.z) * 0.5;
          starLight.position.copyFrom(planetCenter);
        }
      } catch (error) {
        console.error("Failed to load fire_planet.glb", error);
      }
    };

    void loadPlanet();

    let enemyRoot: TransformNode | null = null;
    let enemyMeshes: Mesh[] = [];
    const enemyOrbitRadius = 260;
    const enemyOrbitHeight = 22;
    const enemyOrbitRate = 0.000125;

    const loadEnemy = async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          "",
          assetPath,
          "spaceship_ezno_1k.glb",
          scene
        );
        const rootNodes = result.meshes.filter((mesh) => mesh.parent === null);
        const primaryRoot = rootNodes[0] ?? result.meshes[0];
        rootNodes.slice(1).forEach((root) => root.setEnabled(false));

        const enemyContainer = new TransformNode("enemyContainer", scene);
        enemyRoot = enemyContainer;
        enemyRoot.position = planetPosition.add(
          new Vector3(enemyOrbitRadius, enemyOrbitHeight, 0)
        );
        enemyRoot.rotationQuaternion = Quaternion.Identity();
        enemyRoot.scaling = new Vector3(1.6, 1.6, 1.6);

        if (primaryRoot) {
          primaryRoot.parent = enemyRoot;
          const childMeshes = primaryRoot.getChildMeshes(false);
          enemyMeshes = [
            ...childMeshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh),
            ...(primaryRoot instanceof Mesh ? [primaryRoot] : []),
          ];
          enemyMeshes.forEach((mesh) => glow.addIncludedOnlyMesh(mesh));
        }
      } catch (error) {
        console.error("Failed to load spaceship_ezno_1k.glb", error);
      }
    };

    void loadEnemy();

    const playerRadius = 1.1;
    const player = MeshBuilder.CreateBox(
      "player",
      { width: 1.4, height: 0.6, depth: 2.4 },
      scene
    );
    player.position = new Vector3(0, 6, 220);
    player.rotationQuaternion = Quaternion.Identity();
    player.lookAt(planetPosition);
    const playerMat = new StandardMaterial("playerMat", scene);
    playerMat.diffuseColor = new Color3(0.95, 0.4, 0.55);
    player.material = playerMat;

    const camera = new UniversalCamera(
      "camera",
      new Vector3(0, 0.25, -0.8),
      scene
    );
    camera.parent = player;
    camera.rotation = new Vector3(0, 0, 0);

    const wingLeft = MeshBuilder.CreateBox(
      "wingLeft",
      { width: 0.3, height: 0.1, depth: 1 },
      scene
    );
    wingLeft.parent = player;
    wingLeft.position = new Vector3(-0.9, -0.1, 0);

    const wingRight = wingLeft.clone("wingRight");
    if (wingRight) {
      wingRight.parent = player;
      wingRight.position = new Vector3(0.9, -0.1, 0);
    }

    const trail = MeshBuilder.CreateCylinder(
      "trail",
      { diameterTop: 0.2, diameterBottom: 0.5, height: 3, tessellation: 12 },
      scene
    );
    trail.position = new Vector3(0, -0.1, 1.8);
    trail.rotation = new Vector3(Math.PI / 2, 0, 0);
    const trailMat = new StandardMaterial("trailMat", scene);
    trailMat.emissiveColor = new Color3(0.9, 0.5, 0.8);
    trailMat.alpha = 0.5;
    trail.material = trailMat;
    trail.parent = player;

    player.isVisible = false;
    wingLeft.isVisible = false;
    if (wingRight) {
      wingRight.isVisible = false;
    }
    trail.isVisible = false;

    const starSeed = 1800;
    const starBase = MeshBuilder.CreateSphere(
      "star",
      { diameter: 0.14, segments: 6 },
      scene
    );
    starBase.isVisible = true;
    starBase.isPickable = false;
    const starMat = new StandardMaterial("starMat", scene);
    starMat.emissiveColor = new Color3(1, 1, 1);
    starMat.disableLighting = true;
    starBase.material = starMat;

    const matrices = new Float32Array(starSeed * 16);
    for (let i = 0; i < starSeed; i += 1) {
      const radius = 240 + Math.random() * 220;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      const scale = 0.6 + Math.random() * 1.4;
      const matrix = Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.Identity(),
        new Vector3(x, y, z)
      );
      matrix.copyToArray(matrices, i * 16);
    }
    starBase.thinInstanceSetBuffer("matrix", matrices, 16);
    starBase.thinInstanceRefreshBoundingInfo(true);
    starBase.alwaysSelectAsActiveMesh = true;
    starBase.doNotSyncBoundingInfo = false;

    const controlState = {
      throttle: false,
      reverse: false,
      yawLeft: false,
      yawRight: false,
      pitchUp: false,
      pitchDown: false,
      rollLeft: false,
      rollRight: false,
    };
    let fireRequested = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyW") {
        controlState.pitchDown = true;
      }
      if (event.code === "KeyS") {
        controlState.pitchUp = true;
      }
      if (event.code === "KeyR") {
        controlState.reverse = true;
      }
      if (event.code === "Space") {
        event.preventDefault();
        controlState.throttle = true;
      }
      if (event.code === "KeyA") {
        controlState.yawLeft = true;
      }
      if (event.code === "KeyD") {
        controlState.yawRight = true;
      }
      if (event.code === "ArrowLeft") {
        controlState.rollLeft = true;
      }
      if (event.code === "ArrowRight") {
        controlState.rollRight = true;
      }
      if (event.code === "KeyQ") {
        controlState.rollLeft = true;
      }
      if (event.code === "KeyE") {
        controlState.rollRight = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyW") {
        controlState.pitchDown = false;
      }
      if (event.code === "KeyS") {
        controlState.pitchUp = false;
      }
      if (event.code === "KeyR") {
        controlState.reverse = false;
      }
      if (event.code === "Space") {
        controlState.throttle = false;
      }
      if (event.code === "KeyA") {
        controlState.yawLeft = false;
      }
      if (event.code === "KeyD") {
        controlState.yawRight = false;
      }
      if (event.code === "ArrowLeft") {
        controlState.rollLeft = false;
      }
      if (event.code === "ArrowRight") {
        controlState.rollRight = false;
      }
      if (event.code === "KeyQ") {
        controlState.rollLeft = false;
      }
      if (event.code === "KeyE") {
        controlState.rollRight = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    const handlePointerDown = () => {
      fireRequested = true;
    };
    canvas.addEventListener("pointerdown", handlePointerDown);

    const linearVelocity = new Vector3(0, 0, 0);
    const angularVelocity = new Vector3(0, 0, 0);
    const displacement = new Vector3(0, 0, 0);
    const muzzleOffset = new Vector3(0, 0, 1.2);
    const angularAccel = 2.6;
    const thrustAccel = 16;
    const maxSpeed = 36;
    const linearDamping = 0.985;
    const angularDamping = 0.9;
    const laserLifetime = 0.7;
    const laserSpeed = 240;
    const lasers: {
      mesh: ReturnType<typeof MeshBuilder.CreateCylinder>;
      light: PointLight;
      ttl: number;
      direction: Vector3;
    }[] = [];

    const spawnLaser = () => {
      const beam = MeshBuilder.CreateCylinder(
        "laser",
        { diameter: 0.12, height: 4.5, tessellation: 12 },
        scene
      );
      const beamMat = new StandardMaterial("laserMat", scene);
      beamMat.emissiveColor = new Color3(0.3, 1, 0.55);
      beamMat.disableLighting = true;
      beamMat.alpha = 0.95;
      beam.material = beamMat;
      glow.addIncludedOnlyMesh(beam);

      const beamLight = new PointLight("laserLight", Vector3.Zero(), scene);
      beamLight.intensity = 2.2;
      beamLight.range = 10;
      beamLight.diffuse = new Color3(0.2, 1, 0.4);
      beamLight.excludedMeshes = planetMeshes;

      lasers.push({
        mesh: beam,
        light: beamLight,
        ttl: laserLifetime,
        direction: Vector3.Forward(),
      });
    };

    let lastShot = 0;

    let lastHudUpdate = 0;
    engine.runRenderLoop(() => {
      const dt = engine.getDeltaTime() / 1000;
      const yawInput =
        (controlState.yawRight ? 1 : 0) - (controlState.yawLeft ? 1 : 0);
      const pitchInput =
        (controlState.pitchUp ? 1 : 0) - (controlState.pitchDown ? 1 : 0);
      const rollInput =
        (controlState.rollLeft ? 1 : 0) - (controlState.rollRight ? 1 : 0);

      angularVelocity.x += pitchInput * angularAccel * dt;
      angularVelocity.y += yawInput * angularAccel * dt;
      angularVelocity.z += rollInput * angularAccel * dt;

      angularVelocity.scaleInPlace(Math.pow(angularDamping, dt * 60));

      if (Math.abs(angularVelocity.x) > 0.0001) {
        player.rotate(Axis.X, angularVelocity.x * dt, Space.LOCAL);
      }
      if (Math.abs(angularVelocity.y) > 0.0001) {
        player.rotate(Axis.Y, angularVelocity.y * dt, Space.LOCAL);
      }
      if (Math.abs(angularVelocity.z) > 0.0001) {
        player.rotate(Axis.Z, angularVelocity.z * dt, Space.LOCAL);
      }

      const forward = player.getDirection(Vector3.Forward());
      if (controlState.throttle) {
        linearVelocity.addInPlace(forward.scale(thrustAccel * dt));
      }
      if (controlState.reverse) {
        linearVelocity.addInPlace(forward.scale(-thrustAccel * 0.7 * dt));
      }

      linearVelocity.scaleInPlace(Math.pow(linearDamping, dt * 60));
      const speed = linearVelocity.length();
      if (speed > maxSpeed) {
        linearVelocity.scaleInPlace(maxSpeed / speed);
      }

      displacement.copyFrom(linearVelocity).scaleInPlace(dt);
      const nextPosition = player.position.add(displacement);
      const planetToShip = nextPosition.subtract(planetCenter);
      const minDistance = planetRadius + playerRadius;
      if (planetToShip.length() < minDistance) {
        planetToShip.normalize();
        player.position = planetCenter.add(planetToShip.scale(minDistance));
        linearVelocity.scaleInPlace(0.2);
      } else {
        player.position = nextPosition;
      }

      const now = performance.now();
      if (fireRequested && now - lastShot > 180) {
        const muzzle = player.position.add(player.getDirection(muzzleOffset));
        spawnLaser();
        const active = lasers[lasers.length - 1];
        const direction = player.getDirection(Vector3.Forward()).normalize();
        active.direction = direction;
        active.mesh.position = muzzle.add(direction.scale(3));
        const shipRotation =
          player.rotationQuaternion?.clone() ?? Quaternion.Identity();
        const cylinderAlign = Quaternion.FromEulerAngles(Math.PI / 2, 0, 0);
        active.mesh.rotationQuaternion = shipRotation.multiply(cylinderAlign);
        active.light.position = active.mesh.position;
        lastShot = now;
        fireRequested = false;
      }

      for (let i = lasers.length - 1; i >= 0; i -= 1) {
        const laser = lasers[i];
        laser.mesh.position.addInPlace(laser.direction.scale(laserSpeed * dt));
        laser.light.position = laser.mesh.position;
        laser.ttl -= dt;
        if (laser.ttl <= 0) {
          laser.mesh.dispose();
          laser.light.dispose();
          lasers.splice(i, 1);
        }
      }

      if (now - lastHudUpdate > 120) {
        setVelocity(speed);
        lastHudUpdate = now;
      }

      if (enemyRoot) {
        const orbitAngle = performance.now() * enemyOrbitRate;
        const orbitHeight = enemyOrbitHeight + Math.sin(orbitAngle * 1.4) * 10;
        const orbitPosition = planetCenter.add(
          new Vector3(
            Math.cos(orbitAngle) * enemyOrbitRadius,
            orbitHeight,
            Math.sin(orbitAngle) * enemyOrbitRadius
          )
        );
        enemyRoot.position.copyFrom(orbitPosition);

        const travelDirection = new Vector3(
          -Math.sin(orbitAngle),
          0,
          Math.cos(orbitAngle)
        ).normalize();
        const yaw = Math.atan2(travelDirection.x, travelDirection.z);
        const pitch = Math.asin(-travelDirection.y);
        enemyRoot.rotationQuaternion = Quaternion.RotationYawPitchRoll(
          yaw,
          pitch,
          0
        );
      }

      scene.render();
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Skirmish Level</p>
          <h1>Space Dogs</h1>
          <p className={styles.status}>Under construction</p>
          <p className={styles.lead}>
            Dive into a quick dogfight near a blue giant. Two ships, one orbit,
            and a whole lot of cosmic pressure.
          </p>
        </div>
      </header>

      <section className={styles.stage}>
        <div className={styles.viewport}>
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.overlay} aria-hidden="true">
            <div className={styles.reticle} />
            <div className={styles.readoutLeft}>
              <span className={styles.label}>Hull</span>
              <strong>98%</strong>
              <span className={styles.label}>Shield</span>
              <strong>74%</strong>
            </div>
            <div className={styles.readoutRight}>
              <span className={styles.label}>Vector</span>
              <strong>NE-03</strong>
              <span className={styles.label}>Lock</span>
              <strong>Tracking</strong>
              <span className={styles.label}>Velocity</span>
              <strong>{velocity.toFixed(1)} u/s</strong>
            </div>
            <div className={styles.scanline} />
            <div className={styles.canopy} />
          </div>
        </div>
        <div className={styles.controls}>
          <span>
            W/S = pitch · A/D = yaw · ←/→ or Q/E = roll · Space = throttle · R =
            reverse · Click = fire
          </span>
          <span>First-person cockpit view</span>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/">Back to home</Link>
      </footer>
    </div>
  );
}
