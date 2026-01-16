import { useRef, useCallback, useState } from "react";
import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  PointLight,
  Quaternion,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { Drone, EnvironmentState, LevelConfig } from "./types";

export interface EnemiesResult {
  drones: Drone[];
  droneCount: number;
  loadEnemies: () => Promise<void>;
  updateEnemies: (dt: number, environmentState: EnvironmentState) => void;
  removeDrone: (index: number) => void;
  resetEnemies: () => Promise<void>;
}

export const useEnemies = (
  scene: Scene | null,
  config: LevelConfig,
  assetPath: string
): EnemiesResult => {
  const dronesRef = useRef<Drone[]>([]);
  const [droneCount, setDroneCount] = useState(0);

  const getRandomBeamDelay = useCallback(() => {
    const beam = config.tractorBeam;
    if (!beam) return 1;
    return beam.delayMin + Math.random() * (beam.delayMax - beam.delayMin);
  }, [config.tractorBeam]);

  // Get random position based on movement config
  const getRandomPosition = useCallback(
    (index: number, environmentState: EnvironmentState): Vector3 => {
      const { movement } = config.enemies;
      const centerPoint = environmentState.centerPoint;

      switch (movement.type) {
        case "orbital": {
          // Start position is calculated during update
          const altitude =
            movement.altitudeMin +
            Math.random() * (movement.altitudeMax - movement.altitudeMin);
          const angle = Math.random() * Math.PI * 2;
          const tilt = (Math.random() - 0.5) * Math.PI * movement.tiltRange * 2;

          const radius = altitude;
          const base = new Vector3(radius, 0, 0);
          const tilted = Vector3.TransformCoordinates(
            base,
            Matrix.RotationZ(tilt)
          );
          return centerPoint.add(
            Vector3.TransformCoordinates(tilted, Matrix.RotationY(angle))
          );
        }

        case "patrol":
        case "random-area": {
          const area = movement.area;
          const areaCenter = new Vector3(...area.center);
          // Random position in sphere
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = Math.cbrt(Math.random()) * area.radius;

          const x = r * Math.sin(phi) * Math.cos(theta);
          const y = r * Math.sin(phi) * Math.sin(theta);
          const z = r * Math.cos(phi);

          return areaCenter.add(new Vector3(x, y, z));
        }

        case "stationary": {
          const positions = movement.positions;
          const pos = positions[index % positions.length];
          return new Vector3(...pos);
        }
      }
    },
    [config.enemies]
  );

  const loadEnemies = useCallback(async () => {
    if (!scene) return;

    const { enemies, tractorBeam } = config;
    const { movement } = enemies;

    try {
      const result = await SceneLoader.ImportMeshAsync(
        "",
        assetPath,
        enemies.asset,
        scene
      );

      const rootNodes = result.meshes.filter((mesh) => mesh.parent === null);
      const primaryRoot = rootNodes[0] ?? result.meshes[0];
      rootNodes.slice(1).forEach((root) => root.setEnabled(false));

      const enemyContainer = new TransformNode("enemyContainer", scene);
      enemyContainer.rotationQuaternion = Quaternion.Identity();

      if (primaryRoot) {
        primaryRoot.parent = enemyContainer;
        const childMeshes = primaryRoot.getChildMeshes(false);
        const enemyMeshes = [
          ...childMeshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh),
          ...(primaryRoot instanceof Mesh ? [primaryRoot] : []),
        ];

        // Hide original meshes
        enemyMeshes.forEach((mesh) => {
          mesh.isVisible = false;
        });

        // Create drone instances
        for (let i = 0; i < enemies.count; i += 1) {
          const node = new TransformNode(`drone-${i}`, scene);
          node.parent = enemyContainer;
          node.rotationQuaternion = Quaternion.Identity();
          node.scaling = new Vector3(1, 1, 1);

          // Create mesh instances
          enemyMeshes.forEach((mesh) => {
            const instance = mesh.createInstance(`drone-${mesh.name}-${i}`);
            instance.parent = node;
            const s = enemies.scale;
            instance.scaling = new Vector3(s, s, s);
          });

          // Create tractor beam components if enabled
          let beamMesh: Mesh;
          let beamLight: PointLight;
          let lumpMesh: Mesh;

          if (tractorBeam?.enabled) {
            // Tractor beam cone
            beamMesh = MeshBuilder.CreateCylinder(
              `tractor-beam-${i}`,
              {
                diameterTop: tractorBeam.beamDiameterTop,
                diameterBottom: tractorBeam.beamDiameterBottom,
                height: 1,
                tessellation: 24,
              },
              scene
            );
            const beamMat = new StandardMaterial(`beam-mat-${i}`, scene);
            beamMat.emissiveColor = new Color3(...tractorBeam.color);
            beamMat.diffuseColor = new Color3(...tractorBeam.color);
            beamMat.alpha = 0.4;
            beamMat.disableLighting = true;
            beamMesh.material = beamMat;
            beamMesh.isVisible = false;

            // Beam light
            beamLight = new PointLight(
              `beam-light-${i}`,
              Vector3.Zero(),
              scene
            );
            beamLight.intensity = 0;
            beamLight.range = 15;
            beamLight.diffuse = new Color3(...tractorBeam.color);

            // Lump being beamed up
            lumpMesh = MeshBuilder.CreateSphere(
              `lump-${i}`,
              { diameter: tractorBeam.lumpDiameter, segments: 8 },
              scene
            );
            const lumpMat = new StandardMaterial(`lump-mat-${i}`, scene);
            lumpMat.diffuseColor = new Color3(...tractorBeam.lumpColor);
            lumpMat.emissiveColor = new Color3(...tractorBeam.lumpEmissive);
            lumpMesh.material = lumpMat;
            lumpMesh.isVisible = false;
          } else {
            // Create dummy meshes if no tractor beam
            beamMesh = MeshBuilder.CreateBox(
              `beam-dummy-${i}`,
              { size: 0.01 },
              scene
            );
            beamMesh.isVisible = false;
            beamLight = new PointLight(
              `beam-light-${i}`,
              Vector3.Zero(),
              scene
            );
            beamLight.intensity = 0;
            lumpMesh = MeshBuilder.CreateBox(
              `lump-dummy-${i}`,
              { size: 0.01 },
              scene
            );
            lumpMesh.isVisible = false;
          }

          // Initialize movement state based on movement type
          let angle = 0;
          let speed = 0;
          let tilt = 0;
          let altitude = 0;
          let velocity: Vector3 | undefined;

          switch (movement.type) {
            case "orbital":
              angle = Math.random() * Math.PI * 2;
              speed =
                movement.speedMin +
                Math.random() * (movement.speedMax - movement.speedMin);
              tilt = (Math.random() - 0.5) * Math.PI * movement.tiltRange * 2;
              altitude =
                movement.altitudeMin +
                Math.random() * (movement.altitudeMax - movement.altitudeMin);
              break;

            case "patrol":
              speed = movement.speed;
              velocity = new Vector3(0, 0, 0);
              break;

            case "random-area":
              speed =
                movement.speedMin +
                Math.random() * (movement.speedMax - movement.speedMin);
              // Random initial direction
              velocity = new Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
              )
                .normalize()
                .scale(speed);
              break;

            case "stationary":
              speed = 0;
              break;
          }

          dronesRef.current.push({
            node,
            angle,
            speed,
            tilt,
            altitude,
            health: enemies.health,
            velocity,
            beamMesh,
            beamLight,
            lumpMesh,
            beamState: "waiting",
            beamTimer: getRandomBeamDelay() * Math.random(),
            lumpProgress: 0,
          });
        }

        setDroneCount(dronesRef.current.length);
      }
    } catch (error) {
      console.error(`Failed to load ${enemies.asset}`, error);
    }
  }, [scene, config, assetPath, getRandomBeamDelay, getRandomPosition]);

  const updateEnemies = useCallback(
    (dt: number, environmentState: EnvironmentState) => {
      const drones = dronesRef.current;
      if (drones.length === 0) return;

      const { enemies, tractorBeam } = config;
      const { movement } = enemies;
      const nowMs = performance.now();
      const centerPoint = environmentState.centerPoint;

      // Get target point for tractor beams (if any)
      const beamTargetPoint = tractorBeam?.targetPoint
        ? new Vector3(...tractorBeam.targetPoint)
        : centerPoint;

      // Find the closest collision body for tractor beam
      let surfaceRadius = 0;
      if (tractorBeam?.enabled && environmentState.collisionBodies.length > 0) {
        // Use the first collision body's radius (planet)
        surfaceRadius = environmentState.collisionBodies[0].radius;
      }

      drones.forEach((drone, index) => {
        const dronePosition = drone.node.position;

        // Update position based on movement type
        switch (movement.type) {
          case "orbital": {
            // Calculate orbital position
            const orbitCenter = centerPoint;
            const radius = drone.altitude + surfaceRadius;
            const maxOmega = enemies.maxSpeed / radius;
            const omega = Math.min(drone.speed, maxOmega);
            const angle = drone.angle + nowMs * omega;

            const base = new Vector3(radius, 0, 0);
            const tilted = Vector3.TransformCoordinates(
              base,
              Matrix.RotationZ(drone.tilt)
            );
            const orbitPosition = Vector3.TransformCoordinates(
              tilted,
              Matrix.RotationY(angle)
            );
            drone.node.position.copyFrom(orbitCenter.add(orbitPosition));
            break;
          }

          case "patrol": {
            // Move towards target, pick new target when reached
            if (!drone.targetPosition) {
              drone.targetPosition = getRandomPosition(index, environmentState);
            }

            const direction = drone.targetPosition
              .subtract(dronePosition)
              .normalize();
            const distance = Vector3.Distance(
              dronePosition,
              drone.targetPosition
            );

            if (distance < 2) {
              // Reached target, pick new one
              drone.targetPosition = getRandomPosition(index, environmentState);
            } else {
              drone.node.position.addInPlace(direction.scale(drone.speed * dt));
            }
            break;
          }

          case "random-area": {
            // Random wandering within area
            if (!drone.velocity) {
              drone.velocity = new Vector3(0, 0, 0);
            }

            // Periodically change direction
            const changeInterval = movement.directionChangeInterval * 1000;
            if (Math.random() < dt / (changeInterval / 1000)) {
              drone.velocity = new Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
              )
                .normalize()
                .scale(drone.speed);
            }

            // Move
            drone.node.position.addInPlace(drone.velocity.scale(dt));

            // Keep within area
            const area = movement.area;
            const areaCenter = new Vector3(...area.center);
            const distFromCenter = Vector3.Distance(dronePosition, areaCenter);
            if (distFromCenter > area.radius * 0.9) {
              // Steer back towards center
              const toCenter = areaCenter.subtract(dronePosition).normalize();
              drone.velocity = toCenter.scale(drone.speed);
            }
            break;
          }

          case "stationary": {
            // Don't move, but position was set during load
            break;
          }
        }

        // Orientation
        if (enemies.facePoint) {
          // Face towards a point
          const targetPoint = new Vector3(...enemies.facePoint);
          const downDirection = targetPoint.subtract(dronePosition).normalize();
          const upDirection = downDirection.scale(-1);
          const forward = Vector3.Cross(
            Vector3.Right(),
            upDirection
          ).normalize();
          const right = Vector3.Cross(upDirection, forward).normalize();

          const rotationMatrix = Matrix.FromValues(
            right.x,
            right.y,
            right.z,
            0,
            upDirection.x,
            upDirection.y,
            upDirection.z,
            0,
            forward.x,
            forward.y,
            forward.z,
            0,
            0,
            0,
            0,
            1
          );
          drone.node.rotationQuaternion =
            Quaternion.FromRotationMatrix(rotationMatrix);
        } else if (enemies.faceMovementDirection && drone.velocity) {
          // Face direction of travel
          const direction = drone.velocity.normalizeToNew();
          if (direction.length() > 0.01) {
            const up = new Vector3(0, 1, 0);
            const right = Vector3.Cross(up, direction).normalize();
            const correctedUp = Vector3.Cross(direction, right).normalize();

            const rotationMatrix = Matrix.FromValues(
              right.x,
              right.y,
              right.z,
              0,
              correctedUp.x,
              correctedUp.y,
              correctedUp.z,
              0,
              direction.x,
              direction.y,
              direction.z,
              0,
              0,
              0,
              0,
              1
            );
            drone.node.rotationQuaternion =
              Quaternion.FromRotationMatrix(rotationMatrix);
          }
        }

        // Tractor beam animation
        if (tractorBeam?.enabled && surfaceRadius > 0) {
          const surfacePoint = beamTargetPoint.add(
            dronePosition
              .subtract(beamTargetPoint)
              .normalize()
              .scale(surfaceRadius)
          );
          const beamLength = Vector3.Distance(dronePosition, surfacePoint);

          // Update beam state
          if (drone.beamState === "waiting") {
            drone.beamTimer -= dt;
            if (drone.beamTimer <= 0) {
              drone.beamState = "beaming";
              drone.lumpProgress = 0;
              drone.beamMesh.isVisible = true;
              drone.lumpMesh.isVisible = true;
              drone.beamLight.intensity = 2.5;
            }
          } else if (drone.beamState === "beaming") {
            drone.lumpProgress += dt / tractorBeam.duration;
            if (drone.lumpProgress >= 1) {
              drone.beamState = "waiting";
              drone.beamTimer = getRandomBeamDelay();
              drone.beamMesh.isVisible = false;
              drone.lumpMesh.isVisible = false;
              drone.beamLight.intensity = 0;
              drone.lumpProgress = 0;
            }
          }

          // Position and scale beam
          if (drone.beamMesh.isVisible) {
            const downDirection = beamTargetPoint
              .subtract(dronePosition)
              .normalize();
            const beamCenter = dronePosition.add(surfacePoint).scale(0.5);
            drone.beamMesh.position.copyFrom(beamCenter);
            drone.beamMesh.scaling = new Vector3(1, beamLength, 1);

            // Rotate beam to point towards target
            const beamUp = downDirection;
            const beamForward = Vector3.Cross(
              Vector3.Right(),
              beamUp
            ).normalize();
            const beamRight = Vector3.Cross(beamUp, beamForward).normalize();

            const beamRotMatrix = Matrix.FromValues(
              beamRight.x,
              beamRight.y,
              beamRight.z,
              0,
              beamUp.x,
              beamUp.y,
              beamUp.z,
              0,
              beamForward.x,
              beamForward.y,
              beamForward.z,
              0,
              0,
              0,
              0,
              1
            );
            drone.beamMesh.rotationQuaternion =
              Quaternion.FromRotationMatrix(beamRotMatrix);

            // Pulsing effect
            const pulse = Math.sin(nowMs * 0.012) * 0.15 + 0.85;
            const beamMat = drone.beamMesh.material as StandardMaterial;
            if (beamMat) {
              beamMat.alpha = 0.35 * pulse;
            }

            // Position lump
            const lumpT = drone.lumpProgress;
            const lumpPos = Vector3.Lerp(surfacePoint, dronePosition, lumpT);
            drone.lumpMesh.position.copyFrom(lumpPos);
            const lumpScale = 0.8 + lumpT * 0.4;
            drone.lumpMesh.scaling.setAll(lumpScale);

            // Position beam light
            drone.beamLight.position.copyFrom(lumpPos);
          }
        }
      });
    },
    [config, getRandomBeamDelay, getRandomPosition]
  );

  const removeDrone = useCallback((index: number) => {
    const drones = dronesRef.current;
    const drone = drones[index];
    if (!drone) return;

    drone.beamMesh.dispose();
    drone.beamLight.dispose();
    drone.lumpMesh.dispose();
    drone.node.dispose(false, true);
    drones.splice(index, 1);
    setDroneCount(drones.length);
  }, []);

  const resetEnemies = useCallback(async () => {
    // Dispose all existing drones
    const drones = dronesRef.current;
    for (const drone of drones) {
      drone.beamMesh.dispose();
      drone.beamLight.dispose();
      drone.lumpMesh.dispose();
      drone.node.dispose(false, true);
    }
    dronesRef.current = [];
    setDroneCount(0);

    // Reload enemies
    await loadEnemies();
  }, [loadEnemies]);

  return {
    drones: dronesRef.current,
    droneCount,
    loadEnemies,
    updateEnemies,
    removeDrone,
    resetEnemies,
  };
};
