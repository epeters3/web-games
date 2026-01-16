# space-dogs

3D space flight simulator focused on smooth flight, readable combat, and
striking space vistas. The codebase favors clear separation between configuration
and runtime systems, with Babylon.js handling rendering and transforms.

## Core Design Principles

- Spatial consistency: 1 Babylon.js unit == 1 meter, and scale values are
  treated as real-world meters to keep physics and visuals aligned.
- Configuration-driven levels: gameplay and scene composition live in data
  (`app/space-dogs/levels`) while runtime behavior stays in the engine.
- Visual clarity: glow, emissive materials, and directional lighting are used to
  guide player focus without overloading the scene with post effects.
- Performance through reuse: asset hierarchies are instantiated from containers
  instead of being rebuilt manually.

## Architecture Overview

- `app/space-dogs/engine/useGameEngine.ts` owns scene setup: lights, glow, stars,
  environment loading, and shadow configuration.
- `app/space-dogs/levels/*` defines per-level content: environment, lights,
  player, enemies, and win conditions.
- `app/space-dogs/engine/useEnemies.ts` handles enemy loading, instancing,
  movement, and collision state.
- `app/space-dogs/engine/useWeapons.ts` handles laser spawning and hit tests.

## Rendering and Lighting

- Directional light shadows use `CascadedShadowGenerator` with PCF to keep large
  asteroid fields crisp without pixelation.
- The GlowLayer expects occluders to be rendered in the glow pass. Do not use
  `addIncludedOnlyMesh` for normal meshes; instead, exclude only meshes that
  should never glow (stars, debug elements).
- `glowIntensity` is a global multiplier on GlowLayer output.
- `emissiveScale` scales a material's emissive color and drives stronger glow.
- `diffuseScale` scales the diffuse (albedo) color only.
- Decorative bodies (suns, distant props) should opt out of shadow casting and
  receiving to prevent global shadow artifacts.

## Asset Instancing and Lifetime

- Enemy ships should be instantiated via
  `AssetContainer.instantiateModelsToScene` to preserve full GLB hierarchies
  (meshes + transform nodes).
- Keep the enemy `AssetContainer` alive while clones/instances exist; disposing
  it can invalidate shared materials and make ships lose their colors/lights.
- When removing a drone, do not dispose shared materials or textures (use
  `dispose(false, false)`).

## Collision Model (Enemy Hits)

- Enemy hits use an oriented ellipsoid in drone local space instead of a single
  fixed radius.
- The ellipsoid is derived from per-drone hierarchy bounds transformed into
  local space and scaled per axis by the drone's transform.
- After instantiating a ship, refresh mesh bounding info before computing local
  bounds to avoid stale or zero extents.

## Debugging Conventions

- Press `C` to toggle collision debug visuals. Environment spheres are orange;
  enemy collision ellipsoids are cyan and follow the ship's transform.

## Core Learnings

- GlowLayer occlusion only works when occluders are part of the glow pass;
  prefer exclusions over inclusion lists.
- GLB assets often rely on transform node hierarchies; instancing meshes alone
  drops offsets and breaks silhouettes.
- Shared materials are common in instanced assets; never dispose them on a
  per-entity removal path.
- For accurate hits, compute collision volumes from the instantiated hierarchy
  instead of hard-coded radii.
