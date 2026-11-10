/** Translucent preview of the object that will be spawned. */

import * as THREE from 'three';
import { buildPlan, planBounds } from '../sim/builders';
import { makeRng, quatFromEuler } from '../core/math';
import type { ObjectDef } from '../catalog/types';
import type { GeometryFactory } from './geometry';

export class GhostPreview {
  private readonly group = new THREE.Group();
  private readonly material = new THREE.MeshBasicMaterial({
    color: 0xb8ff5a,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private currentId = '';
  private lift = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly factory: GeometryFactory,
  ) {
    this.group.name = 'ghost-preview';
    this.group.visible = false;
    this.scene.add(this.group);
  }

  get defId(): string {
    return this.currentId;
  }

  setDef(def: ObjectDef): void {
    if (this.currentId === def.id) return;
    this.currentId = def.id;
    this.clear();
    const plan = buildPlan(def, '#ffffff', makeRng(1));
    if (plan.bodies.length === 0) return;
    this.lift = -planBounds(plan).min[1] + 0.015;

    for (const planned of plan.bodies) {
      const bodyQuat = new THREE.Quaternion(...(planned.quat ?? [0, 0, 0, 1]));
      for (const plannedPart of planned.parts) {
        const spec = this.factory.get(plannedPart.shape);
        if (spec.geometry.attributes.position === undefined) continue;
        const mesh = new THREE.Mesh(spec.geometry, this.material);
        const partQuat = new THREE.Quaternion(
          ...quatFromEuler(...(plannedPart.rot ?? [0, 0, 0])),
        );
        mesh.quaternion.copy(bodyQuat).multiply(partQuat);
        const local = new THREE.Vector3(...(plannedPart.pos ?? [0, 0, 0]));
        local.applyQuaternion(bodyQuat).add(new THREE.Vector3(...planned.pos));
        mesh.position.copy(local);
        mesh.scale.copy(spec.scale);
        mesh.renderOrder = 4;
        this.group.add(mesh);
      }
    }
  }

  show(point: readonly [number, number, number], scale: number): void {
    if (this.group.children.length === 0) return;
    this.group.position.set(point[0], point[1] + this.lift * scale, point[2]);
    this.group.scale.setScalar(scale);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  private clear(): void {
    for (const child of [...this.group.children]) this.group.remove(child);
    this.group.visible = false;
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.group);
    this.material.dispose();
  }
}

/** Wireframe box shown around the object under the cursor. */
export class HoverHighlight {
  private readonly line: THREE.LineSegments;
  private readonly material = new THREE.LineBasicMaterial({
    color: 0xb8ff5a,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.line = new THREE.LineSegments(geometry, this.material);
    this.line.renderOrder = 12;
    this.line.visible = false;
    scene.add(this.line);
  }

  show(center: readonly [number, number, number], radius: number, color: string): void {
    this.line.position.set(center[0], center[1], center[2]);
    this.line.scale.setScalar(Math.max(0.35, radius * 2));
    this.material.color.set(color);
    this.line.visible = true;
  }

  hide(): void {
    this.line.visible = false;
  }

  dispose(): void {
    this.line.geometry.dispose();
    this.material.dispose();
    this.line.removeFromParent();
  }
}
