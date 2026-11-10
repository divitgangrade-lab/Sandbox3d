/** Small, allocation-light math helpers shared by simulation, catalog and renderer. */

export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export const V3 = {
  add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  },
  sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },
  scale(a: Vec3, s: number): Vec3 {
    return [a[0] * s, a[1] * s, a[2] * s];
  },
  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
  lengthSq(a: Vec3): number {
    return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
  },
  length(a: Vec3): number {
    return Math.sqrt(V3.lengthSq(a));
  },
  normalize(a: Vec3): Vec3 {
    const len = V3.length(a);
    return len > 1e-9 ? [a[0] / len, a[1] / len, a[2] / len] : [0, 1, 0];
  },
  distance(a: Vec3, b: Vec3): number {
    return V3.length(V3.sub(a, b));
  },
  lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  },
  /** Rotates a vector by a quaternion. */
  rotate(q: Quat, v: Vec3): Vec3 {
    const [qx, qy, qz, qw] = q;
    const ix = qw * v[0] + qy * v[2] - qz * v[1];
    const iy = qw * v[1] + qz * v[0] - qx * v[2];
    const iz = qw * v[2] + qx * v[1] - qy * v[0];
    const iw = -qx * v[0] - qy * v[1] - qz * v[2];
    return [
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx,
    ];
  },
} as const;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function quatFromEuler(x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  // Order XYZ, matching Three.js Euler defaults.
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

export function quatFromY(yaw: number): Quat {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

export function quatInverse(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

/** Quaternion that rotates local +Z onto `dir`. */
export function quatFromZDirection(dir: Vec3): Quat {
  const d = V3.normalize(dir);
  if (d[2] < -0.9999) return [0, 1, 0, 0];
  if (d[2] > 0.9999) return [0, 0, 0, 1];
  const axis: Vec3 = [-d[1], d[0], 0];
  const w = 1 + d[2];
  const len = Math.hypot(axis[0], axis[1], axis[2], w);
  return [axis[0] / len, axis[1] / len, axis[2] / len, w / len];
}

export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Deterministic, fast PRNG (mulberry32). */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

export function approximately(a: number, b: number, epsilon = 1e-4): boolean {
  return Math.abs(a - b) <= epsilon;
}
