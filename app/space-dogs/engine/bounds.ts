import { AbstractMesh, Matrix, TransformNode, Vector3 } from "@babylonjs/core";

export interface Bounds {
  min: Vector3;
  max: Vector3;
}

/**
 * Refreshes world matrices and bounding info for a set of meshes so subsequent
 * bounds queries reflect the latest transforms (especially after instancing).
 * Use this before computing collision volumes to avoid stale or zero extents.
 */
export const refreshMeshBounds = (meshes: AbstractMesh[]): void => {
  meshes.forEach((mesh) => {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true, true);
  });
};

/**
 * Computes axis-aligned bounds for a mesh set, optionally in a target space.
 * Pass `worldToLocal` when you need bounds in a parent/local coordinate system
 * (e.g., for local-space collision ellipsoids).
 */
export const getBoundsFromMeshes = (
  meshes: AbstractMesh[],
  worldToLocal?: Matrix
): Bounds => {
  if (meshes.length === 0) {
    return { min: Vector3.Zero(), max: Vector3.Zero() };
  }

  const min = new Vector3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY
  );
  const max = new Vector3(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  );

  meshes.forEach((mesh) => {
    const box = mesh.getBoundingInfo().boundingBox;
    box.vectorsWorld.forEach((corner) => {
      const point = worldToLocal
        ? Vector3.TransformCoordinates(corner, worldToLocal)
        : corner;
      min.copyFrom(Vector3.Minimize(min, point));
      max.copyFrom(Vector3.Maximize(max, point));
    });
  });

  return { min, max };
};

/**
 * Computes local-space bounds for a transform node by aggregating its child
 * meshes. This is the canonical way to derive collision shapes that follow
 * a node's hierarchy offsets and scaling.
 */
export const getLocalBounds = (root: TransformNode): Bounds => {
  root.computeWorldMatrix(true);
  const inverseRoot = root.getWorldMatrix().clone().invert();
  const meshes = root.getChildMeshes(true);
  refreshMeshBounds(meshes);
  return getBoundsFromMeshes(meshes, inverseRoot);
};

/**
 * Converts bounds to a center point plus radii, returning a max-radius helper
 * for sphere collisions while preserving per-axis radii for ellipsoids.
 */
export const boundsToCollision = (
  bounds: Bounds
): { center: Vector3; radii: Vector3; radius: number } => {
  const center = bounds.min.add(bounds.max).scale(0.5);
  const extent = bounds.max.subtract(bounds.min);
  const radii = new Vector3(extent.x * 0.5, extent.y * 0.5, extent.z * 0.5);
  const radius = Math.max(radii.x, radii.y, radii.z);
  return { center, radii, radius };
};
