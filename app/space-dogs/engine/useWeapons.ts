import { useRef, useCallback } from "react";
import {
  Color3,
  Mesh,
  MeshBuilder,
  PointLight,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Drone, Laser, LevelConfig } from "./types";
import { SPARK_COUNT_ON_HIT, SPARK_COUNT_ON_DESTROY } from "./constants";

export interface WeaponsResult {
  fireLaser: (player: Mesh, muzzleOffset: Vector3) => void;
  updateWeapons: (
    dt: number,
    drones: Drone[],
    onDroneHit: (drone: Drone, index: number) => void,
    onDroneDestroyed: (drone: Drone, index: number) => void,
    spawnSparks: (position: Vector3, count: number) => void
  ) => void;
  lastShotTime: React.MutableRefObject<number>;
}

export const useWeapons = (
  scene: Scene | null,
  config: LevelConfig,
  environmentMeshes: Mesh[]
): WeaponsResult => {
  const lasersRef = useRef<Laser[]>([]);
  const lastShotTimeRef = useRef(0);

  const fireLaser = useCallback(
    (player: Mesh, muzzleOffset: Vector3) => {
      if (!scene) return;

      const { weapons } = config;

      const beam = MeshBuilder.CreateCylinder(
        "laser",
        {
          diameter: weapons.laserDiameter,
          height: weapons.laserLength,
          tessellation: 12,
        },
        scene
      );

      const beamMat = new StandardMaterial("laserMat", scene);
      beamMat.emissiveColor = new Color3(...weapons.laserColor);
      beamMat.disableLighting = true;
      beamMat.alpha = 0.95;
      beam.material = beamMat;

      const beamLight = new PointLight("laserLight", Vector3.Zero(), scene);
      beamLight.intensity = 2.2;
      beamLight.range = 10;
      beamLight.diffuse = new Color3(
        weapons.laserColor[0] * 0.7,
        weapons.laserColor[1],
        weapons.laserColor[2] * 0.8
      );
      beamLight.excludedMeshes = environmentMeshes;

      // Position and orient the laser
      const muzzle = player.position.add(player.getDirection(muzzleOffset));
      const direction = player.getDirection(Vector3.Forward()).normalize();

      beam.position = muzzle.add(direction.scale(3));

      const shipRotation =
        player.rotationQuaternion?.clone() ?? Quaternion.Identity();
      const cylinderAlign = Quaternion.FromEulerAngles(Math.PI / 2, 0, 0);
      beam.rotationQuaternion = shipRotation.multiply(cylinderAlign);

      beamLight.position = beam.position;
      lastShotTimeRef.current = performance.now();

      lasersRef.current.push({
        mesh: beam,
        light: beamLight,
        ttl: weapons.laserLifetime,
        direction,
      });
    },
    [scene, config, environmentMeshes]
  );

  const updateWeapons = useCallback(
    (
      dt: number,
      drones: Drone[],
      onDroneHit: (drone: Drone, index: number) => void,
      onDroneDestroyed: (drone: Drone, index: number) => void,
      spawnSparks: (position: Vector3, count: number) => void
    ) => {
      const { weapons } = config;
      const lasers = lasersRef.current;

      for (let i = lasers.length - 1; i >= 0; i -= 1) {
        const laser = lasers[i];

        // Move laser
        laser.mesh.position.addInPlace(
          laser.direction.scale(weapons.laserSpeed * dt)
        );
        laser.light.position = laser.mesh.position;
        laser.ttl -= dt;

        // Remove expired lasers
        if (laser.ttl <= 0) {
          laser.mesh.dispose();
          laser.light.dispose();
          lasers.splice(i, 1);
          continue;
        }

        // Check collision with drones
        for (let d = drones.length - 1; d >= 0; d -= 1) {
          const drone = drones[d];
          drone.node.computeWorldMatrix(true);
          const inverseWorld = drone.node.getWorldMatrix().clone().invert();
          const laserLocal = Vector3.TransformCoordinates(
            laser.mesh.position,
            inverseWorld
          );
          const offset = laserLocal.subtract(drone.collisionCenter);
          const radii = drone.collisionRadii;
          const nx = offset.x / (radii.x || 1);
          const ny = offset.y / (radii.y || 1);
          const nz = offset.z / (radii.z || 1);
          const inside = nx * nx + ny * ny + nz * nz <= 1;

          if (inside) {
            drone.health -= 1;
            spawnSparks(drone.node.getAbsolutePosition(), SPARK_COUNT_ON_HIT);

            // Remove laser
            laser.mesh.dispose();
            laser.light.dispose();
            lasers.splice(i, 1);

            if (drone.health <= 0) {
              spawnSparks(
                drone.node.getAbsolutePosition(),
                SPARK_COUNT_ON_DESTROY
              );
              onDroneDestroyed(drone, d);
            } else {
              onDroneHit(drone, d);
            }

            break;
          }
        }
      }
    },
    [config]
  );

  return {
    fireLaser,
    updateWeapons,
    lastShotTime: lastShotTimeRef,
  };
};
