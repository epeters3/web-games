import { useRef, useCallback } from "react";
import {
  Color3,
  GlowLayer,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Explosion, SparkParticle } from "./types";
import {
  EXPLOSION_DIAMETER,
  EXPLOSION_COLOR,
  EXPLOSION_DURATION,
  SPARK_DIAMETER,
  SPARK_COLOR,
  SPARK_DURATION,
  SPARK_VELOCITY_SPREAD,
} from "./constants";

export interface EffectsResult {
  spawnExplosion: (position: Vector3) => void;
  spawnSparks: (position: Vector3, count: number) => void;
  updateEffects: (dt: number) => void;
}

export const useEffects = (
  scene: Scene | null,
  glow: GlowLayer | null
): EffectsResult => {
  const explosionsRef = useRef<Explosion[]>([]);
  const sparksRef = useRef<SparkParticle[]>([]);

  const spawnExplosion = useCallback(
    (position: Vector3) => {
      if (!scene || !glow) return;

      const blast = MeshBuilder.CreateSphere(
        "explosion",
        { diameter: EXPLOSION_DIAMETER, segments: 8 },
        scene
      );
      blast.position.copyFrom(position);

      const blastMat = new StandardMaterial("explosion-mat", scene);
      blastMat.emissiveColor = new Color3(...EXPLOSION_COLOR);
      blastMat.alpha = 0.9;
      blastMat.disableLighting = true;
      blast.material = blastMat;

      glow.addIncludedOnlyMesh(blast);
      explosionsRef.current.push({ mesh: blast, ttl: EXPLOSION_DURATION });
    },
    [scene, glow]
  );

  const spawnSparks = useCallback(
    (position: Vector3, count: number) => {
      if (!scene || !glow) return;

      for (let i = 0; i < count; i += 1) {
        const spark = MeshBuilder.CreateSphere(
          "spark",
          { diameter: SPARK_DIAMETER, segments: 6 },
          scene
        );
        spark.position.copyFrom(position);

        const sparkMat = new StandardMaterial("spark-mat", scene);
        sparkMat.emissiveColor = new Color3(...SPARK_COLOR);
        sparkMat.alpha = 0.9;
        sparkMat.disableLighting = true;
        spark.material = sparkMat;

        glow.addIncludedOnlyMesh(spark);

        const velocity = new Vector3(
          (Math.random() - 0.5) * SPARK_VELOCITY_SPREAD,
          (Math.random() - 0.5) * SPARK_VELOCITY_SPREAD,
          (Math.random() - 0.5) * SPARK_VELOCITY_SPREAD
        );
        sparksRef.current.push({ mesh: spark, ttl: SPARK_DURATION, velocity });
      }
    },
    [scene, glow]
  );

  const updateEffects = useCallback((dt: number) => {
    // Update explosions
    const explosions = explosionsRef.current;
    for (let e = explosions.length - 1; e >= 0; e -= 1) {
      const explosion = explosions[e];
      explosion.ttl -= dt;

      const life = Math.max(explosion.ttl, 0);
      const scale = 1 + (EXPLOSION_DURATION - life) * 2.2;
      explosion.mesh.scaling.setAll(scale);

      const mat = explosion.mesh.material as StandardMaterial;
      if (mat) {
        mat.alpha = Math.max(0, life / EXPLOSION_DURATION);
      }

      if (explosion.ttl <= 0) {
        explosion.mesh.dispose();
        explosions.splice(e, 1);
      }
    }

    // Update sparks
    const sparks = sparksRef.current;
    for (let p = sparks.length - 1; p >= 0; p -= 1) {
      const spark = sparks[p];
      spark.mesh.position.addInPlace(spark.velocity.scale(dt));
      spark.velocity.scaleInPlace(0.92);
      spark.ttl -= dt;

      const mat = spark.mesh.material as StandardMaterial;
      if (mat) {
        mat.alpha = Math.max(0, spark.ttl / SPARK_DURATION);
      }

      if (spark.ttl <= 0) {
        spark.mesh.dispose();
        sparks.splice(p, 1);
      }
    }
  }, []);

  return {
    spawnExplosion,
    spawnSparks,
    updateEffects,
  };
};
