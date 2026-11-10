/** Shared simulation types. This module is DOM- and Three.js-free. */

import type {
  Collider,
  ImpulseJoint,
  RevoluteImpulseJoint,
  RigidBody,
} from '@dimforge/rapier3d-compat';
import type { MaterialName } from '../catalog/materials';
import type { ObjectDef, PrimitiveShape, ShapeBounds } from '../catalog/types';
import type { Quat, Vec3 } from '../core/math';

export interface SimPart {
  shape: PrimitiveShape;
  localPos: Vec3;
  localQuat: Quat;
  color: string;
  material: MaterialName;
  collider: Collider;
}

export interface SimBody {
  body: RigidBody;
  parts: SimPart[];
  primary: boolean;
}

export interface BodyPoseSnapshot {
  position: Vec3;
  rotation: Quat;
  linearVelocity?: Vec3;
  angularVelocity?: Vec3;
}

export interface SimEntity {
  id: number;
  def: ObjectDef;
  bodies: SimBody[];
  joints: ImpulseJoint[];
  motorJoints: RevoluteImpulseJoint[];
  scale: number;
  color: string;
  createdAt: number;
  hp: number;
  fuse: number | null;
  removed: boolean;
  held: boolean;
  engineOn: boolean;
  nextFire: number;
  isProjectile: boolean;
  contactThreshold: number;
  /** Ragdolls spawn balanced and stay balanced until something disturbs them. */
  standing: boolean;
  /** Resting world-space skeleton used by the balance controller. */
  standPose: BodyPoseSnapshot[] | null;
}

export type SimEvent =
  | { type: 'blast'; position: Vec3; radius: number; color: string; power: number }
  | { type: 'break'; position: Vec3; color: string; defId: string }
  | { type: 'cap'; removed: number }
  | { type: 'spawn'; entityId: number; defId: string; position: Vec3; scale: number }
  | { type: 'remove'; entityId: number; defId: string; position: Vec3 }
  | { type: 'weapon'; position: Vec3; direction: Vec3; entityId: number };

export interface RayHit {
  point: Vec3;
  normal: Vec3;
  entity: SimEntity | null;
  colliderHandle: number;
  bodyIndex: number;
}

export interface SimWorldOptions {
  gravity?: number;
  maxBodies?: number;
  killPlane?: number;
  seed?: number;
  createGround?: boolean;
  getDef?: (id: string) => ObjectDef | undefined;
}

export interface PlannedPart {
  shape: PrimitiveShape;
  pos?: Vec3;
  rot?: Vec3;
  color?: string;
  material?: MaterialName;
}

export interface PlannedBody {
  pos: Vec3;
  quat?: Quat;
  parts: PlannedPart[];
  primary?: boolean;
  fixed?: boolean;
  ccd?: boolean;
}

export type PlannedJoint =
  | { kind: 'spherical'; a: number; b: number; anchorA: Vec3; anchorB: Vec3 }
  | {
      kind: 'spring';
      a: number;
      b: number;
      anchorA: Vec3;
      anchorB: Vec3;
      restLength: number;
      stiffness: number;
      damping: number;
    }
  | {
      kind: 'revolute';
      a: number;
      b: number;
      anchorA: Vec3;
      anchorB: Vec3;
      axis: Vec3;
    };

export interface BuildPlan {
  bodies: PlannedBody[];
  joints: PlannedJoint[];
  motorJointIndices: number[];
}

export type Bounds = ShapeBounds;
