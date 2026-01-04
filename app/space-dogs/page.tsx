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
  const [satelliteCount, setSatelliteCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const timerStartRef = useRef<number | null>(null);
  const timerStopRef = useRef<number | null>(null);

  const formatTime = (seconds: number) => {
    const clamped = Math.max(0, seconds);
    const mins = Math.floor(clamped / 60);
    const secs = Math.floor(clamped % 60);
    const millis = Math.floor((clamped % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    setAssetsLoaded(false);
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
    starLight.range = 1200;
    starLight.diffuse = new Color3(1, 0.55, 0.2);
    starLight.specular = new Color3(1, 0.6, 0.25);

    let isMounted = true;
    const assetState = { planet: false, satellites: false };
    const markLoaded = (key: "planet" | "satellites") => {
      assetState[key] = true;
      if (assetState.planet && assetState.satellites && isMounted) {
        setAssetsLoaded(true);
      }
    };

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
          root.scaling = new Vector3(256, 256, 256);
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

        planetMeshes.forEach((mesh) => {
          const material = mesh.material as StandardMaterial | null;
          if (!material) {
            return;
          }
          if (material.emissiveColor) {
            material.emissiveColor = material.emissiveColor.scale(0.5);
          }
          if (material.diffuseColor) {
            material.diffuseColor = material.diffuseColor.scale(0.7);
          }
        });
      } catch (error) {
        console.error("Failed to load fire_planet.glb", error);
      } finally {
        markLoaded("planet");
      }
    };

    void loadPlanet();

    let satelliteRoot: TransformNode | null = null;
    let satelliteMeshes: Mesh[] = [];
    const satellites: {
      node: TransformNode;
      angle: number;
      speed: number;
      tilt: number;
      altitude: number;
      blink: Mesh;
      blinkPhase: number;
      health: number;
    }[] = [];

    const loadSatellites = async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          "",
          assetPath,
          "space_satellite_1k.glb",
          scene
        );
        const rootNodes = result.meshes.filter((mesh) => mesh.parent === null);
        const primaryRoot = rootNodes[0] ?? result.meshes[0];
        rootNodes.slice(1).forEach((root) => root.setEnabled(false));

        const satelliteContainer = new TransformNode(
          "satelliteContainer",
          scene
        );
        satelliteRoot = satelliteContainer;
        satelliteRoot.rotationQuaternion = Quaternion.Identity();

        if (primaryRoot) {
          primaryRoot.parent = satelliteRoot;
          const childMeshes = primaryRoot.getChildMeshes(false);
          satelliteMeshes = [
            ...childMeshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh),
            ...(primaryRoot instanceof Mesh ? [primaryRoot] : []),
          ];
          satelliteMeshes.forEach((mesh) => glow.addIncludedOnlyMesh(mesh));
        }

        if (satelliteRoot && satelliteMeshes.length > 0) {
          for (let i = 0; i < 12; i += 1) {
            const node = new TransformNode(`satellite-${i}`, scene);
            node.parent = satelliteRoot;
            node.rotationQuaternion = Quaternion.Identity();
            node.scaling = new Vector3(1, 1, 1);

            satelliteMeshes.forEach((mesh) => {
              const instance = mesh.createInstance(`sat-${mesh.name}-${i}`);
              instance.parent = node;
            });

            const blink = MeshBuilder.CreateSphere(
              `satellite-blink-${i}`,
              { diameter: 0.5, segments: 6 },
              scene
            );
            const blinkMat = new StandardMaterial(
              `satellite-blink-mat-${i}`,
              scene
            );
            blinkMat.emissiveColor = new Color3(0.2, 0.9, 1);
            blinkMat.disableLighting = true;
            blink.material = blinkMat;
            blink.parent = node;
            glow.addIncludedOnlyMesh(blink);

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
            node.getChildMeshes(false).forEach((child) => {
              child.computeWorldMatrix(true);
              const bounds = child.getBoundingInfo().boundingBox;
              min = Vector3.Minimize(min, bounds.minimum);
              max = Vector3.Maximize(max, bounds.maximum);
            });
            const centerX = (min.x + max.x) * 0.5;
            const centerY = (min.y + max.y) * 0.5;
            blink.position = new Vector3(centerX, centerY, min.z);

            satellites.push({
              node,
              angle: Math.random() * Math.PI * 2,
              speed: 0.00008 + Math.random() * 0.00012,
              tilt: (Math.random() - 0.5) * Math.PI * 0.6,
              altitude: 10 + Math.random() * 15,
              blink,
              blinkPhase: Math.random() * Math.PI * 2,
              health: 5,
            });
          }
          setSatelliteCount(satellites.length);
        }
      } catch (error) {
        console.error("Failed to load space_satellite_1k.glb", error);
      } finally {
        markLoaded("satellites");
      }
    };

    void loadSatellites();

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
      fire: false,
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
      if (event.code === "KeyL") {
        controlState.reverse = true;
      }
      if (event.code === "KeyO") {
        controlState.throttle = true;
      }
      if (event.code === "Space") {
        event.preventDefault();
        fireRequested = true;
        controlState.fire = true;
      }
      if (event.code === "KeyA") {
        controlState.yawLeft = true;
      }
      if (event.code === "KeyD") {
        controlState.yawRight = true;
      }
      if (event.code === "KeyK") {
        controlState.rollLeft = true;
      }
      if (event.code === "Semicolon") {
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
      if (event.code === "KeyL") {
        controlState.reverse = false;
      }
      if (event.code === "KeyO") {
        controlState.throttle = false;
      }
      if (event.code === "Space") {
        controlState.fire = false;
      }
      if (event.code === "KeyA") {
        controlState.yawLeft = false;
      }
      if (event.code === "KeyD") {
        controlState.yawRight = false;
      }
      if (event.code === "KeyK") {
        controlState.rollLeft = false;
      }
      if (event.code === "Semicolon") {
        controlState.rollRight = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const linearVelocity = new Vector3(0, 0, 0);
    const angularVelocity = new Vector3(0, 0, 0);
    const displacement = new Vector3(0, 0, 0);
    const muzzleOffset = new Vector3(0, 0, 1.2);
    const angularAccel = 2.6;
    const thrustAccel = 16;
    const playerMaxSpeed = 36;
    const satelliteMaxSpeed = 17.5;
    const linearDamping = 0.985;
    const angularDamping = 0.9;
    const laserLifetime = 0.7;
    const laserSpeed = 300;
    const satelliteHitRadius = 1.2;
    const lasers: {
      mesh: ReturnType<typeof MeshBuilder.CreateCylinder>;
      light: PointLight;
      ttl: number;
      direction: Vector3;
    }[] = [];
    const explosions: { mesh: Mesh; ttl: number }[] = [];
    const sparkParticles: {
      mesh: Mesh;
      ttl: number;
      velocity: Vector3;
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

    const spawnExplosion = (position: Vector3) => {
      const blast = MeshBuilder.CreateSphere(
        "explosion",
        { diameter: 1.6, segments: 8 },
        scene
      );
      blast.position.copyFrom(position);
      const blastMat = new StandardMaterial("explosion-mat", scene);
      blastMat.emissiveColor = new Color3(1, 0.6, 0.2);
      blastMat.alpha = 0.9;
      blastMat.disableLighting = true;
      blast.material = blastMat;
      glow.addIncludedOnlyMesh(blast);
      explosions.push({ mesh: blast, ttl: 0.6 });
    };

    const spawnSparks = (position: Vector3, count: number) => {
      for (let i = 0; i < count; i += 1) {
        const spark = MeshBuilder.CreateSphere(
          "spark",
          { diameter: 0.18, segments: 6 },
          scene
        );
        spark.position.copyFrom(position);
        const sparkMat = new StandardMaterial("spark-mat", scene);
        sparkMat.emissiveColor = new Color3(1, 0.8, 0.2);
        sparkMat.alpha = 0.9;
        sparkMat.disableLighting = true;
        spark.material = sparkMat;
        glow.addIncludedOnlyMesh(spark);

        const velocity = new Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6
        );
        sparkParticles.push({ mesh: spark, ttl: 0.4, velocity });
      }
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
      if (speed > playerMaxSpeed) {
        linearVelocity.scaleInPlace(playerMaxSpeed / speed);
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
      if ((fireRequested || controlState.fire) && now - lastShot > 135) {
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
          continue;
        }

        if (satellites.length > 0) {
          for (let s = satellites.length - 1; s >= 0; s -= 1) {
            const satellite = satellites[s];
            const distance = Vector3.Distance(
              laser.mesh.position,
              satellite.node.getAbsolutePosition()
            );
            if (distance <= satelliteHitRadius) {
              satellite.health -= 1;
              spawnSparks(satellite.node.getAbsolutePosition(), 6);
              laser.mesh.dispose();
              laser.light.dispose();
              lasers.splice(i, 1);
              if (satellite.health <= 0) {
                spawnSparks(satellite.node.getAbsolutePosition(), 12);
                spawnExplosion(satellite.node.getAbsolutePosition());
                satellite.node.dispose(false, true);
                satellites.splice(s, 1);
                setSatelliteCount(satellites.length);
                if (satellites.length === 0 && timerStopRef.current === null) {
                  timerStopRef.current = now;
                }
              }
              break;
            }
          }
        }
      }

      for (let e = explosions.length - 1; e >= 0; e -= 1) {
        const explosion = explosions[e];
        explosion.ttl -= dt;
        const life = Math.max(explosion.ttl, 0);
        const scale = 1 + (0.6 - life) * 2.2;
        explosion.mesh.scaling.setAll(scale);
        const mat = explosion.mesh.material as StandardMaterial;
        if (mat) {
          mat.alpha = Math.max(0, life / 0.6);
        }
        if (explosion.ttl <= 0) {
          explosion.mesh.dispose();
          explosions.splice(e, 1);
        }
      }

      for (let p = sparkParticles.length - 1; p >= 0; p -= 1) {
        const spark = sparkParticles[p];
        spark.mesh.position.addInPlace(spark.velocity.scale(dt));
        spark.velocity.scaleInPlace(0.92);
        spark.ttl -= dt;
        const mat = spark.mesh.material as StandardMaterial;
        if (mat) {
          mat.alpha = Math.max(0, spark.ttl / 0.4);
        }
        if (spark.ttl <= 0) {
          spark.mesh.dispose();
          sparkParticles.splice(p, 1);
        }
      }

      if (timerStartRef.current === null) {
        timerStartRef.current = now;
      }

      if (now - lastHudUpdate > 120) {
        setVelocity(speed);
        lastHudUpdate = now;
        if (timerStartRef.current !== null) {
          const stopTime = timerStopRef.current ?? now;
          setElapsedSeconds((stopTime - timerStartRef.current) / 1000);
        }
      }

      if (satellites.length > 0) {
        const nowMs = performance.now();
        satellites.forEach((satellite) => {
          const radius = planetRadius + satellite.altitude;
          const maxOmega = satelliteMaxSpeed / radius;
          const omega = Math.min(satellite.speed, maxOmega);
          const angle = satellite.angle + nowMs * omega;
          const base = new Vector3(radius, 0, 0);
          const tilted = Vector3.TransformCoordinates(
            base,
            Matrix.RotationZ(satellite.tilt)
          );
          const orbitPosition = Vector3.TransformCoordinates(
            tilted,
            Matrix.RotationY(angle)
          );
          satellite.node.position.copyFrom(planetCenter.add(orbitPosition));

          const travelDirection = new Vector3(
            -Math.sin(angle),
            0,
            Math.cos(angle)
          ).normalize();
          const yaw = Math.atan2(travelDirection.x, travelDirection.z);
          satellite.node.rotationQuaternion = Quaternion.RotationYawPitchRoll(
            yaw,
            0,
            0
          );

          const blinkValue =
            Math.sin(nowMs * 0.008 + satellite.blinkPhase) * 0.5 + 0.5;
          satellite.blink.scaling.setAll(0.6 + blinkValue * 0.8);
          const blinkMat = satellite.blink.material as StandardMaterial;
          if (blinkMat) {
            blinkMat.emissiveColor = new Color3(
              0.1 + blinkValue * 0.3,
              0.7 + blinkValue * 0.3,
              0.9 + blinkValue * 0.2
            );
          }
        });
      }

      scene.render();
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);

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
            Dive into a quick dogfight above a scorched, ember-cracked planet.
            Destroy every satellite as fast as you can.
          </p>
        </div>
      </header>

      <section className={styles.stage}>
        <div className={styles.viewport}>
          <canvas ref={canvasRef} className={styles.canvas} />
          {!assetsLoaded && (
            <div className={styles.loading}>
              <div className={styles.loadingCard}>
                <span>Loading universe...</span>
              </div>
            </div>
          )}
          <div className={styles.overlay} aria-hidden="true">
            <div className={styles.reticle} />
            <div className={styles.readoutLeft}>
              <span className={styles.label}>Hull</span>
              <strong>98%</strong>
              <span className={styles.label}>Shield</span>
              <strong>74%</strong>
            </div>
            <div className={styles.readoutRight}>
              <span className={styles.label}>Satellites</span>
              <strong>{satelliteCount}</strong>
              <span className={styles.label}>Velocity</span>
              <strong>{velocity.toFixed(1)} m/s</strong>
              <span className={styles.label}>Timer</span>
              <strong>{formatTime(elapsedSeconds)}</strong>
            </div>
            <div className={styles.scanline} />
            <div className={styles.canopy} />
          </div>
        </div>
        <div className={styles.controls}>
          <span>
            W/S = pitch · A/D = yaw · K/; = roll · O = throttle · L = reverse ·
            Space = fire
          </span>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/">Back to home</Link>
      </footer>
    </div>
  );
}
