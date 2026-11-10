/**
 * Versioned, testable world snapshots. Rendering and browser storage are deliberately kept out of
 * this module: it only turns SimWorld state into plain JSON and restores it through SimWorld APIs.
 */

import type { ObjectDef } from '../catalog/types';
import type { Quat, Vec3 } from '../core/math';
import type { SimWorld } from './SimWorld';
import type { BodyPoseSnapshot, SimEntity } from './types';

export const WORLD_FORMAT = 'sandbox3d-world';
export const WORLD_FORMAT_VERSION = 1;
export const MAX_SNAPSHOT_ENTITIES = 5000;

export interface SavedEntity {
  defId: string;
  position: Vec3;
  rotation: Quat;
  scale: number;
  color: string;
  hp: number;
  fuse: number | null;
  engineOn: boolean;
  standing: boolean;
  poses: BodyPoseSnapshot[];
}

export interface WorldSnapshot {
  format: typeof WORLD_FORMAT;
  version: number;
  savedAt: number;
  gravity: number;
  paused: boolean;
  timeScale: number;
  entities: SavedEntity[];
}

export interface RestoreResult {
  restored: number;
  skipped: { defId: string; reason: string }[];
}

export interface RestoreOptions {
  /** Preserve the current pause/time settings instead of restoring the save's values. */
  preserveRuntime?: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

function isQuat(value: unknown): value is Quat {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber);
}

function isPose(value: unknown): value is BodyPoseSnapshot {
  if (!value || typeof value !== 'object') return false;
  const pose = value as Partial<BodyPoseSnapshot>;
  if (!isVec3(pose.position) || !isQuat(pose.rotation)) return false;
  if (pose.linearVelocity !== undefined && !isVec3(pose.linearVelocity)) return false;
  if (pose.angularVelocity !== undefined && !isVec3(pose.angularVelocity)) return false;
  return true;
}

/** Serializable, deep-cloned snapshot of every entity currently in the world. */
export function snapshotWorld(world: SimWorld): WorldSnapshot {
  const entities: SavedEntity[] = [];
  for (const entity of world.entities) {
    if (entity.removed || entity.bodies.length === 0) continue;
    const poses = world.getBodyPoses(entity, true);
    const primaryIndex = Math.max(
      0,
      entity.bodies.findIndex((simBody) => simBody.primary),
    );
    const primary = poses[primaryIndex];
    if (!primary) continue;
    entities.push({
      defId: entity.def.id,
      position: primary.position,
      rotation: primary.rotation,
      scale: entity.scale,
      color: entity.color,
      hp: entity.hp,
      fuse: Number.isFinite(entity.fuse) ? entity.fuse : null,
      engineOn: entity.engineOn,
      standing: entity.standing,
      poses,
    });
  }
  return {
    format: WORLD_FORMAT,
    version: WORLD_FORMAT_VERSION,
    savedAt: Date.now(),
    gravity: world.gravityValue,
    paused: world.isPaused,
    timeScale: world.timeScale,
    entities,
  };
}

/**
 * Restore a snapshot into a world. Unknown catalog entries and changed body layouts are skipped
 * instead of producing invisible or physically invalid entities.
 */
export function restoreWorld(
  world: SimWorld,
  snapshot: WorldSnapshot,
  resolveDef: (id: string) => ObjectDef | undefined,
  options: RestoreOptions = {},
): RestoreResult {
  const skipped: RestoreResult['skipped'] = [];
  const preserve = options.preserveRuntime === true;
  const paused = preserve ? world.isPaused : snapshot.paused;
  const timeScale = preserve ? world.timeScale : snapshot.timeScale;

  world.clear();
  world.setGravity(snapshot.gravity);
  world.setTimeScale(timeScale);
  world.setPaused(paused);

  let restored = 0;
  let bodyBudget = world.maxBodies;
  for (const saved of snapshot.entities) {
    const def = resolveDef(saved.defId);
    if (!def) {
      skipped.push({ defId: saved.defId, reason: 'Object is not in this catalog version' });
      continue;
    }
    if (saved.poses.length > bodyBudget) {
      skipped.push({ defId: saved.defId, reason: 'World body limit reached' });
      continue;
    }
    try {
      const entity = world.spawn(def, {
        position: saved.position,
        rotation: saved.rotation,
        scale: saved.scale,
        color: saved.color,
        silent: true,
        ignoreCaps: true,
      });
      if (entity.bodies.length !== saved.poses.length) {
        world.remove(entity);
        skipped.push({
          defId: saved.defId,
          reason: `Body layout changed (${saved.poses.length} → ${entity.bodies.length})`,
        });
        continue;
      }
      entity.hp = saved.hp;
      entity.fuse = saved.fuse;
      entity.standing = def.kind === 'ragdoll' ? saved.standing : false;
      if (!entity.standing) entity.standPose = null;
      world.applyBodyPoses(entity, saved.poses);
      if (saved.engineOn && def.vehicle) world.setVehicleEngine(entity, true);
      // Only charge the body budget once the entity is actually in the world. A skipped or
      // dropped entry must not stop later entries in an old save from being restored.
      bodyBudget -= saved.poses.length;
      restored++;
    } catch (error) {
      skipped.push({
        defId: saved.defId,
        reason: error instanceof Error ? error.message : 'Could not restore object',
      });
    }
  }
  return { restored, skipped };
}

