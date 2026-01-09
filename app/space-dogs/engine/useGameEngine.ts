import { useEffect, useRef, useState } from "react";
import {
  Color3,
  Color4,
  DirectionalLight,
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
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders";
import type {
  CelestialBody,
  CollisionSphere,
  EnvironmentState,
  LevelConfig,
  LightConfig,
} from "./types";

export interface GameEngineResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  engine: Engine | null;
  scene: Scene | null;
  glow: GlowLayer | null;
  environmentState: EnvironmentState;
  assetsLoaded: boolean;
}

const createLight = (config: LightConfig, scene: Scene): void => {
  switch (config.type) {
    case "point": {
      const light = new PointLight(
        "pointLight",
        new Vector3(...config.position),
        scene
      );
      light.intensity = config.intensity;
      light.range = config.range;
      light.diffuse = new Color3(...config.diffuse);
      light.specular = new Color3(...config.specular);
      break;
    }
    case "directional": {
      const light = new DirectionalLight(
        "dirLight",
        new Vector3(...config.direction),
        scene
      );
      light.intensity = config.intensity;
      light.diffuse = new Color3(...config.diffuse);
      light.specular = new Color3(...config.specular);
      break;
    }
    case "hemisphere": {
      const light = new HemisphericLight(
        "hemiLight",
        new Vector3(...config.direction),
        scene
      );
      light.intensity = config.intensity;
      if (config.diffuse) {
        light.diffuse = new Color3(...config.diffuse);
      }
      if (config.groundColor) {
        light.groundColor = new Color3(...config.groundColor);
      }
      break;
    }
  }
};

const loadCelestialBody = async (
  body: CelestialBody,
  scene: Scene,
  glow: GlowLayer,
  assetPath: string
): Promise<{ meshes: Mesh[]; collision?: CollisionSphere }> => {
  try {
    const result = await SceneLoader.ImportMeshAsync(
      "",
      assetPath,
      body.asset,
      scene
    );

    const root =
      result.meshes.find((mesh) => mesh.parent === null) ?? result.meshes[0];

    if (root) {
      root.position = new Vector3(...body.position);
      root.scaling = new Vector3(body.scale, body.scale, body.scale);

      if (body.rotation) {
        root.rotation = new Vector3(...body.rotation);
      }
    }

    const meshes = result.meshes.filter(
      (mesh): mesh is Mesh =>
        mesh instanceof Mesh && mesh.getTotalVertices() > 0
    );

    meshes.forEach((mesh) => glow.addIncludedOnlyMesh(mesh));

    // Adjust materials if specified
    if (body.emissiveScale !== undefined || body.diffuseScale !== undefined) {
      meshes.forEach((mesh) => {
        const material = mesh.material as StandardMaterial | null;
        if (!material) return;
        if (body.emissiveScale !== undefined && material.emissiveColor) {
          material.emissiveColor = material.emissiveColor.scale(
            body.emissiveScale
          );
        }
        if (body.diffuseScale !== undefined && material.diffuseColor) {
          material.diffuseColor = material.diffuseColor.scale(
            body.diffuseScale
          );
        }
      });
    }

    // Calculate collision sphere if needed
    let collision: CollisionSphere | undefined;
    if (body.hasCollision && root) {
      root.computeWorldMatrix(true);
      const bounds = root.getHierarchyBoundingVectors(true);
      const center = bounds.min.add(bounds.max).scale(0.5);
      const extent = bounds.max.subtract(bounds.min);
      const radius = Math.max(extent.x, extent.y, extent.z) * 0.5;

      collision = {
        center: [center.x, center.y, center.z],
        radius,
      };
    }

    return { meshes, collision };
  } catch (error) {
    console.error(`Failed to load ${body.asset}`, error);
    return { meshes: [] };
  }
};

