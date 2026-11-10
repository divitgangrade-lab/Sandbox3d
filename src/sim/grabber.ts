/** Joint-based grab: a kinematic anchor pulls a physics body around, then lets go with a throw. */

import RAPIER from '@dimforge/rapier3d-compat';
import type { SimEntity } from './types';
import type { SimWorld } from './SimWorld';
import {
  clamp,
  quatInverse,
  V3,
  type Vec3,
} from '../core/math';

const rv = (v: Vec3) => ({ x: v[0], y: v[1], z: v[2] });

export class SimGrabber {
  private anchor: RAPIER.RigidBody | null = null;
  private joint: RAPIER.ImpulseJoint | null = null;
  private body: RAPIER.RigidBody | null = null;
  private entityRef: SimEntity | null = null;
  private readonly unsubscribe: () => void;

  constructor(private readonly sim: SimWorld) {
    this.unsubscribe = sim.onRemove((entity) => {
      if (entity === this.entityRef) this.detach();
    });
  }

  get grabbed(): SimEntity | null {
    return this.entityRef;
  }

  get isGrabbing(): boolean {
    return this.entityRef !== null;
  }

  grab(entity: SimEntity, bodyIndex: number, worldPoint: Vec3): boolean {
    this.release();
    if (entity.removed) return false;
    const simBody = entity.bodies[bodyIndex] ?? entity.bodies[0];
    if (!simBody || !simBody.body.isDynamic()) return false;

    const body = simBody.body;
    const pos = body.translation();
    const rot = body.rotation();
    const inverse = quatInverse([rot.x, rot.y, rot.z, rot.w]);
    const local = V3.rotate(inverse, V3.sub(worldPoint, [pos.x, pos.y, pos.z]));

    const anchor = this.sim.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        worldPoint[0],
        Math.max(worldPoint[1], 0.15),
        worldPoint[2],
      ),
    );
    const joint = this.sim.world.createImpulseJoint(
      RAPIER.JointData.spherical(rv(local), { x: 0, y: 0, z: 0 }),
      body,
      anchor,
      true,
    );
    joint.setContactsEnabled(false);

    this.anchor = anchor;
    this.joint = joint;
    this.body = body;
    this.entityRef = entity;
    entity.held = true;
    return true;
  }

  moveTo(point: Vec3): void {
    if (!this.anchor) return;
    const y = clamp(point[1], 0.15, 200);
    this.anchor.setNextKinematicTranslation({ x: point[0], y, z: point[2] });
    this.body?.wakeUp();
  }

  release(velocity: Vec3 = [0, 0, 0]): void {
    if (this.body && this.entityRef && !this.entityRef.removed) {
      const speed = V3.length(velocity);
      if (speed > 0.2) {
        const capped = V3.scale(velocity, Math.min(speed, 30) / speed);
        const mass = Math.max(this.body.mass(), 0.05);
        this.body.applyImpulse(rv(V3.scale(capped, mass * 0.75)), true);
        this.body.applyTorqueImpulse(
          rv([
            (Math.random() - 0.5) * mass * 0.8,
            (Math.random() - 0.5) * mass * 0.8,
            (Math.random() - 0.5) * mass * 0.8,
          ]),
          true,
        );
      }
    }
    this.detach();
  }

  dispose(): void {
    this.release();
    this.unsubscribe();
  }

  private detach(): void {
    if (this.joint && this.joint.isValid()) this.sim.world.removeImpulseJoint(this.joint, true);
    if (this.anchor) this.sim.world.removeRigidBody(this.anchor);
    if (this.entityRef) this.entityRef.held = false;
    this.joint = null;
    this.anchor = null;
    this.body = null;
    this.entityRef = null;
  }
}
