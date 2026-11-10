/** Authoring helpers that turn readable dimensions into physics/visual primitives. */

import type { PrimitiveShape, ShapeBounds, ShapePart } from './types';
import type { MaterialName } from './materials';
import { quatFromEuler, type Quat, type Vec3 } from '../core/math';

export interface PartOptions {
  pos?: Vec3;
  rot?: Vec3;
  color?: string;
  material?: MaterialName;
}

function makePart(shape: PrimitiveShape, opts: PartOptions = {}): ShapePart {
  return { shape, pos: opts.pos, rot: opts.rot, color: opts.color, material: opts.material };
}

/** Box with full width/height/depth. */
export function box(w: number, h: number, d: number, opts?: PartOptions): ShapePart {
  return makePart({ kind: 'box', hx: w / 2, hy: h / 2, hz: d / 2 }, opts);
}

export function ball(r: number, opts?: PartOptions): ShapePart {
  return makePart({ kind: 'sphere', r }, opts);
}

/** Capsule whose cylindrical section is `length` (total height = length + 2r). */
export function capsule(r: number, length: number, opts?: PartOptions): ShapePart {
  return makePart({ kind: 'capsule', r, hh: Math.max(length / 2, 0.0001) }, opts);
}

/** Cylinder with full height. */
export function cyl(r: number, height: number, opts?: PartOptions): ShapePart {
  return makePart({ kind: 'cylinder', r, hh: Math.max(height / 2, 0.0001) }, opts);
}

/** Cone with full height. */
export function cone(r: number, height: number, opts?: PartOptions): ShapePart {
  return makePart({ kind: 'cone', r, hh: Math.max(height / 2, 0.0001) }, opts);
}

export function hull(points: number[], opts?: PartOptions): ShapePart {
  return makePart({ kind: 'hull', points }, opts);
}

export function moved(part: ShapePart, pos: Vec3, rot?: Vec3): ShapePart {
  return { ...part, pos, rot: rot ?? part.rot };
}

export function tallCylinder(r: number, height: number, opts?: PartOptions): ShapePart {
  return cyl(r, height, opts);
}

/** Approximate additive bounds of a set of parts. */
export function partsBounds(parts: readonly ShapePart[]): ShapeBounds {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const part of parts) {
    const p = part.pos ?? [0, 0, 0];
    const [ex, ey, ez] = partExtents(part);
    minX = Math.min(minX, p[0] - ex);
    minY = Math.min(minY, p[1] - ey);
    minZ = Math.min(minZ, p[2] - ez);
    maxX = Math.max(maxX, p[0] + ex);
    maxY = Math.max(maxY, p[1] + ey);
    maxZ = Math.max(maxZ, p[2] + ez);
  }

  if (!Number.isFinite(minX)) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], radius: 0.5, halfHeight: 0.5 };
  }

  const center: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const radius = Math.max(Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2, 0.05);
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center,
    radius,
    halfHeight: Math.max((maxY - minY) / 2, 0.05),
  };
}

/** Axis-aligned half extents of a primitive, ignoring rotation. */
export function halfExtents(shape: PrimitiveShape): Vec3 {
  switch (shape.kind) {
    case 'box':
      return [shape.hx, shape.hy, shape.hz];
    case 'sphere':
      return [shape.r, shape.r, shape.r];
    case 'capsule':
      return [shape.r, shape.hh + shape.r, shape.r];
    case 'cylinder':
      return [shape.r, shape.hh, shape.r];
    case 'cone':
      return [shape.r, shape.hh, shape.r];
    case 'hull': {
      let ex = 0;
      let ey = 0;
      let ez = 0;
      for (let i = 0; i + 2 < shape.points.length; i += 3) {
        ex = Math.max(ex, Math.abs(shape.points[i]!));
        ey = Math.max(ey, Math.abs(shape.points[i + 1]!));
        ez = Math.max(ez, Math.abs(shape.points[i + 2]!));
      }
      return [Math.max(ex, 0.02), Math.max(ey, 0.02), Math.max(ez, 0.02)];
    }
  }
}

/** World-axis half extents of a part after applying its local rotation. */
export function partExtents(part: ShapePart): Vec3 {
  const [hx, hy, hz] = halfExtents(part.shape);
  if (!part.rot || (part.rot[0] === 0 && part.rot[1] === 0 && part.rot[2] === 0)) {
    return [hx, hy, hz];
  }
  return rotatedExtents([hx, hy, hz], quatFromEuler(part.rot[0], part.rot[1], part.rot[2]));
}

export function rotatedExtents(half: Vec3, q: Quat): Vec3 {
  const [x, y, z, w] = q;
  const m00 = 1 - 2 * (y * y + z * z);
  const m01 = 2 * (x * y - z * w);
  const m02 = 2 * (x * z + y * w);
  const m10 = 2 * (x * y + z * w);
  const m11 = 1 - 2 * (x * x + z * z);
  const m12 = 2 * (y * z - x * w);
  const m20 = 2 * (x * z - y * w);
  const m21 = 2 * (y * z + x * w);
  const m22 = 1 - 2 * (x * x + y * y);
  const hx = half[0];
  const hy = half[1];
  const hz = half[2];
  return [
    Math.abs(m00) * hx + Math.abs(m01) * hy + Math.abs(m02) * hz,
    Math.abs(m10) * hx + Math.abs(m11) * hy + Math.abs(m12) * hz,
    Math.abs(m20) * hx + Math.abs(m21) * hy + Math.abs(m22) * hz,
  ];
}

export function validateShape(shape: PrimitiveShape): string[] {
  const errors: string[] = [];
  const positive = (name: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) errors.push(`${name} must be a positive number`);
  };
  switch (shape.kind) {
    case 'box':
      positive('hx', shape.hx);
      positive('hy', shape.hy);
      positive('hz', shape.hz);
      break;
    case 'sphere':
      positive('r', shape.r);
      break;
    case 'capsule':
      positive('r', shape.r);
      positive('hh', shape.hh);
      break;
    case 'cylinder':
    case 'cone':
      positive('r', shape.r);
      positive('hh', shape.hh);
      break;
    case 'hull':
      if (!Array.isArray(shape.points) || shape.points.length < 12 || shape.points.length % 3 !== 0) {
        errors.push('hull needs at least 4 xyz points');
      } else if (shape.points.some((v) => !Number.isFinite(v))) {
        errors.push('hull points must be finite');
      }
      break;
  }
  return errors;
}

/** Simple convex hull point cloud from a box, useful for chunky rocks. */
export function rockPoints(
  radius: number,
  jitter = 0.25,
  seed = 1234,
): number[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Four rings of points give a believable low-poly boulder without external assets.
  const points: number[] = [];
  const rings = [0.25, 0.65, 1];
  for (const ring of rings) {
    const count = ring === 1 ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = radius * ring * (1 - jitter / 2 + rnd() * jitter);
      const y = (1 - ring) * radius * 0.9 + rnd() * radius * 0.15 - radius * 0.4;
      points.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
    }
  }
  points.push(0, radius * 0.85, 0, 0, -radius * 0.45, 0);
  return points;
}
