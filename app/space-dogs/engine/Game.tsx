"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Color3,
  Constants,
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
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
  const [isVictory, setIsVictory] = useState(false);
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [destroyedEnemyCount, setDestroyedEnemyCount] = useState(0);
  const initialEnemyCountRef = useRef<number | null>(null);
  const [showCollisionDebug, setShowCollisionDebug] = useState(false);
  const collisionDebugMeshesRef = useRef<Mesh[]>([]);
  const collisionDebugMaterialRef = useRef<StandardMaterial | null>(null);
  const enemyCollisionDebugMaterialRef = useRef<StandardMaterial | null>(null);
  const enemyCollisionDebugMeshesRef = useRef<Mesh[]>([]);

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
  const { player, controlState, fireRequested, updatePlayer, resetPlayer } =
    usePlayer(scene, config);

  // Initialize effects
  const { spawnExplosion, spawnSparks, updateEffects } = useEffects(scene);

  // Initialize weapons
  const { fireLaser, updateWeapons, lastShotTime } = useWeapons(
    scene,
    config,
    environmentState.environmentMeshes
  );

  // Initialize enemies
  const {
    drones,
    droneCount,
    loadEnemies,
    updateEnemies,
    removeDrone,
    resetEnemies,
  } = useEnemies(scene, config, assetPath);

  // Load best time from localStorage on mount
  useEffect(() => {
    const storedBest = localStorage.getItem(`best-time-${config.id}`);
    if (storedBest) {
      const parsed = parseFloat(storedBest);
      if (!isNaN(parsed)) {
        setBestTime(parsed);
      }
    }
  }, [config.id]);


  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === "KeyC") {
        setShowCollisionDebug((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!scene) return;

    const clearDebugMeshes = () => {
      collisionDebugMeshesRef.current.forEach((mesh) => mesh.dispose());
      collisionDebugMeshesRef.current = [];
      enemyCollisionDebugMeshesRef.current.forEach((mesh) => mesh.dispose());
      enemyCollisionDebugMeshesRef.current = [];
      if (collisionDebugMaterialRef.current) {
        collisionDebugMaterialRef.current.dispose();
        collisionDebugMaterialRef.current = null;
      }
      if (enemyCollisionDebugMaterialRef.current) {
        enemyCollisionDebugMaterialRef.current.dispose();
        enemyCollisionDebugMaterialRef.current = null;
      }
    };

    if (!showCollisionDebug) {
      clearDebugMeshes();
      return;
    }

    clearDebugMeshes();
    const material = new StandardMaterial("collisionDebugMat", scene);
    material.emissiveColor = new Color3(1, 0.4, 0.2);
    material.wireframe = true;
    material.alpha = 0.35;
    material.disableLighting = true;
    collisionDebugMaterialRef.current = material;

    const enemyMaterial = new StandardMaterial("enemyCollisionDebugMat", scene);
    enemyMaterial.emissiveColor = new Color3(0.2, 0.85, 1);
    enemyMaterial.wireframe = true;
    enemyMaterial.alpha = 0.35;
    enemyMaterial.disableLighting = true;
    enemyMaterial.backFaceCulling = false;
    enemyMaterial.disableDepthWrite = true;
    enemyMaterial.depthFunction = Constants.ALWAYS;
    enemyCollisionDebugMaterialRef.current = enemyMaterial;

    const environmentDebug = environmentState.collisionBodies.map(
      (body, index) => {
        const sphere = MeshBuilder.CreateSphere(
          `collision-debug-env-${index}`,
          { diameter: body.radius * 2, segments: 16 },
          scene
        );
        sphere.position.set(body.center[0], body.center[1], body.center[2]);
        sphere.material = material;
        sphere.isPickable = false;
        return sphere;
      }
    );

    const enemyDebug = drones.map((drone, index) => {
      const sphere = MeshBuilder.CreateSphere(
        `collision-debug-enemy-${index}`,
        { diameter: 1, segments: 16 },
        scene
      );
      sphere.parent = drone.node;
      sphere.position.copyFrom(drone.collisionCenter);
      sphere.scaling.copyFrom(drone.collisionRadii.scale(2));
      sphere.rotationQuaternion = Quaternion.Identity();
      sphere.material = enemyMaterial;
      sphere.isPickable = false;
      return sphere;
    });

    collisionDebugMeshesRef.current = [...environmentDebug, ...enemyDebug];
    enemyCollisionDebugMeshesRef.current = enemyDebug;
  }, [
    scene,
    environmentState.collisionBodies,
    showCollisionDebug,
    drones,
    droneCount,
  ]);

  // Reset game function
  const resetGame = useCallback(async () => {
    // Reset all game state
    setIsVictory(false);
    setFinalTime(null);
    setIsNewBest(false);
    setDestroyedEnemyCount(0);
    setElapsedSeconds(0);
    setVelocity(0);
    timerStartRef.current = null;
    timerStopRef.current = null;
    initialEnemyCountRef.current = null;

    // Mark enemies as not loaded during reset
    setEnemiesLoaded(false);

    // Reset player position, rotation, and velocities
    resetPlayer();

    // Reset and reload enemies
    // The useEffect below will detect when enemies are loaded and set enemiesLoaded back to true
    await resetEnemies();
  }, [resetEnemies, resetPlayer]);

  // Load enemies when scene is ready
  useEffect(() => {
    if (scene && glow && sceneLoaded && !enemiesLoaded) {
      loadEnemies().then(() => {
        setEnemiesLoaded(true);
      });
    }
  }, [scene, glow, sceneLoaded, enemiesLoaded, loadEnemies]);

  // After reset, wait for enemies to actually be loaded before marking as loaded
  useEffect(() => {
    if (!enemiesLoaded && (droneCount > 0 || drones.length > 0)) {
      // Enemies were loaded (likely from resetEnemies), mark as loaded
      setEnemiesLoaded(true);
    }
  }, [enemiesLoaded, droneCount, drones.length]);

  // Handle drone destruction
  const handleDroneDestroyed = useCallback(
    (
      drone: { node: { getAbsolutePosition: () => Vector3 } },
      index: number
    ) => {
      spawnExplosion(drone.node.getAbsolutePosition());
      removeDrone(index);
      setDestroyedEnemyCount((prev) => prev + 1);
    },
    [spawnExplosion, removeDrone]
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


      // Track initial enemy count when enemies are first loaded
      // Only set it if we actually have enemies (count > 0)
      if (enemiesLoaded && initialEnemyCountRef.current === null) {
        const currentCount = droneCount > 0 ? droneCount : drones.length;
        if (currentCount > 0) {
          initialEnemyCountRef.current = currentCount;
        }
      }

      // Check for victory based on level-specific condition
      // Only check if enemies are loaded and game has started
      // Don't check for victory immediately after reset - wait for timer to actually run
      const minTimeSinceTimerStart = timerStartRef.current
        ? now - timerStartRef.current
        : Infinity;

      if (
        enemiesLoaded &&
        initialEnemyCountRef.current !== null &&
        initialEnemyCountRef.current > 0 &&
        timerStopRef.current === null &&
        !isVictory &&
        timerStartRef.current &&
        minTimeSinceTimerStart > 100 // Wait at least 100ms after timer starts to avoid reset race condition
      ) {
        let victoryAchieved = false;
        const victoryCondition = config.victory;

        switch (victoryCondition.type) {
          case "destroy-all":
            // Victory when all enemies are destroyed (but only if we started with enemies)
            // Double-check that we actually had enemies before checking if they're all gone
            victoryAchieved =
              (droneCount === 0 || drones.length === 0) &&
              initialEnemyCountRef.current > 0;
            break;

          case "destroy-count":
            // Victory when specific number of enemies are destroyed
            victoryAchieved = destroyedEnemyCount >= victoryCondition.count;
            break;

          case "survive-time":
            // Victory when player survives for the required duration
            const elapsed = (now - timerStartRef.current) / 1000;
            victoryAchieved = elapsed >= victoryCondition.duration;
            break;
        }

        if (victoryAchieved) {
          timerStopRef.current = now;
          const calculatedFinalTime = (now - timerStartRef.current) / 1000;
          setFinalTime(calculatedFinalTime);
          setIsVictory(true);

          // Check if this is a new best time (get from localStorage to avoid race conditions)
          const storedBest = localStorage.getItem(`best-time-${config.id}`);
          const currentBest = storedBest ? parseFloat(storedBest) : null;

          if (currentBest === null || calculatedFinalTime < currentBest) {
            setIsNewBest(true);
            setBestTime(calculatedFinalTime);
            localStorage.setItem(
              `best-time-${config.id}`,
              calculatedFinalTime.toString()
            );
          }
        }
      }

      // Start timer only after enemies are loaded
      if (timerStartRef.current === null && enemiesLoaded) {
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

      if (showCollisionDebug) {
        const enemyDebugMeshes = enemyCollisionDebugMeshesRef.current;
        const count = Math.min(enemyDebugMeshes.length, drones.length);
        for (let i = 0; i < count; i += 1) {
          const drone = drones[i];
          enemyDebugMeshes[i].position.copyFrom(drone.collisionCenter);
          enemyDebugMeshes[i].scaling.copyFrom(
            drone.collisionRadii.scale(2)
          );
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
    config.victory,
    droneCount,
    destroyedEnemyCount,
    enemiesLoaded,
    isVictory,
    bestTime,
    config.id,
    showCollisionDebug,
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
    <section className={`stage-shell ${styles.stage}`}>
      <div className={styles.viewport}>
        <canvas ref={canvasRef} className={styles.canvas} />

        {isLoading && (
          <div className={styles.loading}>
            <div className={styles.loadingCard}>
              <span>Loading universe...</span>
            </div>
          </div>
        )}

        {isVictory && finalTime !== null && (
          <div className={styles.victory}>
            <div className={styles.victoryCard}>
              <h2 className={styles.victoryTitle}>You won!</h2>
              <div className={styles.victoryTime}>
                <span className={styles.victoryLabel}>Time</span>
                <strong className={styles.victoryTimeValue}>
                  {formatTime(finalTime)}
                </strong>
              </div>
              {isNewBest && (
                <div className={styles.newBest}>
                  <span>New Best Time!</span>
                </div>
              )}
              <button
                className={styles.playAgainButton}
                onClick={resetGame}
                type="button"
              >
                Play Again
              </button>
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
            {bestTime !== null && (
              <>
                <span className={styles.label}>Best Time</span>
                <strong>{formatTime(bestTime)}</strong>
              </>
            )}
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
