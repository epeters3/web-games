"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Vector3 } from "@babylonjs/core";
import type { LevelConfig } from "./types";
import { useGameEngine } from "./useGameEngine";
import { usePlayer } from "./usePlayer";
import { useEffects } from "./useEffects";
import { useWeapons } from "./useWeapons";
import { useEnemies } from "./useEnemies";
import { HUD_UPDATE_INTERVAL_MS } from "./constants";
import styles from "../page.module.css";

interface GameProps {
  config: LevelConfig;
}

export const Game: React.FC<GameProps> = ({ config }) => {
  const [velocity, setVelocity] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerStartRef = useRef<number | null>(null);
  const timerStopRef = useRef<number | null>(null);
  const [enemiesLoaded, setEnemiesLoaded] = useState(false);

  // Asset path
  const assetPath = (() => {
    const assetRoot = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
      /\/$/,
      ""
    );
    return assetRoot ? `${assetRoot}/` : "/";
  })();

  // Initialize game engine
  const {
    canvasRef,
    engine,
    scene,
    glow,
    environmentState,
    assetsLoaded: sceneLoaded,
  } = useGameEngine(config);

  // Initialize player
  const { player, controlState, fireRequested, updatePlayer } = usePlayer(
    scene,
    config
  );

  // Initialize effects
  const { spawnExplosion, spawnSparks, updateEffects } = useEffects(
    scene,
    glow
  );

  // Initialize weapons
  const { fireLaser, updateWeapons, lastShotTime } = useWeapons(
    scene,
    glow,
    config,
    environmentState.environmentMeshes
  );

  // Initialize enemies
  const { drones, droneCount, loadEnemies, updateEnemies, removeDrone } =
    useEnemies(scene, glow, config, assetPath);

  // Load enemies when scene is ready
  useEffect(() => {
    if (scene && glow && sceneLoaded && !enemiesLoaded) {
      loadEnemies().then(() => setEnemiesLoaded(true));
    }
  }, [scene, glow, sceneLoaded, enemiesLoaded, loadEnemies]);

  // Handle drone destruction
  const handleDroneDestroyed = useCallback(
    (
      drone: { node: { getAbsolutePosition: () => Vector3 } },
      index: number
    ) => {
      spawnExplosion(drone.node.getAbsolutePosition());
      removeDrone(index);

      if (drones.length === 1 && timerStopRef.current === null) {
        timerStopRef.current = performance.now();
      }
    },
    [spawnExplosion, removeDrone, drones.length]
  );

  const handleDroneHit = useCallback(() => {
    // Currently just sparks, handled in updateWeapons
  }, []);

  // Main game loop
  useEffect(() => {
    if (!engine || !scene || !player) return;

    const muzzleOffset = new Vector3(0, 0, 1.2);
    let lastHudUpdate = 0;

    const renderLoop = () => {
      const dt = engine.getDeltaTime() / 1000;
      const now = performance.now();

      // Update player
      const speed = updatePlayer(dt, environmentState);

      // Handle firing
      if (
        (fireRequested.current || controlState.fire) &&
        now - lastShotTime.current > config.weapons.fireRate
      ) {
        fireLaser(player, muzzleOffset);
        fireRequested.current = false;
      }

      // Update weapons and check collisions
      updateWeapons(
        dt,
        drones,
        handleDroneHit,
        handleDroneDestroyed,
        spawnSparks
      );

      // Update effects
      updateEffects(dt);

      // Update enemies
      updateEnemies(dt, environmentState);

      // Start timer
      if (timerStartRef.current === null) {
        timerStartRef.current = now;
      }

      // Update HUD
      if (now - lastHudUpdate > HUD_UPDATE_INTERVAL_MS) {
        setVelocity(speed);
        lastHudUpdate = now;

        if (timerStartRef.current !== null) {
          const stopTime = timerStopRef.current ?? now;
          setElapsedSeconds((stopTime - timerStartRef.current) / 1000);
        }
      }

      scene.render();
    };

    engine.runRenderLoop(renderLoop);

    return () => {
      engine.stopRenderLoop(renderLoop);
    };
  }, [
    engine,
    scene,
    player,
    environmentState,
    controlState,
    fireRequested,
    updatePlayer,
    fireLaser,
    updateWeapons,
    updateEffects,
    updateEnemies,
    drones,
    handleDroneHit,
    handleDroneDestroyed,
    spawnSparks,
    lastShotTime,
    config.weapons.fireRate,
  ]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const clamped = Math.max(0, seconds);
    const mins = Math.floor(clamped / 60);
    const secs = Math.floor(clamped % 60);
    const millis = Math.floor((clamped % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
  };

  const isLoading = !sceneLoaded || !enemiesLoaded;

  return (
    <section className={styles.stage}>
      <div className={styles.viewport}>
        <canvas ref={canvasRef} className={styles.canvas} />

        {isLoading && (
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
            <span className={styles.label}>Drones</span>
            <strong>{droneCount}</strong>
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
  );
};
