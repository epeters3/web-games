"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  Axis,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  FresnelParameters,
  GlowLayer,
  HemisphericLight,
  MeshBuilder,
  Matrix,
  PointLight,
  Quaternion,
  Scene,
  Space,
  StandardMaterial,
  Texture,
  UniversalCamera,
  Vector3
} from "@babylonjs/core";

export default function SpaceDogsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [velocity, setVelocity] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.04, 0.08, 1);

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.15;

    const planetDiameter = 36;
    const planet = MeshBuilder.CreateSphere("planet", { diameter: planetDiameter, segments: 48 }, scene);
    planet.position = new Vector3(-18, -10, 0);
    const planetMat = new StandardMaterial("planetMat", scene);
    planetMat.diffuseColor = new Color3(0.1, 0.18, 0.35);
    planetMat.emissiveColor = new Color3(0.08, 0.2, 0.4);
    planetMat.specularColor = new Color3(0.6, 0.8, 1);
    planetMat.specularPower = 64;
    planetMat.emissiveFresnelParameters = new FresnelParameters();
    planetMat.emissiveFresnelParameters.bias = 0.1;
    planetMat.emissiveFresnelParameters.power = 2.6;
    planetMat.emissiveFresnelParameters.leftColor = new Color3(0.2, 0.5, 0.9);
    planetMat.emissiveFresnelParameters.rightColor = new Color3(0.02, 0.06, 0.15);
    planet.material = planetMat;

    const starTexture = new DynamicTexture("starTexture", { width: 256, height: 256 }, scene, false);
    starTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    starTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    planetMat.diffuseTexture = starTexture;

    const atmosphere = MeshBuilder.CreateSphere(
      "atmosphere",
      { diameter: planetDiameter + 1.6, segments: 48 },
      scene
    );
    const atmMat = new StandardMaterial("atmMat", scene);
    atmMat.emissiveColor = new Color3(0.2, 0.6, 1);
    atmMat.alpha = 0.14;
    atmMat.emissiveFresnelParameters = new FresnelParameters();
    atmMat.emissiveFresnelParameters.bias = 0.08;
    atmMat.emissiveFresnelParameters.power = 3.4;
    atmMat.emissiveFresnelParameters.leftColor = new Color3(0.1, 0.4, 0.9);
    atmMat.emissiveFresnelParameters.rightColor = new Color3(0, 0, 0);
    atmosphere.material = atmMat;
    atmosphere.position = planet.position.clone();

    const corona = MeshBuilder.CreateSphere(
      "corona",
      { diameter: planetDiameter + 4.6, segments: 48 },
      scene
    );
    const coronaMat = new StandardMaterial("coronaMat", scene);
    coronaMat.emissiveColor = new Color3(0.16, 0.5, 0.95);
    coronaMat.alpha = 0.08;
    corona.material = coronaMat;
    corona.position = planet.position.clone();

    const glow = new GlowLayer("glow", scene, {
      blurKernelSize: 64
    });
    glow.intensity = 0.9;
    glow.addIncludedOnlyMesh(planet);
    glow.addIncludedOnlyMesh(atmosphere);
    glow.addIncludedOnlyMesh(corona);

    const starLight = new PointLight("starLight", planet.position.clone(), scene);
    starLight.intensity = 2.6;
    starLight.range = 220;

    const playerRadius = 1.1;
    const player = MeshBuilder.CreateBox("player", { width: 1.4, height: 0.6, depth: 2.4 }, scene);
    player.position = new Vector3(0, 2, 55);
    player.rotationQuaternion = Quaternion.Identity();
    player.lookAt(planet.position);
    const playerMat = new StandardMaterial("playerMat", scene);
    playerMat.diffuseColor = new Color3(0.95, 0.4, 0.55);
    player.material = playerMat;

    const camera = new UniversalCamera("camera", new Vector3(0, 0.25, -0.8), scene);
    camera.parent = player;
    camera.rotation = new Vector3(0, 0, 0);

    const wingLeft = MeshBuilder.CreateBox("wingLeft", { width: 0.3, height: 0.1, depth: 1 }, scene);
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

    const starSeed = 1200;
    const starBase = MeshBuilder.CreateSphere("star", { diameter: 0.14, segments: 6 }, scene);
    starBase.isVisible = true;
    starBase.isPickable = false;
    const starMat = new StandardMaterial("starMat", scene);
    starMat.emissiveColor = new Color3(1, 1, 1);
    starMat.disableLighting = true;
    starBase.material = starMat;

    const matrices = new Float32Array(starSeed * 16);
    for (let i = 0; i < starSeed; i += 1) {
      const radius = 60 + Math.random() * 80;
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
      rollRight: false
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
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        event.preventDefault();
        controlState.fire = true;
        if (!event.repeat) {
          fireRequested = true;
        }
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
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        controlState.fire = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const linearVelocity = new Vector3(0, 0, 0);
    const angularVelocity = new Vector3(0, 0, 0);
    const displacement = new Vector3(0, 0, 0);
    const planetCenter = planet.position.clone();
    const muzzleOffset = new Vector3(0, 0, 1.2);
    const angularAccel = 2.6;
    const thrustAccel = 6.5;
    const maxSpeed = 12;
    const linearDamping = 0.985;
    const angularDamping = 0.9;
    const laserLifetime = 0.7;
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
      beamLight.excludedMeshes = [planet, atmosphere, corona];

      lasers.push({ mesh: beam, light: beamLight, ttl: laserLifetime, direction: Vector3.Forward() });
    };

    let lastShot = 0;

    const noise = (x: number, y: number, seed: number) => {
      const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
      return value - Math.floor(value);
    };

    const updateStarTexture = (time: number) => {
      const ctx = starTexture.getContext() as CanvasRenderingContext2D;
      const size = starTexture.getSize();
      const width = size.width;
      const height = size.height;
      const seed = Math.floor(time / 900);

      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createRadialGradient(
        width * 0.45,
        height * 0.35,
        width * 0.1,
        width * 0.5,
        height * 0.5,
        width * 0.6
      );
      gradient.addColorStop(0, "rgba(220, 255, 255, 1)");
      gradient.addColorStop(0.55, "rgba(80, 150, 240, 1)");
      gradient.addColorStop(1, "rgba(10, 18, 44, 1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const bandShift = (time * 0.02) % width;
      for (let y = 0; y < height; y += 1) {
        const band = Math.sin((y / height) * Math.PI * 5 + time * 0.002) * 0.5 + 0.5;
        const swirl = Math.sin((y / height) * Math.PI * 12 + time * 0.003) * 0.5 + 0.5;
        const grain = noise(y, bandShift, seed) * 0.18;
        ctx.fillStyle = `rgba(130, 200, 255, ${0.08 + band * 0.16 + swirl * 0.06 + grain})`;
        ctx.fillRect(bandShift, y, width, 1);
      }

      for (let i = 0; i < 140; i += 1) {
        const x = noise(i, seed, 0) * width;
        const y = noise(i * 2, seed, 1) * height;
        const radius = 2 + noise(i, seed, 2) * 7;
        const alpha = 0.05 + noise(i, seed, 3) * 0.22;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "multiply";
      const limb = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        width * 0.2,
        width * 0.5,
        height * 0.5,
        width * 0.7
      );
      limb.addColorStop(0, "rgba(255, 255, 255, 1)");
      limb.addColorStop(1, "rgba(40, 70, 120, 0.7)");
      ctx.fillStyle = limb;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      starTexture.update(false);
    };

    let alpha = 0;
    let lastHudUpdate = 0;
    engine.runRenderLoop(() => {
      const pulse = 0.5 + Math.sin(alpha * 1.2) * 0.1;
      planetMat.emissiveColor = new Color3(0.12 + pulse * 0.1, 0.24 + pulse * 0.14, 0.45 + pulse * 0.2);
      atmMat.alpha = 0.12 + pulse * 0.06;
      coronaMat.alpha = 0.06 + pulse * 0.04;
      if (Math.floor(alpha * 60) % 4 === 0) {
        updateStarTexture(performance.now());
      }
      alpha += 0.008;
      const dt = engine.getDeltaTime() / 1000;
      const yawInput = (controlState.yawRight ? 1 : 0) - (controlState.yawLeft ? 1 : 0);
      const pitchInput = (controlState.pitchUp ? 1 : 0) - (controlState.pitchDown ? 1 : 0);
      const rollInput = (controlState.rollLeft ? 1 : 0) - (controlState.rollRight ? 1 : 0);

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
      const minDistance = planetDiameter * 0.5 + playerRadius;
      if (planetToShip.length() < minDistance) {
        planetToShip.normalize();
        player.position = planetCenter.add(planetToShip.scale(minDistance));
        linearVelocity.scaleInPlace(0.2);
      } else {
        player.position = nextPosition;
      }

      const now = performance.now();
      if ((controlState.fire || fireRequested) && now - lastShot > 180) {
        const muzzle = player.position.add(player.getDirection(muzzleOffset));
        spawnLaser();
        const active = lasers[lasers.length - 1];
        const direction = player.getDirection(Vector3.Forward()).normalize();
        active.direction = direction;
        active.mesh.position = muzzle.add(direction.scale(3));
        const shipRotation = player.rotationQuaternion?.clone() ?? Quaternion.Identity();
        const cylinderAlign = Quaternion.FromEulerAngles(Math.PI / 2, 0, 0);
        active.mesh.rotationQuaternion = shipRotation.multiply(cylinderAlign);
        active.light.position = active.mesh.position;
        lastShot = now;
        fireRequested = false;
      }

      for (let i = lasers.length - 1; i >= 0; i -= 1) {
        const laser = lasers[i];
        laser.mesh.position.addInPlace(laser.direction.scale(60 * dt));
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

      scene.render();
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
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
          <span>W/S = pitch · A/D = yaw · ←/→ or Q/E = roll · Space = throttle · R = reverse · Enter = fire</span>
          <span>First-person cockpit view</span>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/">Back to home</Link>
      </footer>
    </div>
  );
}
