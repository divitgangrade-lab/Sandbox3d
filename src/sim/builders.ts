/**
 * Pure builders that turn a declarative ObjectDef into a plan of bodies, parts and joints.
 * Plans use entity-local, unscaled coordinates; SimWorld applies position, rotation and scale.
 */

import type { ClothConfig, ObjectDef, PrimitiveShape, ShapePart, SoftConfig } from '../catalog/types';
import type { MaterialName } from '../catalog/materials';
import { DEFAULT_COLOR } from '../catalog/materials';
import { box, capsule, halfExtents, rotatedExtents } from '../catalog/shapes';
import type { BuildPlan, PlannedBody, PlannedJoint, PlannedPart } from './types';
import type { ShapeBounds } from '../catalog/types';
import { quatFromEuler, quatMul, V3, type Quat, type Rng, type Vec3 } from '../core/math';
import { MAX_CLOTH_PARTICLES, MAX_FLUID_PARTICLES, MAX_SOFT_PARTICLES } from '../core/config';

const IDENTITY: Quat = [0, 0, 0, 1];

function part(
  shape: PrimitiveShape,
  options: { pos?: Vec3; rot?: Vec3; color?: string; material?: MaterialName } = {},
): PlannedPart {
  return { shape, ...options };
}

function body(
  pos: Vec3,
  parts: PlannedPart[],
  options: { primary?: boolean; fixed?: boolean; ccd?: boolean; quat?: Quat } = {},
): PlannedBody {
  return { pos, parts, ...options };
}

function colorAt(def: ObjectDef, index: number, fallback: string): string {
  const list = def.colors;
  if (!list || list.length === 0) return fallback;
  return list[index % list.length]!;
}

export function buildPlan(def: ObjectDef, baseColor: string, rng: Rng): BuildPlan {
  switch (def.kind ?? 'rigid') {
    case 'ragdoll':
      return buildRagdoll(def, baseColor);
    case 'vehicle':
      return buildVehicle(def, baseColor);
    case 'soft':
      return buildSoft(def, baseColor);
    case 'cloth':
      return buildCloth(def, baseColor);
    case 'fluid':
      return buildFluid(def, baseColor, rng);
    case 'rigid':
    default:
      return buildRigid(def, baseColor);
  }
}

function buildRigid(def: ObjectDef, baseColor: string): BuildPlan {
  const parts: PlannedPart[] = (def.parts ?? []).map((p: ShapePart) => ({
    shape: p.shape,
    pos: p.pos,
    rot: p.rot,
    color: p.color ?? baseColor,
    material: p.material ?? def.material,
  }));
  return {
    bodies: [body([0, 0, 0], parts, { primary: true, ccd: def.tags?.includes('fast') })],
    joints: [],
    motorJointIndices: [],
  };
}

function buildRagdoll(def: ObjectDef, baseColor: string): BuildPlan {
  const cfg = def.ragdoll ?? {};
  const h = (cfg.height ?? 1.72) / 1.72;
  const limb = cfg.limbScale ?? 1;
  const headColor = cfg.headColor ?? colorAt(def, 0, baseColor);
  const bodies: PlannedBody[] = [];
  const joints: PlannedJoint[] = [];

  const pushBody = (pos: Vec3, shape: PrimitiveShape | ShapePart, color: string, primary = false) => {
    const primitive: PrimitiveShape = 'shape' in shape ? shape.shape : shape;
    bodies.push({
      pos,
      parts: [part(primitive, { color })],
      primary,
    });
    return bodies.length - 1;
  };

  const hips = pushBody([0, 0.9 * h, 0], capsule(0.145 * limb, 0.14 * h), colorAt(def, 0, baseColor));
  const torso = pushBody(
    [0, 1.18 * h, 0],
    capsule(0.165 * limb, 0.38 * h),
    colorAt(def, 1, baseColor),
    true,
  );
  const headShape: PrimitiveShape =
    cfg.head === 'box'
      ? { kind: 'box', hx: 0.125 * limb, hy: 0.14 * limb, hz: 0.125 * limb }
      : { kind: 'sphere', r: 0.135 * limb };
  const head = pushBody([0, 1.51 * h, 0], headShape, headColor);

  const upperArms: number[] = [];
  const lowerArms: number[] = [];
  const upperLegs: number[] = [];
  const lowerLegs: number[] = [];
  for (const side of [-1, 1] as const) {
    upperArms.push(
      pushBody(
        [side * 0.255 * h, 1.275 * h, 0],
        capsule(0.055 * limb, 0.24 * h),
        colorAt(def, 2, baseColor),
      ),
    );
    lowerArms.push(
      pushBody(
        [side * 0.255 * h, 1.0 * h, 0],
        capsule(0.048 * limb, 0.24 * h),
        colorAt(def, 3, baseColor),
      ),
    );
    upperLegs.push(
      pushBody(
        [side * 0.105 * h, 0.65 * h, 0],
        capsule(0.08 * limb, 0.27 * h),
        colorAt(def, 4, baseColor),
      ),
    );
    lowerLegs.push(
      pushBody(
        [side * 0.105 * h, 0.33 * h, 0],
        capsule(0.068 * limb, 0.28 * h),
        colorAt(def, 5, baseColor),
      ),
    );
  }

  const bodyPos = (i: number): Vec3 => bodies[i]!.pos;
  const link = (a: number, b: number, point: Vec3) => {
    const pa = bodyPos(a);
    const pb = bodyPos(b);
    joints.push({
      kind: 'spherical',
      a,
      b,
      anchorA: V3.sub(point, pa),
      anchorB: V3.sub(point, pb),
    });
  };

  link(hips, torso, [0, 1.01 * h, 0]);
  link(torso, head, [0, 1.39 * h, 0]);
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? -1 : 1;
    link(torso, upperArms[s]!, [side * 0.24 * h, 1.325 * h, 0]);
    link(upperArms[s]!, lowerArms[s]!, [side * 0.255 * h, 1.13 * h, 0]);
    link(hips, upperLegs[s]!, [side * 0.105 * h, 0.8 * h, 0]);
    link(upperLegs[s]!, lowerLegs[s]!, [side * 0.105 * h, 0.475 * h, 0]);
  }

  return { bodies, joints, motorJointIndices: [] };
}

