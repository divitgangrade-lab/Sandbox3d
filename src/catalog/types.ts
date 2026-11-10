/**
 * Declarative object definitions. Adding a new object should mean adding one entry
 * in a catalog file — no engine code. Generated kinds (ragdoll/vehicle/soft/cloth/fluid)
 * get their bodies from build configurations instead of `parts`.
 */

import type { MaterialName } from './materials';
import type { Quat, Vec3 } from '../core/math';

export const CATEGORIES = [
  'blocks',
  'props',
  'fragile',
  'explosives',
  'vehicles',
  'ragdolls',
  'nature',
  'soft',
  'weapons',
  'gadgets',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  id: Category;
  label: string;
  icon: string;
  hint: string;
}

export interface PrimitiveShapeBase {
  kind: 'box' | 'sphere' | 'capsule' | 'cylinder' | 'cone' | 'hull';
}

export interface BoxShape extends PrimitiveShapeBase {
  kind: 'box';
  hx: number;
  hy: number;
  hz: number;
}

export interface SphereShape extends PrimitiveShapeBase {
  kind: 'sphere';
  r: number;
}

export interface CapsuleShape extends PrimitiveShapeBase {
  kind: 'capsule';
  r: number;
  hh: number;
}

export interface CylinderShape extends PrimitiveShapeBase {
  kind: 'cylinder';
  r: number;
  hh: number;
}

export interface ConeShape extends PrimitiveShapeBase {
  kind: 'cone';
  r: number;
  hh: number;
}

export interface HullShape extends PrimitiveShapeBase {
  kind: 'hull';
  /** Flat [x,y,z, x,y,z, …] point cloud used for both collider and mesh hull. */
  points: number[];
}

export type PrimitiveShape =
  | BoxShape
  | SphereShape
  | CapsuleShape
  | CylinderShape
  | ConeShape
  | HullShape;

export interface ShapePart {
  shape: PrimitiveShape;
  /** Local offset from the body origin. */
  pos?: Vec3;
  /** Local rotation in Euler XYZ radians. */
  rot?: Vec3;
  /** Fixed colour override; otherwise the def's chosen colour is used. */
  color?: string;
  /** Material override for this part. */
  material?: MaterialName;
}

export interface DestructibleConfig {
  /** Blast damage capacity. */
  hp: number;
  /** Contact force (newtons) above which the object shatters. */
  impactThreshold: number;
  /** How many physical fragments to spawn when broken. */
  fragments: number;
  fragmentColors?: readonly string[];
  /** Optional fluid burst (e.g. a water balloon). */
  releaseFluid?: FluidConfig;
}

export interface ExplosiveConfig {
  radius: number;
  /** Peak velocity change (m/s) applied at the blast centre. */
  impulse: number;
  damage: number;
  /** Seconds until detonation. Omit for impact-only devices. */
  fuse?: number;
  impactTrigger?: boolean;
  triggerThreshold?: number;
  /** Fragments thrown out by the explosion itself. */
  shatter?: number;
  color?: string;
}

export interface WeaponConfig {
  projectile: string;
  speed: number;
  cooldown: number;
  count?: number;
  /** Radians of random spread. */
  spread?: number;
  /** Muzzle offset in body-local space. */
  muzzle?: Vec3;
  recoil?: number;
}

export interface ForceFieldConfig {
  kind: 'wind' | 'attract' | 'lift';
  strength: number;
  radius: number;
}

export interface RagdollConfig {
  /** Total standing height in metres. */
  height?: number;
  /** Multiplier on limb thickness. */
  limbScale?: number;
  head?: 'sphere' | 'box';
  /** Optional accessory colour for the head, e.g. a melon skin. */
  headColor?: string;
}

export interface WheelSpec {
  /** Chassis-local centre of the wheel. */
  pos: Vec3;
  radius: number;
  width: number;
}

export interface VehicleConfig {
  wheels: WheelSpec[];
  maxSpeed: number;
  motorForce: number;
  wheelColor?: string;
}

export interface SoftConfig {
  grid: [number, number, number];
  spacing: number;
  stiffness: number;
  damping: number;
  radius?: number;
}

export interface ClothConfig {
  grid: [number, number];
  spacing: number;
  pin: 'top' | 'corners';
  stiffness: number;
  damping: number;
  vertical?: boolean;
}

export interface FluidConfig {
  count: number;
  radius: number;
  /** Initial outward speed for splashes. */
  speed?: number;
}

export interface Behaviors {
  destructible?: DestructibleConfig;
  explosive?: ExplosiveConfig;
  weapon?: WeaponConfig;
  forceField?: ForceFieldConfig;
  buoyant?: { lift: number };
}

export type EntityKind = 'rigid' | 'ragdoll' | 'vehicle' | 'soft' | 'cloth' | 'fluid';

export interface ObjectDef {
  id: string;
  name: string;
  category: Category;
  icon?: string;
  description?: string;
  kind?: EntityKind;
  parts?: ShapePart[];
  material?: MaterialName;
  colors?: readonly string[];
  spawnScale?: [number, number];
  hidden?: boolean;
  tags?: string[];
  behaviors?: Behaviors;
  ragdoll?: RagdollConfig;
  vehicle?: VehicleConfig;
  soft?: SoftConfig;
  cloth?: ClothConfig;
  fluid?: FluidConfig;
}

/** A catalog entry with everything the simulation/renderer needs resolved. */
export interface SpawnOptions {
  position: Vec3;
  rotation?: Quat;
  scale?: number;
  color?: string;
  linearVelocity?: Vec3;
  angularVelocity?: Vec3;
  /** Skip body-cap eviction (used internally for blasts/debris). */
  ignoreCaps?: boolean;
  /** Do not emit spawn feedback. */
  silent?: boolean;
}

export interface ShapeBounds {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  radius: number;
  halfHeight: number;
}
