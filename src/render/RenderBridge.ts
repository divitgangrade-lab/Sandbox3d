/** Keeps instanced visual parts in sync with physics bodies. */

import * as THREE from 'three';
import { BatchManager, type BatchHandle } from './batches';
import type { GeometryFactory } from './geometry';
import type { SimEntity } from '../sim/types';
import type { SimWorld } from '../sim/SimWorld';

interface PartHandle extends BatchHandle {
  body: { translation(): { x: number; y: number; z: number }; rotation(): { x: number; y: number; z: number; w: number } };
  local: THREE.Matrix4;
}

interface EntityRecord {
  handles: PartHandle[];
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);
const _bodyMatrix = new THREE.Matrix4();
const _matrix = new THREE.Matrix4();

export class RenderBridge {
  readonly batches: BatchManager;
  private readonly records = new Map<number, EntityRecord>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: SimWorld,
    private readonly factory: GeometryFactory,
  ) {
    this.batches = new BatchManager(scene, factory);
  }

  get instanceCount(): number {
    return this.records.size;
  }

  sync(): void {
    const seen = new Set<number>();
    for (const entity of this.world.entities) {
      seen.add(entity.id);
      let record = this.records.get(entity.id);
      if (!record) {
        record = { handles: this.attach(entity) };
        this.records.set(entity.id, record);
      }
      this.updateRecord(record);
    }
    for (const [id, record] of this.records) {
      if (seen.has(id)) continue;
      this.detach(record);
      this.records.delete(id);
    }
    this.batches.flush();
  }

  private attach(entity: SimEntity): PartHandle[] {
    const handles: PartHandle[] = [];
    for (const simBody of entity.bodies) {
      for (const part of simBody.parts) {
        const handle = this.batches.acquire(part.shape, part.material, part.color);
        const local = new THREE.Matrix4().compose(
          new THREE.Vector3(part.localPos[0], part.localPos[1], part.localPos[2]),
          new THREE.Quaternion(part.localQuat[0], part.localQuat[1], part.localQuat[2], part.localQuat[3]),
          this.factory.get(part.shape).scale,
        );
        handles.push({ ...handle, body: simBody.body, local });
      }
    }
    return handles;
  }

  private updateRecord(record: EntityRecord): void {
    for (const handle of record.handles) {
      const t = handle.body.translation();
      const r = handle.body.rotation();
      _pos.set(t.x, t.y, t.z);
      _quat.set(r.x, r.y, r.z, r.w);
      _bodyMatrix.compose(_pos, _quat, _one);
      _matrix.multiplyMatrices(_bodyMatrix, handle.local);
      handle.batch.setMatrix(handle.slot, _matrix);
    }
  }

  private detach(record: EntityRecord): void {
    for (const handle of record.handles) handle.batch.release(handle.slot);
    record.handles.length = 0;
  }

  dispose(): void {
    for (const record of this.records.values()) this.detach(record);
    this.records.clear();
    this.batches.dispose();
  }

  removeAll(): void {
    for (const [id, record] of this.records) {
      this.detach(record);
      this.records.delete(id);
    }
  }

  // Keeps the scene reference used by batches discoverable for debugging.
  get sceneRef(): THREE.Scene {
    return this.scene;
  }
}