function buildVehicle(def: ObjectDef, baseColor: string): BuildPlan {
  const cfg = def.vehicle!;
  const chassisParts: PlannedPart[] = (def.parts ?? []).map((p) => ({
    shape: p.shape,
    pos: p.pos,
    rot: p.rot,
    color: p.color ?? baseColor,
    material: p.material ?? def.material,
  }));
  const bodies: PlannedBody[] = [body([0, 0, 0], chassisParts, { primary: true })];
  const joints: PlannedJoint[] = [];
  const motorJointIndices: number[] = [];

  cfg.wheels.forEach((wheel, index) => {
    bodies.push(
      body(
        wheel.pos,
        [
          part(
            { kind: 'cylinder', r: wheel.radius, hh: wheel.width / 2 },
            { rot: [0, 0, Math.PI / 2], color: cfg.wheelColor ?? '#1d2026', material: 'rubber' },
          ),
        ],
        { ccd: true },
      ),
    );
    motorJointIndices.push(joints.length);
    joints.push({
      kind: 'revolute',
      a: 0,
      b: index + 1,
      anchorA: wheel.pos,
      anchorB: [0, 0, 0],
      axis: [1, 0, 0],
    });
  });

  return { bodies, joints, motorJointIndices };
}

function buildSoft(def: ObjectDef, baseColor: string): BuildPlan {
  const cfg: SoftConfig = def.soft ?? { grid: [3, 3, 3], spacing: 0.25, stiffness: 900, damping: 10 };
  let [gx, gy, gz] = cfg.grid.map((n) => Math.max(1, Math.floor(n))) as [number, number, number];
  while (gx * gy * gz > MAX_SOFT_PARTICLES) {
    if (gx >= gy && gx >= gz && gx > 1) gx--;
    else if (gy >= gz && gy > 1) gy--;
    else if (gz > 1) gz--;
    else break;
  }
  const s = cfg.spacing;
  const radius = cfg.radius ?? s * 0.55;
  const bodies: PlannedBody[] = [];
  const count = gx * gy * gz;
  for (let i = 0; i < count; i++) {
    const ix = i % gx;
    const iy = Math.floor(i / gx) % gy;
    const iz = Math.floor(i / (gx * gy));
    bodies.push(
      body(
        [(ix - (gx - 1) / 2) * s, (iy - (gy - 1) / 2) * s, (iz - (gz - 1) / 2) * s],
        [part({ kind: 'sphere', r: radius }, { color: colorAt(def, i, baseColor), material: 'jelly' })],
        { primary: i === Math.floor(count / 2) },
      ),
    );
  }

  const joints: PlannedJoint[] = [];
  const index = (x: number, y: number, z: number) => x + y * gx + z * gx * gy;
  const link = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
    joints.push({
      kind: 'spring',
      a: index(ax, ay, az),
      b: index(bx, by, bz),
      anchorA: [0, 0, 0],
      anchorB: [0, 0, 0],
      restLength: s,
      stiffness: cfg.stiffness,
      damping: cfg.damping,
    });
  };
  for (let z = 0; z < gz; z++) {
    for (let y = 0; y < gy; y++) {
      for (let x = 0; x < gx; x++) {
        if (x + 1 < gx) link(x, y, z, x + 1, y, z);
        if (y + 1 < gy) link(x, y, z, x, y + 1, z);
        if (z + 1 < gz) link(x, y, z, x, y, z + 1);
      }
    }
  }

  return { bodies, joints, motorJointIndices: [] };
}