export const useGameEngine = (
  config: LevelConfig,
  onReady?: () => void
): GameEngineResult => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const glowRef = useRef<GlowLayer | null>(null);

  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [environmentState, setEnvironmentState] = useState<EnvironmentState>({
    collisionBodies: [],
    centerPoint: new Vector3(0, 0, 0),
    environmentMeshes: [],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setAssetsLoaded(false);

    const assetRoot = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
      /\/$/,
      ""
    );
    const assetPath = assetRoot ? `${assetRoot}/` : "/";

    // Create engine and scene
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(...config.skyColor);

    engineRef.current = engine;
    sceneRef.current = scene;

    // Ambient lighting (always add a dim hemisphere light)
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = config.ambientIntensity;

    // Glow layer
    const glow = new GlowLayer("glow", scene, { blurKernelSize: 64 });
    glow.intensity = config.glowIntensity;
    glowRef.current = glow;

    // Create lights from config
    config.lights.forEach((lightConfig) => createLight(lightConfig, scene));

    // Track loading state
    let isMounted = true;
    const pendingLoads = { environment: false, stars: false };

    const checkAllLoaded = () => {
      if (pendingLoads.environment && pendingLoads.stars && isMounted) {
        setAssetsLoaded(true);
        onReady?.();
      }
    };

    const markLoaded = (key: "environment" | "stars") => {
      pendingLoads[key] = true;
      checkAllLoaded();
    };

    // Load environment based on type
    const loadEnvironment = async () => {
      const env = config.environment;
      const collisionBodies: CollisionSphere[] = [];
      const environmentMeshes: Mesh[] = [];
      let centerPoint = new Vector3(0, 0, 0);

      switch (env.type) {
        case "single-body": {
          // Load single celestial body (planet, moon, etc.)
          const bodyConfig: CelestialBody = {
            ...env.body,
            hasCollision: true, // Always has collision for single body
          };

          const result = await loadCelestialBody(
            bodyConfig,
            scene,
            glow,
            assetPath
          );

          environmentMeshes.push(...result.meshes);

          if (result.collision) {
            collisionBodies.push(result.collision);
            centerPoint = new Vector3(...result.collision.center);
          } else {
            centerPoint = new Vector3(...env.body.position);
          }
          break;
        }

        case "asteroid-field": {
          // Load asteroid template
          try {
            const asteroidResult = await SceneLoader.ImportMeshAsync(
              "",
              assetPath,
              env.asteroids.asset,
              scene
            );

            const asteroidRoot =
              asteroidResult.meshes.find((m) => m.parent === null) ??
              asteroidResult.meshes[0];

            // Hide original mesh
            asteroidResult.meshes.forEach((mesh) => {
              mesh.isVisible = false;
            });

            // Get template mesh for instancing
            const templateMeshes = asteroidResult.meshes.filter(
              (mesh): mesh is Mesh => mesh instanceof Mesh
            );

            // Generate random asteroid positions
            const { count, spawnArea, scaleMin, scaleMax, collisionScale } =
              env.asteroids;
            const spawnCenter = new Vector3(...spawnArea.center);

            for (let i = 0; i < count; i++) {
              // Random position within sphere
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(2 * Math.random() - 1);
              const r = Math.cbrt(Math.random()) * spawnArea.radius;

              const x = r * Math.sin(phi) * Math.cos(theta);
              const y = r * Math.sin(phi) * Math.sin(theta);
              const z = r * Math.cos(phi);

              const position = spawnCenter.add(new Vector3(x, y, z));
              const scale = scaleMin + Math.random() * (scaleMax - scaleMin);

              // Random rotation
              const rotation = new Vector3(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
              );

              // Create instances
              templateMeshes.forEach((mesh) => {
                const instance = mesh.createInstance(
                  `asteroid-${i}-${mesh.name}`
                );
                instance.position = position.clone();
                instance.scaling = new Vector3(scale, scale, scale);
                instance.rotation = rotation.clone();
                environmentMeshes.push(instance as unknown as Mesh);
              });

              // Add collision sphere
              const collisionRadius = scale * (collisionScale ?? 0.5);
              collisionBodies.push({
                center: [position.x, position.y, position.z],
                radius: collisionRadius,
              });
            }

            // Dispose original root
            asteroidRoot?.dispose(false, true);

            // Use spawn center as environment center
            centerPoint = spawnCenter.clone();
          } catch (error) {
            console.error(`Failed to load asteroid asset`, error);
          }

          // Load any static bodies
          if (env.staticBodies) {
            for (const body of env.staticBodies) {
              const result = await loadCelestialBody(
                body,
                scene,
                glow,
                assetPath
              );
              environmentMeshes.push(...result.meshes);
              if (result.collision) {
                collisionBodies.push(result.collision);
              }
            }
          }
          break;
        }

        case "empty": {
          // No collision bodies, just decorations
          if (env.decorations) {
            for (const decoration of env.decorations) {
              const result = await loadCelestialBody(
                decoration,
                scene,
                glow,
                assetPath
              );
              environmentMeshes.push(...result.meshes);
            }
          }
          break;
        }
      }

      if (isMounted) {
        setEnvironmentState({
          collisionBodies,
          centerPoint,
          environmentMeshes,
        });
      }

      markLoaded("environment");
    };

    // Create stars
    const createStars = () => {
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

      const { count, radiusMin, radiusMax, scaleMin, scaleMax } = config.stars;
      const matrices = new Float32Array(count * 16);

      for (let i = 0; i < count; i += 1) {
        const radius = radiusMin + Math.random() * (radiusMax - radiusMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        const scale = scaleMin + Math.random() * (scaleMax - scaleMin);

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

      markLoaded("stars");
    };

    void loadEnvironment();
    createStars();

    // Custom level setup
    config.customSetup?.(scene);

    // Handle resize
    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      scene.dispose();
      engine.dispose();
      engineRef.current = null;
      sceneRef.current = null;
      glowRef.current = null;
    };
  }, [config, onReady]);

  return {
    canvasRef,
    engine: engineRef.current,
    scene: sceneRef.current,
    glow: glowRef.current,
    environmentState,
    assetsLoaded,
  };
};
