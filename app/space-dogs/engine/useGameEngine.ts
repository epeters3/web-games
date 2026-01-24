import { useEffect, useRef, useState } from "react";
import {
  CascadedShadowGenerator,
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
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders";
import type {
  CelestialBody,
  CollisionSphere,
  EnvironmentState,
  LevelConfig,
  LightConfig,
} from "./types";
import {
  boundsToCollision,
  getBoundsFromMeshes,
  refreshMeshBounds,
} from "./bounds";

export interface GameEngineResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  engine: Engine | null;
  scene: Scene | null;
  glow: GlowLayer | null;
  environmentState: EnvironmentState;
  assetsLoaded: boolean;
}

const createLight = (
  config: LightConfig,
  scene: Scene
): { shadowGenerator?: ShadowGenerator } => {
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
      return {};
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
      light.position = new Vector3(
        -config.direction[0],
        -config.direction[1],
        -config.direction[2]
      ).scale(400);
      const shadowGenerator = new CascadedShadowGenerator(4096, light);
      shadowGenerator.numCascades = 4;
      shadowGenerator.stabilizeCascades = true;
      shadowGenerator.usePercentageCloserFiltering = true;
      shadowGenerator.bias = 0.0003;
      return { shadowGenerator };
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
      return {};
    }
  }
};