function buildCloth(def: ObjectDef, baseColor: string): BuildPlan {
  const cfg: ClothConfig = def.cloth ?? {
    grid: [5, 5],
    spacing: 0.3,
    pin: 'corners',
    stiffness: 1000,
    damping: 6,
  };
  let [gw, gh] = cfg.grid.map((n) => Math.max(2, Math.floor(n))) as [number, number];
  while (gw * gh > MAX_CLOTH_PARTICLES) {
    if (gw >= gh) gw--;
    else gh--;
  }
  const s = cfg.spacing;
  const vertical = cfg.vertical ?? false;
  const radius = Math.max(0.025, s * 0.2);
  const positions: Vec3[] = [];
  const bodies: PlannedBody[] = [];
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const x = (i - (gw - 1) / 2) * s;
      const z = (j - (gh - 1) / 2) * s;
      const pos: Vec3 = vertical ? [x, -j * s, 0] : [x, 0, z];
      positions.push(pos);
      const pinned =
        cfg.pin === 'corners'
          ? (i === 0 || i === gw - 1) && (j === 0 || j === gh - 1)
          : j === 0;
      bodies.push(
        body(pos, [part({ kind: 'sphere', r: radius }, { color: colorAt(def, i + j, baseColor) })], {
          fixed: pinned,
          primary: i === Math.floor(gw / 2) && j === Math.floor(gh / 2),
        }),
      );
    }
  }

  const joints: PlannedJoint[] = [];
  const index = (i: number, j: number) => j * gw + i;
  const link = (i1: number, j1: number, i2: number, j2: number, diagonal: boolean) => {
    joints.push({
      kind: 'spring',
      a: index(i1, j1),
      b: index(i2, j2),
      anchorA: [0, 0, 0],
      anchorB: [0, 0, 0],
      restLength: diagonal ? s * Math.SQRT2 : s,
      stiffness: cfg.stiffness * (diagonal ? 0.55 : 1),
      damping: cfg.damping,
    });
  };
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      if (i + 1 < gw) link(i, j, i + 1, j, false);
      if (j + 1 < gh) link(i, j, i, j + 1, false);
      if (i + 1 < gw && j + 1 < gh) {
        link(i, j, i + 1, j + 1, true);
        link(i + 1, j, i, j + 1, true);
      }
    }
  }

  return { bodies, joints, motorJointIndices: [] };
}

function buildFluid(def: ObjectDef, baseColor: string, rng: Rng): BuildPlan {
  const cfg = def.fluid ?? { count: 30, radius: 0.1 };
  const count = Math.max(1, Math.min(Math.floor(cfg.count), MAX_FLUID_PARTICLES));
  const radius = cfg.radius;
  const spread = radius * Math.cbrt(count) * 1.7;
  const bodies: PlannedBody[] = [];
  for (let i = 0; i < count; i++) {
    // Rejection sample a squashed sphere so the blob starts compact.
    let x = 0;
    let y = 0;
    let z = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      x = rng() * 2 - 1;
      y = rng() * 2 - 1;
      z = rng() * 2 - 1;
      if (x * x + y * y + z * z <= 1) break;
    }
    bodies.push(
      body(
        [x * spread, y * spread * 0.7 + spread * 0.35, z * spread],
        [
          part(
            { kind: 'sphere', r: radius },
            { color: colorAt(def, i, baseColor), material: def.material ?? 'water' },
          ),
        ],
        { primary: i === 0 },
      ),
    );
  }
  return { bodies, joints: [], motorJointIndices: [] };
}

/** Approximate local-space bounds of a build plan (ignores hull concavity). */
export function planBounds(plan: BuildPlan): ShapeBounds {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const planned of plan.bodies) {
    const bq = planned.quat ?? IDENTITY;
    for (const plannedPart of planned.parts) {
      const pq = quatMul(bq, quatFromEuler(...(plannedPart.rot ?? [0, 0, 0])));
      const half = halfExtents(plannedPart.shape);
      const ext = rotatedExtents(half, pq);
      const center = V3.add(planned.pos, V3.rotate(bq, plannedPart.pos ?? [0, 0, 0]));
      minX = Math.min(minX, center[0] - ext[0]);
      minY = Math.min(minY, center[1] - ext[1]);
      minZ = Math.min(minZ, center[2] - ext[2]);
      maxX = Math.max(maxX, center[0] + ext[0]);
      maxY = Math.max(maxY, center[1] + ext[1]);
      maxZ = Math.max(maxZ, center[2] + ext[2]);
    }
  }

  if (!Number.isFinite(minX)) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], radius: 0.4, halfHeight: 0.4 };
  }

  const center: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center,
    radius: Math.max(Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2, 0.05),
    halfHeight: Math.max((maxY - minY) / 2, 0.05),
  };
}

/** Used by tests and the spawner to show a preview footprint. */
export function previewShape(def: ObjectDef): PrimitiveShape | null {
  if (def.parts && def.parts.length > 0) return def.parts[0]!.shape;
  if (def.kind === 'fluid') return { kind: 'sphere', r: def.fluid?.radius ?? 0.1 };
  if (def.kind === 'ragdoll') return { kind: 'capsule', r: 0.16, hh: 0.5 };
  if (def.kind === 'soft') return box(0.6, 0.6, 0.6).shape;
  if (def.kind === 'cloth') return box(1.5, 0.05, 1.5).shape;
  return null;
}

void DEFAULT_COLOR;
