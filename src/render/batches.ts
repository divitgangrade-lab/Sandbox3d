/** Batched instanced meshes, keyed by geometry + material. */

import * as THREE from 'three';
import type { GeometryFactory } from './geometry';
import type { MaterialName } from '../catalog/materials';
import type { PrimitiveShape } from '../catalog/types';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const WHITE = new THREE.Color(0xffffff);
const scratchColor = new THREE.Color();

export class InstanceBatch {
  mesh: THREE.InstancedMesh;
  private capacity: number;
  private cursor = 0;
  private live = 0;
  private readonly freeSlots: number[] = [];
  private readonly scene: THREE.Scene;
  private boundsTick = 0;

  constructor(
    scene: THREE.Scene,
    private readonly geometry: THREE.BufferGeometry,
    private readonly material: THREE.Material,
    initialCapacity = 64,
  ) {
    this.scene = scene;
    this.capacity = initialCapacity;
    this.mesh = this.create(initialCapacity);
    scene.add(this.mesh);
  }

  private create(capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = capacity;
    mesh.castShadow = !this.material.transparent;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 180);
    for (let i = 0; i < capacity; i++) {
      mesh.setMatrixAt(i, ZERO);
      mesh.setColorAt(i, WHITE);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  get liveCount(): number {
    return this.live;
  }

  acquire(color: string): number {
    let slot: number;
    const free = this.freeSlots.pop();
    if (free !== undefined) {
      slot = free;
    } else if (this.cursor < this.capacity) {
      slot = this.cursor++;
    } else {
      this.grow();
      slot = this.cursor++;
    }
    scratchColor.set(color);
    this.mesh.setColorAt(slot, scratchColor);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.live++;
    return slot;
  }

  release(slot: number): void {
    if (slot < 0 || slot >= this.capacity) return;
    this.mesh.setMatrixAt(slot, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.freeSlots.push(slot);
    this.live = Math.max(0, this.live - 1);
  }

  setMatrix(slot: number, matrix: THREE.Matrix4): void {
    this.mesh.setMatrixAt(slot, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  flush(): void {
    this.boundsTick++;
    if (this.boundsTick % 120 === 0) this.updateBounds();
  }

  private updateBounds(): void {
    const array = this.mesh.instanceMatrix.array;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < array.length; i += 16) {
      const sx = array[i]!;
      const sy = array[i + 5]!;
      const sz = array[i + 10]!;
      if (sx === 0 && sy === 0 && sz === 0) continue;
      const x = array[i + 12]!;
      const y = array[i + 13]!;
      const z = array[i + 14]!;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    if (!Number.isFinite(minX)) return;
    const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 4;
    this.mesh.boundingSphere = new THREE.Sphere(center, radius);
  }

  private grow(): void {
    const nextCapacity = this.capacity * 2;
    const next = this.create(nextCapacity);
    next.instanceMatrix.array.set(this.mesh.instanceMatrix.array);
    if (this.mesh.instanceColor && next.instanceColor) {
      next.instanceColor.array.set(this.mesh.instanceColor.array);
      next.instanceColor.needsUpdate = true;
    }
    next.instanceMatrix.needsUpdate = true;
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = next;
    this.capacity = nextCapacity;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
  }
}

export interface BatchHandle {
  batch: InstanceBatch;
  slot: number;
}

export class BatchManager {
  private readonly batches = new Map<string, InstanceBatch>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly factory: GeometryFactory,
  ) {}

  acquire(shape: PrimitiveShape, material: MaterialName, color: string): BatchHandle {
    const spec = this.factory.get(shape);
    const key = `${spec.key}|${material}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = new InstanceBatch(this.scene, spec.geometry, this.factory.getMaterial(material), 64);
      this.batches.set(key, batch);
    }
    return { batch, slot: batch.acquire(color) };
  }

  get(shape: PrimitiveShape, material: MaterialName): InstanceBatch | null {
    const spec = this.factory.get(shape);
    return this.batches.get(`${spec.key}|${material}`) ?? null;
  }

  flush(): void {
    for (const batch of this.batches.values()) batch.flush();
  }

  dispose(): void {
    for (const batch of this.batches.values()) batch.dispose();
    this.batches.clear();
  }
}
