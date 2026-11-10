/**
 * Headless physics sandbox. Owns the Rapier world, entities, interaction rules and events.
 * No DOM, no Three.js: this file runs in Node tests and in the browser identically.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { buildPlan, planBounds } from './builders';
import type {
  BodyPoseSnapshot,
  BuildPlan,
  PlannedBody,
  PlannedJoint,
  RayHit,
  SimEntity,
  SimEvent,
  SimPart,
  SimWorldOptions,
} from './types';
import type { Category, FluidConfig, ObjectDef, PrimitiveShape, SpawnOptions } from '../catalog/types';
import { DEFAULT_COLOR, DEFAULT_MATERIAL, MATERIALS, type MaterialName } from '../catalog/materials';
import { box as makeBox } from '../catalog/shapes';
import {
  clamp,
  makeRng,
  pick,
  quatFromEuler,
  quatFromY,
  quatFromZDirection,
  quatInverse,
  quatMul,
  randRange,
  V3,
  type Quat,
  type Rng,
  type Vec3,
} from '../core/math';
import {
  FIXED_DT,
  GRAVITY,
  KILL_PLANE,
  MAX_BODIES,
  MAX_FRAGMENTS_PER_OBJECT,
  MAX_SUBSTEPS,
  PROJECTILE_LIFETIME,
} from '../core/config';

interface RapierVec {
  x: number;
  y: number;
  z: number;
}

const rv = (v: Vec3): RapierVec => ({ x: v[0], y: v[1], z: v[2] });
const qv = (q: Quat) => ({ x: q[0], y: q[1], z: q[2], w: q[3] });
const IDENTITY: Quat = [0, 0, 0, 1];

function scaleShape(shape: PrimitiveShape, scale: number): PrimitiveShape {
  switch (shape.kind) {
    case 'box':
      return { kind: 'box', hx: shape.hx * scale, hy: shape.hy * scale, hz: shape.hz * scale };
    case 'sphere':
      return { kind: 'sphere', r: shape.r * scale };
    case 'capsule':
      return { kind: 'capsule', r: shape.r * scale, hh: shape.hh * scale };
    case 'cylinder':
      return { kind: 'cylinder', r: shape.r * scale, hh: shape.hh * scale };
    case 'cone':
      return { kind: 'cone', r: shape.r * scale, hh: shape.hh * scale };
    case 'hull':
      return { kind: 'hull', points: shape.points.map((p) => p * scale) };
  }
}

export class SimWorld {
  readonly world: RAPIER.World;
  readonly maxBodies: number;
  readonly killPlane: number;

  private readonly eventQueue: RAPIER.EventQueue;
  private readonly entityStore = new Map<number, SimEntity>();
  private readonly colliderToEntity = new Map<number, SimEntity>();
  private readonly removeListeners = new Set<(entity: SimEntity) => void>();
  private readonly events: SimEvent[] = [];
  private readonly rng: Rng;
  private readonly getDef?: (id: string) => ObjectDef | undefined;
  private accumulator = 0;
  private simTime = 0;
  private nextId = 1;
  private bodyTotal = 0;
  private groundCollider: RAPIER.Collider | null = null;
  private paused = false;
  private speed = 1;
  private gravity: number;

  constructor(options: SimWorldOptions = {}) {
    this.gravity = options.gravity ?? GRAVITY;
    this.world = new RAPIER.World(rv([0, this.gravity, 0]));
    this.world.timestep = FIXED_DT;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.maxBodies = options.maxBodies ?? MAX_BODIES;
    this.killPlane = options.killPlane ?? KILL_PLANE;
    this.rng = makeRng(options.seed ?? 0x5eed1234);
    this.getDef = options.getDef;
    if (options.createGround !== false) this.createGround();
  }

  get bodyCount(): number {
    return this.bodyTotal;
  }

  get entityCount(): number {
    return this.entityStore.size;
  }

  get time(): number {
    return this.simTime;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get timeScale(): number {
    return this.speed;
  }

  get entities(): Iterable<SimEntity> {
    return this.entityStore.values();
  }

  get(entityId: number): SimEntity | undefined {
    return this.entityStore.get(entityId);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setTimeScale(scale: number): void {
    this.speed = clamp(scale, 0.05, 2);
  }

  get gravityValue(): number {
    return this.gravity;
  }

  /** Change world gravity without rebuilding bodies or losing the scene. */
  setGravity(value: number): void {
    if (!Number.isFinite(value)) return;
    this.gravity = clamp(value, -30, 30);
    this.world.gravity = { x: 0, y: this.gravity, z: 0 };
  }

  /** Current poses of every physical body, in entity-local body order. */
  getBodyPoses(entity: SimEntity, includeVelocity = false): BodyPoseSnapshot[] {
    return entity.bodies.map((simBody) => {
      const t = simBody.body.translation();
      const q = simBody.body.rotation();
      const pose: BodyPoseSnapshot = {
        position: [t.x, t.y, t.z],
        rotation: [q.x, q.y, q.z, q.w],
      };
      if (includeVelocity) {
        const v = simBody.body.linvel();
        const a = simBody.body.angvel();
        pose.linearVelocity = [v.x, v.y, v.z];
        pose.angularVelocity = [a.x, a.y, a.z];
      }
      return pose;
    });
  }

  /** Restore exact body poses (save/load and undo), including optional motion. */
  applyBodyPoses(entity: SimEntity, poses: readonly BodyPoseSnapshot[]): void {
    if (entity.removed) return;
    entity.bodies.forEach((simBody, index) => {
      const pose = poses[index];
      if (!pose) return;
      simBody.body.setTranslation(rv(pose.position), true);
      simBody.body.setRotation(qv(pose.rotation), true);
      if (pose.linearVelocity) simBody.body.setLinvel(rv(pose.linearVelocity), true);
      else simBody.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (pose.angularVelocity) simBody.body.setAngvel(rv(pose.angularVelocity), true);
      else simBody.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    });
    if (entity.standing) {
      entity.standPose = this.getBodyPoses(entity);
    }
  }

  /** Teleport one entity using its primary body as the reference point. */
  setEntityTransform(entity: SimEntity, position: Vec3, rotation?: Quat): void {
    if (entity.removed) return;
    const primaryIndex = Math.max(
      0,
      entity.bodies.findIndex((body) => body.primary),
    );
    const primary = entity.bodies[primaryIndex]?.body;
    if (!primary) return;
    const currentPos = primary.translation();
    const currentRot = primary.rotation();
    const dx = position[0] - currentPos.x;
    const dy = position[1] - currentPos.y;
    const dz = position[2] - currentPos.z;
    const oldQ: Quat = [currentRot.x, currentRot.y, currentRot.z, currentRot.w];
    const newQ: Quat = rotation ?? oldQ;
    const deltaQ = quatMul(newQ, quatInverse(oldQ));
    for (const simBody of entity.bodies) {
      const t = simBody.body.translation();
      const offset: Vec3 = [t.x - currentPos.x, t.y - currentPos.y, t.z - currentPos.z];
      const rotated = V3.rotate(deltaQ, offset);
      simBody.body.setTranslation(
        { x: position[0] + rotated[0], y: position[1] + rotated[1], z: position[2] + rotated[2] },
        true,
      );
      const q = simBody.body.rotation();
      const bodyQ: Quat = [q.x, q.y, q.z, q.w];
      const moved = quatMul(deltaQ, bodyQ);
      simBody.body.setRotation(qv(moved), true);
      simBody.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      simBody.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    void dx;
    void dy;
    void dz;
    if (entity.standing) entity.standPose = this.getBodyPoses(entity);
  }

  onRemove(listener: (entity: SimEntity) => void): () => void {
    this.removeListeners.add(listener);
    return () => this.removeListeners.delete(listener);
  }

  drainEvents(): SimEvent[] {
    if (this.events.length === 0) return [];
    return this.events.splice(0, this.events.length);
  }

  private createGround(): void {
    const groundBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const ground = RAPIER.ColliderDesc.cuboid(120, 1, 120)
      .setTranslation(0, -1, 0)
      .setFriction(0.92)
      .setRestitution(0.03);
    this.groundCollider = this.world.createCollider(ground, groundBody);
  }

  /** Fixed-timestep integration with an accumulator and substep cap. */
  step(deltaSeconds: number): number {
    if (this.paused) return 0;
    const delta = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.25);
    this.accumulator += delta * this.speed;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.tick(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0;
    return steps;
  }

  private tick(dt: number): void {
    this.simTime += dt;
    this.applyForceFields(dt);
    this.applyBuoyancy(dt);
    this.stabilizeRagdolls(dt);
    this.processFuses(dt);
    this.world.step(this.eventQueue);
    this.processContacts();
    this.cleanup();
  }

  /**
   * A light-weight balance controller for untouched ragdolls. Every body is pulled toward the
   * pose it was spawned in; feet still collide, hits still transfer impulse, and disabling the
   * controller on a disturbance lets the joints behave like a normal ragdoll.
   */
  private stabilizeRagdolls(dt: number): void {
    const stiffness = 92;
    const damping = 15;
    const rotational = 26;
    for (const entity of this.entityStore.values()) {
      if (entity.def.kind !== 'ragdoll' || !entity.standing || entity.held || !entity.standPose) continue;
      if (this.simTime - entity.createdAt > 0.08) {
        entity.bodies.forEach((simBody, index) => {
          const target = entity.standPose?.[index];
          if (!target || !simBody.body.isDynamic()) return;
          const p = simBody.body.translation();
          const v = simBody.body.linvel();
          const mass = Math.max(simBody.body.mass(), 0.05);
          const impulse = [
            ((target.position[0] - p.x) * stiffness - v.x * damping) * mass * dt,
            (((target.position[1] - p.y) * stiffness - v.y * damping) - this.gravity) * mass * dt,
            ((target.position[2] - p.z) * stiffness - v.z * damping) * mass * dt,
          ] as const;
          simBody.body.applyImpulse(rv(impulse), true);

          // Torso, hips and head stay level; limbs follow through the spherical joints.
          if (index === 0 || index === 1 || index === 2) {
            const q = simBody.body.rotation();
            const current: Quat = [q.x, q.y, q.z, q.w];
            const delta = quatMul(target.rotation, quatInverse(current));
            const w = clamp(delta[3], -1, 1);
            const angle = 2 * Math.acos(w);
            if (angle > 1e-4) {
              const sin = Math.sqrt(Math.max(0, 1 - w * w));
              const axis: Vec3 = sin > 1e-4 ? [delta[0] / sin, delta[1] / sin, delta[2] / sin] : [0, 0, 0];
              const turn = Math.min(angle, 0.55) * rotational * mass * dt;
              simBody.body.applyTorqueImpulse(rv(V3.scale(axis, turn)), true);
            }
          }
        });
      }
    }
  }

  private processFuses(dt: number): void {
    if (this.entityStore.size === 0) return;
    const pending: SimEntity[] = [];
    for (const entity of this.entityStore.values()) {
      if (entity.fuse === null) continue;
      entity.fuse -= dt;
      if (entity.fuse <= 0) pending.push(entity);
    }
    for (const entity of pending) {
      if (!entity.removed) this.detonate(entity);
    }
  }

  private applyBuoyancy(dt: number): void {
    for (const entity of this.entityStore.values()) {
      const lift = entity.def.behaviors?.buoyant?.lift;
      if (!lift) continue;
      for (const simBody of entity.bodies) {
        if (!simBody.body.isDynamic()) continue;
        const mass = simBody.body.mass();
        simBody.body.applyImpulse(rv([0, mass * Math.abs(GRAVITY) * lift * dt, 0]), true);
      }
    }
  }

  private applyForceFields(dt: number): void {
    let fields = 0;
    for (const emitter of this.entityStore.values()) {
      const cfg = emitter.def.behaviors?.forceField;
      if (!cfg) continue;
      if (++fields > 12) break;
      const source = emitter.bodies[0]?.body.translation();
      if (!source) continue;
      const r2 = cfg.radius * cfg.radius;
      for (const target of this.entityStore.values()) {
        if (target === emitter) continue;
        for (const simBody of target.bodies) {
          if (!simBody.body.isDynamic()) continue;
          const p = simBody.body.translation();
          const dx = p.x - source.x;
          const dy = p.y - source.y;
          const dz = p.z - source.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq > r2) continue;
          const dist = Math.sqrt(distSq);
          if (dist < 1e-3 && cfg.kind !== 'lift') continue;
          const falloff = Math.max(0, 1 - dist / cfg.radius);
          let ix = dx;
          let iy = dy;
          let iz = dz;
          if (cfg.kind === 'wind') {
            iy = dy * 0.25 + 0.15;
            if (dist < 0.05) {
              ix = 0;
              iy = 0.2;
              iz = -1;
            }
          } else if (cfg.kind === 'attract') {
            ix = -dx;
            iy = -dy;
            iz = -dz;
          } else {
            ix = 0;
            iy = 1;
            iz = 0;
          }
          const len = Math.hypot(ix, iy, iz) || 1;
          const mass = simBody.body.mass();
          const strength = cfg.strength * dt * falloff * mass * (cfg.kind === 'attract' ? 1.3 : 0.6);
          simBody.body.applyImpulse(
            rv([(ix / len) * strength, (iy / len) * strength, (iz / len) * strength]),
            true,
          );
        }
      }
    }
  }

  private processContacts(): void {
    const breaks = new Set<SimEntity>();
    const detonations = new Set<SimEntity>();
    this.eventQueue.drainContactForceEvents((event) => {
      const force = event.totalForceMagnitude();
      const handles = [event.collider1(), event.collider2()];
      for (const handle of handles) {
        const entity = this.colliderToEntity.get(handle);
        if (!entity || entity.removed) continue;
        if (entity.standing && force > 34) {
          const otherHandle = handles[0] === handle ? handles[1] : handles[0];
          const otherEntity = this.colliderToEntity.get(otherHandle);
          const groundContact = otherHandle === this.groundCollider?.handle;
          if (!groundContact && otherEntity !== entity) entity.standing = false;
        }
        if (force < entity.contactThreshold) continue;
        if (
          entity.def.behaviors?.destructible &&
          force >= entity.contactThreshold &&
          this.simTime - entity.createdAt > 0.3
        ) {
          breaks.add(entity);
        }
        const explosive = entity.def.behaviors?.explosive;
        if (explosive?.impactTrigger && entity.fuse === null) {
          detonations.add(entity);
        }
      }
    });

    for (const entity of breaks) {
      if (!entity.removed) this.breakEntity(entity);
    }
    for (const entity of detonations) {
      if (!entity.removed) this.detonate(entity);
    }
  }

  private cleanup(): void {
    if (this.entityStore.size === 0) return;
    const dead: SimEntity[] = [];
    for (const entity of this.entityStore.values()) {
      const primary = entity.bodies[0]?.body;
      if (!primary) {
        dead.push(entity);
        continue;
      }
      const p = primary.translation();
      if (p.y < this.killPlane) dead.push(entity);
      else if (entity.isProjectile && this.simTime - entity.createdAt > PROJECTILE_LIFETIME) {
        dead.push(entity);
      }
    }
    for (const entity of dead) this.remove(entity);
  }

  /** Spawn a catalog definition. `position` is the surface point the object should rest on. */
  spawn(def: ObjectDef, options: SpawnOptions): SimEntity {
    const scale = options.scale ?? (def.spawnScale ? randRange(this.rng, def.spawnScale[0], def.spawnScale[1]) : 1);
    const baseColor =
      options.color ?? (def.colors && def.colors.length > 0 ? pick(this.rng, def.colors) : DEFAULT_COLOR);
    const plan = buildPlan(def, baseColor, this.rng);
    const bounds = planBounds(plan);
    const position: Vec3 = [
      options.position[0],
      options.position[1] - bounds.min[1] * scale + 0.012,
      options.position[2],
    ];
    const rotation: Quat = options.rotation ?? quatFromY(this.rng() * Math.PI * 2);

    const entity: SimEntity = {
      id: this.nextId++,
      def,
      bodies: [],
      joints: [],
      motorJoints: [],
      scale,
      color: baseColor,
      createdAt: this.simTime,
      hp: def.behaviors?.destructible?.hp ?? 100,
      fuse: def.behaviors?.explosive?.fuse ?? null,
      removed: false,
      held: false,
      engineOn: false,
      nextFire: 0,
      isProjectile: def.tags?.includes('projectile') ?? false,
      contactThreshold: Infinity,
      standing: def.kind === 'ragdoll',
      standPose: null,
    };

    this.entityStore.set(entity.id, entity);

    try {
      for (const planned of plan.bodies) {
        this.materializeBody(entity, planned, position, rotation, scale);
      }
      if (entity.bodies.length === 0) throw new Error(`Object "${def.id}" produced no bodies`);
      const primaryIndex = plan.bodies.findIndex((b) => b.primary);
      entity.bodies.forEach((b, i) => {
        b.primary = i === (primaryIndex >= 0 ? primaryIndex : 0);
      });
      this.materializeJoints(entity, plan, scale);
      for (const index of plan.motorJointIndices) {
        const joint = entity.joints[index];
        if (joint) entity.motorJoints.push(joint as RAPIER.RevoluteImpulseJoint);
      }
      this.applyInitialVelocity(entity, options);
      this.configureContactEvents(entity);
      if (entity.standing) entity.standPose = this.getBodyPoses(entity);
    } catch (error) {
      this.remove(entity);
      throw error;
    }

    if (!options.silent) {
      this.emit({ type: 'spawn', entityId: entity.id, defId: def.id, position, scale });
    }
    if (!options.ignoreCaps) this.enforceCap(entity);
    return entity;
  }

  private materializeBody(
    entity: SimEntity,
    planned: PlannedBody,
    origin: Vec3,
    rotation: Quat,
    scale: number,
  ): void {
    const localPos = V3.scale(planned.pos, scale);
    const worldPos = V3.add(origin, V3.rotate(rotation, localPos));
    const bodyQuat = quatMul(rotation, planned.quat ?? IDENTITY);

    const desc = planned.fixed
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.04).setAngularDamping(0.22);
    desc.setTranslation(worldPos[0], worldPos[1], worldPos[2]).setRotation(qv(bodyQuat));
    if (!planned.fixed && (planned.ccd || entity.isProjectile)) desc.setCcdEnabled(true);
    const body = this.world.createRigidBody(desc);

    const parts: SimPart[] = [];
    for (const plannedPart of planned.parts) {
      const colliderDesc = this.colliderDesc(plannedPart.shape, scale);
      if (!colliderDesc) continue;
      const partPos = V3.scale(plannedPart.pos ?? [0, 0, 0], scale);
      const partQuat = quatFromEuler(...(plannedPart.rot ?? [0, 0, 0]));
      const materialName: MaterialName = plannedPart.material ?? entity.def.material ?? DEFAULT_MATERIAL;
      const material = MATERIALS[materialName];
      colliderDesc
        .setTranslation(partPos[0], partPos[1], partPos[2])
        .setRotation(qv(partQuat))
        .setDensity(material.density)
        .setFriction(material.friction)
        .setRestitution(material.restitution);
      const collider = this.world.createCollider(colliderDesc, body);
      this.colliderToEntity.set(collider.handle, entity);
      parts.push({
        shape: scaleShape(plannedPart.shape, scale),
        localPos: partPos,
        localQuat: partQuat,
        color: plannedPart.color ?? entity.color,
        material: materialName,
        collider,
      });
    }

    entity.bodies.push({ body, parts, primary: planned.primary ?? false });
    this.bodyTotal++;
  }

  private colliderDesc(shape: PrimitiveShape, scale: number): RAPIER.ColliderDesc | null {
    switch (shape.kind) {
      case 'box':
        return RAPIER.ColliderDesc.cuboid(
          Math.max(shape.hx * scale, 0.001),
          Math.max(shape.hy * scale, 0.001),
          Math.max(shape.hz * scale, 0.001),
        );
      case 'sphere':
        return RAPIER.ColliderDesc.ball(Math.max(shape.r * scale, 0.001));
      case 'capsule':
        return RAPIER.ColliderDesc.capsule(
          Math.max(shape.hh * scale, 0.001),
          Math.max(shape.r * scale, 0.001),
        );
      case 'cylinder':
        return RAPIER.ColliderDesc.cylinder(
          Math.max(shape.hh * scale, 0.001),
          Math.max(shape.r * scale, 0.001),
        );
      case 'cone':
        return RAPIER.ColliderDesc.cone(Math.max(shape.hh * scale, 0.001), Math.max(shape.r * scale, 0.001));
      case 'hull': {
        const points = new Float32Array(shape.points.map((v) => v * scale));
        return RAPIER.ColliderDesc.convexHull(points);
      }
    }
  }

  private materializeJoints(entity: SimEntity, plan: BuildPlan, scale: number): void {
    for (const planned of plan.joints) {
      const joint = this.createJoint(entity, planned, scale);
      if (joint) {
        joint.setContactsEnabled(false);
        entity.joints.push(joint);
      }
    }
  }

  private createJoint(
    entity: SimEntity,
    joint: PlannedJoint,
    scale: number,
  ): RAPIER.ImpulseJoint | null {
    const a = entity.bodies[joint.a];
    const b = entity.bodies[joint.b];
    if (!a || !b) return null;
    const anchorA = rv(V3.scale(joint.anchorA, scale));
    const anchorB = rv(V3.scale(joint.anchorB, scale));
    let data: RAPIER.JointData;
    switch (joint.kind) {
      case 'spherical':
        data = RAPIER.JointData.spherical(anchorA, anchorB);
        break;
      case 'spring':
        data = RAPIER.JointData.spring(
          Math.max(joint.restLength * scale, 0.001),
          joint.stiffness,
          joint.damping,
          anchorA,
          anchorB,
        );
        break;
      case 'revolute':
        data = RAPIER.JointData.revolute(anchorA, anchorB, rv(joint.axis));
        break;
    }
    return this.world.createImpulseJoint(data, a.body, b.body, true);
  }

  private applyInitialVelocity(entity: SimEntity, options: SpawnOptions): void {
    const primary = entity.bodies.find((b) => b.primary)?.body ?? entity.bodies[0]?.body;
    if (!primary) return;
    if (options.linearVelocity) primary.setLinvel(rv(options.linearVelocity), true);
    if (options.angularVelocity) primary.setAngvel(rv(options.angularVelocity), true);
  }

  private configureContactEvents(entity: SimEntity): void {
    const behaviors = entity.def.behaviors;
    const primary = entity.bodies.find((b) => b.primary)?.body ?? entity.bodies[0]?.body;
    const mass = primary ? primary.mass() : 1;
    let threshold = Infinity;
    if (behaviors?.destructible) {
      // Scale with weight: a heavy mirror resting on the ground should not shatter from
      // support forces, while a real impact still easily exceeds the threshold.
      threshold = Math.min(threshold, behaviors.destructible.impactThreshold + mass * Math.abs(GRAVITY) * 8);
    }
    if (behaviors?.explosive?.impactTrigger) {
      const base = behaviors.explosive.triggerThreshold ?? 24;
      threshold = Math.min(threshold, base + mass * Math.abs(GRAVITY) * 1.5);
    }
    if (entity.def.kind === 'ragdoll') {
      // Contact events let us notice a real shove and disable the balance controller. Ground
      // support is filtered out in processContacts so standing still is not treated as a hit.
      threshold = Math.min(threshold, 28);
    }
    entity.contactThreshold = threshold;
    if (!Number.isFinite(threshold)) return;
    for (const simBody of entity.bodies) {
      for (const part of simBody.parts) {
        part.collider.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
        part.collider.setContactForceEventThreshold(threshold);
      }
    }
  }

  private enforceCap(protect?: SimEntity): void {
    let removed = 0;
    while (this.bodyTotal > this.maxBodies) {
      let victim: SimEntity | undefined;
      for (const candidate of this.entityStore.values()) {
        if (candidate === protect || candidate.removed || candidate.held) continue;
        victim = candidate;
        break;
      }
      if (!victim) break;
      this.remove(victim);
      removed++;
    }
    if (removed > 0) this.emit({ type: 'cap', removed });
  }

  remove(entity: SimEntity): void {
    if (entity.removed) return;
    entity.removed = true;
    const primaryBody = entity.bodies[0]?.body;
    const t = primaryBody?.translation();
    const position: Vec3 = t ? [t.x, t.y, t.z] : [0, 0, 0];
    const defId = entity.def.id;

    for (const listener of this.removeListeners) {
      try {
        listener(entity);
      } catch {
        // A UI or grab listener must never break world teardown.
      }
    }

    for (const joint of entity.joints) {
      if (joint.isValid()) this.world.removeImpulseJoint(joint, true);
    }
    for (const simBody of entity.bodies) {
      for (const part of simBody.parts) this.colliderToEntity.delete(part.collider.handle);
      this.world.removeRigidBody(simBody.body);
    }
    this.bodyTotal = Math.max(0, this.bodyTotal - entity.bodies.length);
    entity.bodies = [];
    entity.joints = [];
    entity.motorJoints = [];
    entity.held = false;
    this.entityStore.delete(entity.id);
    this.emit({ type: 'remove', entityId: entity.id, defId, position });
  }

  clear(): void {
    const all = [...this.entityStore.values()];
    for (const entity of all) this.remove(entity);
    this.events.length = 0;
  }

  detonate(entity: SimEntity): void {
    if (entity.removed) return;
    const explosive = entity.def.behaviors?.explosive;
    if (!explosive) {
      this.remove(entity);
      return;
    }
    const t = entity.bodies[0]?.body.translation();
    const position: Vec3 = t ? [t.x, t.y, t.z] : [0, 0, 0];
    const color = explosive.color ?? '#ff8a3d';
    const shatter = explosive.shatter ?? 0;
    const material = entity.def.material ?? 'explosive';
    const category = entity.def.category;
    this.remove(entity);
    this.explodeAt(position, explosive.radius, explosive.impulse, explosive.damage, color);
    if (shatter > 0) {
      this.spawnDebrisAt(position, shatter, [color, '#d9d2b4', '#ffcf7a'], material, category);
    }
  }

  /** Radial impulse + damage. Public so the Blast tool and tests can use it directly. */
  explodeAt(
    center: Vec3,
    radius: number,
    impulse: number,
    damage: number,
    color = '#ff8a3d',
  ): void {
    this.emit({ type: 'blast', position: center, radius, color, power: impulse });
    const snapshot = [...this.entityStore.values()];
    const breaks: SimEntity[] = [];
    for (const entity of snapshot) {
      if (entity.removed) continue;
      let closest = Infinity;
      for (const simBody of entity.bodies) {
        const p = simBody.body.translation();
        closest = Math.min(closest, Math.hypot(p.x - center[0], p.y - center[1], p.z - center[2]));
      }
      if (closest > radius) continue;
      const falloff = Math.max(0, 1 - closest / radius);
      if (entity.def.kind === 'ragdoll') entity.standing = false;
      for (const simBody of entity.bodies) {
        if (!simBody.body.isDynamic()) continue;
        const p = simBody.body.translation();
        const dx = p.x - center[0];
        const dy = p.y - center[1];
        const dz = p.z - center[2];
        const dist = Math.max(Math.hypot(dx, dy, dz), 0.15);
        const bias = radius * 0.35;
        const dir = V3.normalize([dx, dy + bias, dz]);
        const mass = Math.max(simBody.body.mass(), 0.05);
        const power = impulse * falloff * mass;
        simBody.body.applyImpulse(rv(V3.scale(dir, power)), true);
        simBody.body.applyTorqueImpulse(
          rv([
            (this.rng() - 0.5) * mass * falloff * 0.6,
            (this.rng() - 0.5) * mass * falloff * 0.6,
            (this.rng() - 0.5) * mass * falloff * 0.6,
          ]),
          true,
        );
        void dist;
      }
      const explosive = entity.def.behaviors?.explosive;
      if (explosive) {
        entity.fuse = Math.min(entity.fuse ?? Number.POSITIVE_INFINITY, 0.06 + this.rng() * 0.18);
      } else if (
        entity.def.behaviors?.destructible &&
        entity.hp > 0 &&
        damage * falloff >= entity.hp
      ) {
        breaks.push(entity);
      }
    }
    for (const entity of breaks) {
      if (!entity.removed) this.breakEntity(entity);
    }
  }

  breakEntity(entity: SimEntity): void {
    if (entity.removed) return;
    const config = entity.def.behaviors?.destructible;
    if (!config) {
      this.remove(entity);
      return;
    }
    const body = entity.bodies[0]?.body;
    const t = body?.translation();
    const v = body?.linvel();
    const position: Vec3 = t ? [t.x, t.y, t.z] : [0, 0, 0];
    const velocity: Vec3 = v ? [v.x, v.y, v.z] : [0, 0, 0];
    const colors = config.fragmentColors && config.fragmentColors.length > 0
      ? config.fragmentColors
      : entity.def.colors ?? [entity.color];
    const material = entity.def.material ?? 'glass';
    const category = entity.def.category;
    const { fragments, releaseFluid } = config;

    this.emit({ type: 'break', position, color: colors[0] ?? entity.color, defId: entity.def.id });

    this.remove(entity);
    if (releaseFluid) this.spawnFluidBurst(position, releaseFluid);
    if (fragments > 0) {
      this.spawnDebrisAt(
        position,
        Math.min(fragments, MAX_FRAGMENTS_PER_OBJECT),
        colors,
        material,
        category,
        velocity,
      );
    }
  }

  private spawnFluidBurst(position: Vec3, config: FluidConfig): void {
    const def: ObjectDef = {
      id: '__fluid-burst',
      name: 'Water',
      category: 'soft',
      kind: 'fluid',
      material: 'water',
      colors: ['#4cc3f2', '#66d9ef', '#8fe3ff'],
      tags: ['fluid', 'water', 'debris'],
      fluid: config,
    };
    this.spawn(def, { position, silent: true, ignoreCaps: true });
  }

  private spawnDebrisAt(
    center: Vec3,
    count: number,
    colors: readonly string[],
    material: MaterialName,
    category: Category,
    sourceVelocity: Vec3 = [0, 0, 0],
  ): void {
    const available = Math.max(0, this.maxBodies + 64 - this.bodyTotal);
    const total = Math.min(count, available);
    if (total <= 0) return;
    for (let i = 0; i < total; i++) {
      const w = randRange(this.rng, 0.07, 0.2);
      const h = randRange(this.rng, 0.05, 0.16);
      const d = randRange(this.rng, 0.07, 0.2);
      const color = pick(this.rng, colors);
      const debris: ObjectDef = {
        id: '__debris',
        name: 'Debris',
        category,
        kind: 'rigid',
        material,
        colors: [color],
        tags: ['debris'],
        parts: [makeBox(w, h, d)],
      };
      const offset = V3.scale(
        V3.normalize([
          this.rng() * 2 - 1,
          this.rng() * 2 - 1,
          this.rng() * 2 - 1,
        ]),
        this.rng() * 0.35,
      );
      const outward = V3.normalize(V3.add(offset, [0, 0.25, 0]));
      const velocity = V3.add(
        V3.scale(sourceVelocity, 0.5),
        V3.scale(outward, randRange(this.rng, 2.2, 6.5)),
      );
      this.spawn(
        debris,
        {
          position: V3.add(center, offset),
          scale: randRange(this.rng, 0.8, 1.5),
          linearVelocity: velocity,
          angularVelocity: [
            randRange(this.rng, -8, 8),
            randRange(this.rng, -8, 8),
            randRange(this.rng, -8, 8),
          ],
          silent: true,
          ignoreCaps: true,
        },
      );
    }
  }

  fireWeapon(entity: SimEntity, direction: Vec3): SimEntity | null {
    if (entity.removed) return null;
    const weapon = entity.def.behaviors?.weapon;
    if (!weapon || this.simTime < entity.nextFire) return null;
    if (!this.getDef) return null;
    const projectileDef = this.getDef(weapon.projectile);
    if (!projectileDef) return null;
    const body = entity.bodies.find((b) => b.primary)?.body ?? entity.bodies[0]?.body;
    if (!body) return null;

    const bodyPos = body.translation();
    const bodyRot = body.rotation();
    const bodyQuat: Quat = [bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w];
    const muzzleLocal = V3.scale(weapon.muzzle ?? [0, 0, 0.5], entity.scale);
    const muzzle = V3.add(
      [bodyPos.x, bodyPos.y, bodyPos.z],
      V3.rotate(bodyQuat, muzzleLocal),
    );
    const dir = V3.normalize(direction);
    const shots = Math.max(1, weapon.count ?? 1);
    const spread = weapon.spread ?? 0;
    let first: SimEntity | null = null;

    for (let i = 0; i < shots; i++) {
      const shotDir = spread
        ? V3.normalize([
            dir[0] + (this.rng() - 0.5) * spread * 2,
            dir[1] + (this.rng() - 0.5) * spread * 2,
            dir[2] + (this.rng() - 0.5) * spread * 2,
          ])
        : dir;
      const projectile = this.spawn(projectileDef, {
        position: muzzle,
        rotation: quatFromZDirection(shotDir),
        linearVelocity: V3.scale(shotDir, weapon.speed),
        silent: true,
      });
      first ??= projectile;
    }

    entity.nextFire = this.simTime + weapon.cooldown;
    if (weapon.recoil) {
      const mass = Math.max(body.mass(), 0.05);
      body.applyImpulse(rv(V3.scale(dir, -weapon.recoil * mass)), true);
    }
    this.emit({ type: 'weapon', position: muzzle, direction: dir, entityId: entity.id });
    return first;
  }

  setVehicleEngine(entity: SimEntity, on: boolean): boolean {
    const config = entity.def.vehicle;
    if (!config || entity.motorJoints.length === 0 || entity.removed) return false;
    entity.engineOn = on;
    for (const joint of entity.motorJoints) {
      if (!joint.isValid()) continue;
      joint.configureMotorVelocity(on ? config.maxSpeed * 0.22 : 0, config.motorForce);
      joint.setMotorMaxForce(config.motorForce * 400);
    }
    return true;
  }

  /**
   * Throttle and steering for a driven vehicle. W/S set the motor target, A/D apply a yaw impulse
   * scaled by current speed so a parked car cannot pirouette in place.
   */
  driveVehicle(entity: SimEntity, throttle: number, steer: number, dt = 1 / 60): void {
    const config = entity.def.vehicle;
    if (!config || entity.removed || entity.motorJoints.length === 0) return;
    const speed = clamp(config.maxSpeed * clamp(throttle, -1, 1), -config.maxSpeed, config.maxSpeed);
    for (const joint of entity.motorJoints) {
      if (!joint.isValid()) continue;
      joint.configureMotorVelocity(speed, config.motorForce);
      joint.setMotorMaxForce(config.motorForce * 400);
    }
    const chassis = entity.bodies[0]?.body;
    if (!chassis) return;
    const q = chassis.rotation();
    const forward = V3.rotate([q.x, q.y, q.z, q.w], [0, 0, 1]);
    const v = chassis.linvel();
    const forwardSpeed = v.x * forward[0] + v.z * forward[2];
    const mass = Math.max(chassis.mass(), 0.1);
    const throttleValue = clamp(throttle, -1, 1);
    // Wheel motors alone are torque-limited on heavy chassis; a modest engine assist keeps the
    // speed response predictable while throttle/steering still come from real physics.
    const engineImpulse = throttleValue * mass * 7.2 * clamp(dt, 0, 0.05);
    if (Math.abs(forwardSpeed) < config.maxSpeed || forwardSpeed * throttleValue < 0) {
      chassis.applyImpulse(
        { x: forward[0] * engineImpulse, y: 0, z: forward[2] * engineImpulse },
        true,
      );
    }
    const planarSpeed = Math.hypot(v.x, v.z);
    if (planarSpeed < 0.35 || Math.abs(steer) < 0.01) return;
    const responsiveness = clamp(planarSpeed / Math.max(config.maxSpeed, 1), 0.18, 0.85);
    const yaw = -clamp(steer, -1, 1) * responsiveness * mass * 0.34;
    chassis.applyTorqueImpulse({ x: 0, y: yaw, z: 0 }, true);
  }

  toggleVehicleEngine(entity: SimEntity): boolean {
    return this.setVehicleEngine(entity, !entity.engineOn);
  }

  /**
   * Raycast against every collider directly. Rapier's broadphase query pipeline only refreshes
   * during `step`, so collider-level casts are used to make picking correct immediately after a
   * spawn (important for click-to-place and headless tests).
   */
  raycast(origin: Vec3, direction: Vec3, maxDistance = 500, exclude?: SimEntity): RayHit | null {
    const dir = V3.normalize(direction);
    const ray = new RAPIER.Ray(rv(origin), rv(dir));
    this.world.propagateModifiedBodyPositionsToColliders();

    let bestToi = maxDistance;
    let best: { collider: RAPIER.Collider; entity: SimEntity | null; bodyIndex: number } | null = null;
    const consider = (collider: RAPIER.Collider, entity: SimEntity | null, bodyIndex = -1) => {
      const hit = collider.castRayAndGetNormal(ray, bestToi, true);
      if (!hit || hit.timeOfImpact > bestToi) return;
      bestToi = hit.timeOfImpact;
      best = { collider, entity, bodyIndex };
    };

    if (this.groundCollider) consider(this.groundCollider, null);
    for (const entity of this.entityStore.values()) {
      if (entity === exclude || entity.removed) continue;
      for (let bodyIndex = 0; bodyIndex < entity.bodies.length; bodyIndex++) {
        const simBody = entity.bodies[bodyIndex]!;
        for (const part of simBody.parts) {
          if (part.collider.isEnabled()) consider(part.collider, entity, bodyIndex);
        }
      }
    }

    if (!best) return null;
    const hit = best as { collider: RAPIER.Collider; entity: SimEntity | null; bodyIndex: number };
    const point: Vec3 = [
      origin[0] + dir[0] * bestToi,
      origin[1] + dir[1] * bestToi,
      origin[2] + dir[2] * bestToi,
    ];
    const normalHit = hit.collider.castRayAndGetNormal(ray, bestToi + 1e-4, true);
    const normal: Vec3 = normalHit ? [normalHit.normal.x, normalHit.normal.y, normalHit.normal.z] : [0, 1, 0];
    return {
      point,
      normal,
      entity: hit.entity,
      colliderHandle: hit.collider.handle,
      bodyIndex: hit.bodyIndex,
    };
  }

  measureAwake(): number {
    let awake = 0;
    for (const entity of this.entityStore.values()) {
      for (const simBody of entity.bodies) {
        if (!simBody.body.isSleeping()) awake++;
      }
    }
    return awake;
  }

  private emit(event: SimEvent): void {
    if (this.events.length > 256) this.events.shift();
    this.events.push(event);
  }
}

/** Convenience for tests that want entity-part velocity without importing Rapier types. */
export function entityVelocity(entity: SimEntity): Vec3 {
  const body = entity.bodies.find((b) => b.primary)?.body ?? entity.bodies[0]?.body;
  if (!body) return [0, 0, 0];
  const v = body.linvel();
  return [v.x, v.y, v.z];
}

export function entityPosition(entity: SimEntity): Vec3 {
  const body = entity.bodies.find((b) => b.primary)?.body ?? entity.bodies[0]?.body;
  if (!body) return [0, 0, 0];
  const t = body.translation();
  return [t.x, t.y, t.z];
}

export function entityRotation(entity: SimEntity): Quat {
  const body = entity.bodies.find((b) => b.primary)?.body ?? entity.bodies[0]?.body;
  if (!body) return [0, 0, 0, 1];
  const q = body.rotation();
  return [q.x, q.y, q.z, q.w];
}

void quatInverse;