export function serializeWorldSnapshot(snapshot: WorldSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/** Parse and validate a save file. Throws a readable error for UI reporting. */
export function parseWorldSnapshot(text: string): WorldSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object') throw new Error('That file is not a Sandbox3D save.');
  const data = raw as Record<string, unknown>;
  if (data.format !== WORLD_FORMAT) {
    throw new Error('That JSON file is not a Sandbox3D world save.');
  }
  if (!isFiniteNumber(data.version) || !Number.isInteger(data.version)) {
    throw new Error('The save file has no valid format version.');
  }
  if (data.version > WORLD_FORMAT_VERSION) {
    throw new Error(
      `This save was made by a newer Sandbox3D (v${data.version}); this build supports v${WORLD_FORMAT_VERSION}.`,
    );
  }
  if (data.version < WORLD_FORMAT_VERSION) {
    throw new Error(
      `This save uses the retired v${data.version} format and cannot be loaded by this build.`,
    );
  }
  if (!isFiniteNumber(data.gravity) || !isFiniteNumber(data.timeScale)) {
    throw new Error('The save file has invalid world settings.');
  }
  if (!Array.isArray(data.entities)) throw new Error('The save file has no object list.');
  if (data.entities.length > MAX_SNAPSHOT_ENTITIES) {
    throw new Error(`The save contains more than ${MAX_SNAPSHOT_ENTITIES} objects.`);
  }

  const entities: SavedEntity[] = [];
  for (let index = 0; index < data.entities.length; index++) {
    const rawEntity = data.entities[index];
    if (!rawEntity || typeof rawEntity !== 'object') {
      throw new Error(`Object ${index + 1} in the save is malformed.`);
    }
    const entity = rawEntity as Record<string, unknown>;
    if (typeof entity.defId !== 'string' || entity.defId.length === 0) {
      throw new Error(`Object ${index + 1} has no catalog id.`);
    }
    if (!isVec3(entity.position) || !isQuat(entity.rotation)) {
      throw new Error(`Object ${index + 1} has invalid coordinates.`);
    }
    if (!isFiniteNumber(entity.scale) || entity.scale <= 0 || entity.scale > 20) {
      throw new Error(`Object ${index + 1} has an invalid scale.`);
    }
    if (typeof entity.color !== 'string' || !Array.isArray(entity.poses)) {
      throw new Error(`Object ${index + 1} is missing its body poses.`);
    }
    if (entity.poses.length === 0 || entity.poses.length > 5000) {
      throw new Error(`Object ${index + 1} has an invalid body count.`);
    }
    if (!entity.poses.every(isPose)) {
      throw new Error(`Object ${index + 1} has an invalid body pose.`);
    }
    const fuse =
      entity.fuse === null || entity.fuse === undefined
        ? null
        : isFiniteNumber(entity.fuse)
          ? entity.fuse
          : null;
    entities.push({
      defId: entity.defId,
      position: entity.position,
      rotation: entity.rotation,
      scale: entity.scale,
      color: entity.color,
      hp: isFiniteNumber(entity.hp) ? entity.hp : 100,
      fuse,
      engineOn: entity.engineOn === true,
      standing: entity.standing === true,
      poses: entity.poses,
    });
  }

  return {
    format: WORLD_FORMAT,
    version: WORLD_FORMAT_VERSION,
    savedAt: isFiniteNumber(data.savedAt) ? data.savedAt : Date.now(),
    gravity: data.gravity,
    paused: data.paused === true,
    timeScale: Math.max(0.05, Math.min(2, data.timeScale)),
    entities,
  };
}

/** Convenience used by tests and import flows. */
export function cloneEntityPoses(entity: SimEntity): BodyPoseSnapshot[] {
  return entity.bodies.map((simBody) => {
    const t = simBody.body.translation();
    const q = simBody.body.rotation();
    return { position: [t.x, t.y, t.z], rotation: [q.x, q.y, q.z, q.w] };
  });
}