const loadCelestialBody = async (
  body: CelestialBody,
  scene: Scene,
  glow: GlowLayer,
  assetPath: string,
  shadowGenerators: ShadowGenerator[]
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

    const castShadows = body.castShadows !== false;
    const receiveShadows = body.receiveShadows !== false;
    const includeGlow = body.includeGlow !== false;
    meshes.forEach((mesh) => {
      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        castShadows,
        receiveShadows,
        includeGlow,
      };
      mesh.receiveShadows = receiveShadows;
      if (!castShadows) {
        shadowGenerators.forEach((generator) => {
          generator.removeShadowCaster(mesh, true);
        });
      }
    });

    if (!includeGlow) {
      meshes.forEach((mesh) => glow.addExcludedMesh(mesh));
    }

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
  const asteroidContainerRef = useRef<AssetContainer | null>(null);
  const asteroidAssetRef = useRef<string | null>(null);

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
    const shadowGenerators: ShadowGenerator[] = [];
    config.lights.forEach((lightConfig) => {
      const { shadowGenerator } = createLight(lightConfig, scene);
      if (shadowGenerator) {
        shadowGenerators.push(shadowGenerator);
      }
    });

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

    const addMeshToShadows = (mesh: Mesh) => {
      if (mesh.getTotalVertices() <= 0) return;
      const receiveShadows = mesh.metadata?.receiveShadows !== false;
      mesh.receiveShadows = receiveShadows;
      if (mesh.metadata?.castShadows === false) return;
      shadowGenerators.forEach((generator) => {
        generator.addShadowCaster(mesh, true);
      });
    };

    const addMeshToGlow = (mesh: Mesh) => {
      if (mesh.metadata?.includeGlow === false) {
        glow.addExcludedMesh(mesh);
      }
    };

    const meshObserver = scene.onNewMeshAddedObservable.add((mesh) => {
      if (mesh instanceof Mesh) {
        addMeshToShadows(mesh);
        addMeshToGlow(mesh);
      }
    });

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
            assetPath,
            shadowGenerators
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
          try {
            let asteroidContainer = asteroidContainerRef.current;
            if (
              !asteroidContainer ||
              asteroidAssetRef.current !== env.asteroids.asset
            ) {
              if (asteroidContainer) {
                asteroidContainer.dispose();
              }
              asteroidContainer = await LoadAssetContainerAsync(
                env.asteroids.asset,
                scene,
                { rootUrl: assetPath }
              );
              asteroidContainerRef.current = asteroidContainer;
              asteroidAssetRef.current = env.asteroids.asset;
            }

            const templateMeshes = asteroidContainer.meshes.filter(
              (mesh): mesh is Mesh =>
                mesh instanceof Mesh && mesh.getTotalVertices() > 0
            );
            refreshMeshBounds(templateMeshes);
            const templateBounds = getBoundsFromMeshes(templateMeshes);
            const templateCollision = boundsToCollision(templateBounds);
            const templateCenterLocal = templateCollision.center;
            const templateRadius = Math.max(templateCollision.radius, 1);

            // Generate random asteroid positions
            const { count, spawnArea, scaleMin, scaleMax, collisionScale } =
              env.asteroids;
            const spawnCenter = new Vector3(...spawnArea.center);
            const playerStart = new Vector3(...config.player.startPosition);
            const playerKeepout = Math.max(config.player.radius * 2, 2);

            const placedAsteroids: { position: Vector3; radius: number }[] = [];
            const maxPlacementAttempts = 200;
            const overlapPadding = 1.05;

            const getRandomPosition = () => {
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(2 * Math.random() - 1);
              const r = Math.cbrt(Math.random()) * spawnArea.radius;
              const x = r * Math.sin(phi) * Math.cos(theta);
              const y = r * Math.sin(phi) * Math.sin(theta);
              const z = r * Math.cos(phi);
              return spawnCenter.add(new Vector3(x, y, z));
            };

            for (let i = 0; i < count; i++) {
              const scale = scaleMin + Math.random() * (scaleMax - scaleMin);
              const desiredRadius = templateRadius * scale;
              let position = getRandomPosition();
              let hasOverlap = true;

              for (let attempt = 0; attempt < maxPlacementAttempts; attempt++) {
                const overlapsAsteroid = placedAsteroids.some((placed) => {
                  const minDistance =
                    (desiredRadius + placed.radius) * overlapPadding;
                  return position.subtract(placed.position).length() < minDistance;
                });
                const playerDistance = position.subtract(playerStart).length();
                const overlapsPlayer =
                  playerDistance <
                  (desiredRadius + playerKeepout) * overlapPadding;
                hasOverlap = overlapsAsteroid || overlapsPlayer;

                if (!hasOverlap) {
                  break;
                }

                position = getRandomPosition();
              }
              if (hasOverlap) {
                continue;
              }

              // Random rotation
              const rotation = new Vector3(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
              );

              const root = new TransformNode(`asteroid-${i}`, scene);
              root.position = position.clone();
              root.scaling = new Vector3(scale, scale, scale);
              root.rotation = rotation.clone();

              const instanced = asteroidContainer.instantiateModelsToScene(
                (name) => `asteroid-${i}-${name}`,
                false
              );

              instanced.rootNodes.forEach((node) => {
                node.parent = root;
                node.setEnabled(true);
                node.getChildMeshes(true).forEach((mesh) => {
                  mesh.isVisible = true;
                  mesh.computeWorldMatrix(true);
                  mesh.refreshBoundingInfo(true, true);
                  environmentMeshes.push(mesh as unknown as Mesh);
                });
              });

              root.computeWorldMatrix(true);
              const collisionCenter = Vector3.TransformCoordinates(
                templateCenterLocal,
                root.getWorldMatrix()
              );
              const collisionRadius =
                desiredRadius * (collisionScale ?? 0.5);

              collisionBodies.push({
                center: [
                  collisionCenter.x,
                  collisionCenter.y,
                  collisionCenter.z,
                ],
                radius: collisionRadius,
              });

              placedAsteroids.push({ position, radius: desiredRadius });
            }

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
                assetPath,
                shadowGenerators
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
                assetPath,
                shadowGenerators
              );
              environmentMeshes.push(...result.meshes);
            }
          }
          break;
        }
      }

      if (isMounted) {
        environmentMeshes.forEach((mesh) => addMeshToShadows(mesh));
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
      starBase.metadata = { ...(starBase.metadata ?? {}), includeGlow: false };
      addMeshToGlow(starBase);

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
      if (meshObserver) {
        scene.onNewMeshAddedObservable.remove(meshObserver);
      }
      if (asteroidContainerRef.current) {
        asteroidContainerRef.current.dispose();
        asteroidContainerRef.current = null;
        asteroidAssetRef.current = null;
      }
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
