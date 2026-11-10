/** World-space bounds for selection outlines, saved independently of Three.js. */

import { halfExtents, rotatedExtents } from '../catalog/shapes';
import { quatMul, V3, type Quat, type Vec3 } from '../core/math';
import type { SimEntity } from './types';

export interface EntityBounds {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  radius: number;
}

/**
 * Exact AABB of every visual primitive after body and part rotations. The old hover code only
 * added unrotated local offsets to the body centre, which drifted badly once a body tipped over.
 */
export function entityWorldBounds(entity: SimEntity): EntityBounds {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const simBody of entity.bodies) {
    const t = simBody.body.translation();
    const q = simBody.body.rotation();
    const bodyQuat: Quat = [q.x, q.y, q.z, q.w];
    for (const part of simBody.parts) {
      const half = halfExtents(part.shape);
      const worldQuat = quatMul(bodyQuat, part.localQuat);
      const ext = rotatedExtents(half, worldQuat);
      const offset = V3.rotate(bodyQuat, part.localPos);
      const x = t.x + offset[0];
      const y = t.y + offset[1];
      const z = t.z + offset[2];
      minX = Math.min(minX, x - ext[0]);
      minY = Math.min(minY, y - ext[1]);
      minZ = Math.min(minZ, z - ext[2]);
      maxX = Math.max(maxX, x + ext[0]);
      maxY = Math.max(maxY, y + ext[1]);
      maxZ = Math.max(maxZ, z + ext[2]);
    }
  }

  if (!Number.isFinite(minX)) {
    const t = entity.bodies[0]?.body.translation();
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: t ? [t.x, t.y, t.z] : [0, 1, 0],
      radius: 0.6,
    };
  }

  const min: Vec3 = [minX, minY, minZ];
  const max: Vec3 = [maxX, maxY, maxZ];
  return {
    min,
    max,
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    radius: Math.max(0.4, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2),
  };
}
