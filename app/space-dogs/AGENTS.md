# space-dogs

3D space flight simulator game with beautiful 3D assets, including fights in
asteroid fields, near planets, etc.

## Notes

- 1 Babylon.js size unit == 1 meter.
- Lighting and shadows are configured in
  `app/space-dogs/engine/useGameEngine.ts`, while scene setups live in
  `app/space-dogs/levels`.
- Directional light shadows use `CascadedShadowGenerator` with PCF for smoother
  asteroid shadows in large scenes.
- In asteroid-field levels, add distant visuals like a sun via
  `environment.staticBodies` with high `emissiveScale` and low `diffuseScale` so
  glow handles the sun disc.
- Use `castShadows: false` and `receiveShadows: false` on decorative bodies
  (like suns) to avoid the global shadow setup darkening the scene.
- Imported meshes are added to shadow casters on creation, so when disabling
  shadows for decorative bodies, remove them from shadow generators after load.
- GlowLayer occlusion only works when occluders are rendered in the glow pass,
  so avoid `addIncludedOnlyMesh`; use `addExcludedMesh` only for non-occluding
  meshes (like stars) that should never glow.
- `glowIntensity` is a global multiplier on GlowLayer; it amplifies all glow in
  the scene.
- `emissiveScale` multiplies a mesh material's `emissiveColor`, making the mesh
  itself brighter and feeding a stronger signal into GlowLayer.
- `diffuseScale` multiplies a mesh material's `diffuseColor`, adjusting only the
  diffuse/albedo brightness (not emissive or specular).
