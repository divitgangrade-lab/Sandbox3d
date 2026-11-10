/** Unit-geometry cache + PBR materials. Unit primitives let one InstancedMesh serve every size. */

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { MATERIALS, type MaterialName } from '../catalog/materials';
import type { PrimitiveShape } from '../catalog/types';

export interface GeometrySpec {
  key: string;
  geometry: THREE.BufferGeometry;
  scale: THREE.Vector3;
}

function hashPoints(points: readonly number[]): number {
  let hash = 2166136261;
  for (const value of points) {
    hash ^= Math.round(value * 1000) | 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class GeometryFactory {
  private readonly specs = new Map<string, GeometrySpec>();
  private readonly materials = new Map<MaterialName, THREE.MeshStandardMaterial>();
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly unitSphere = new THREE.SphereGeometry(1, 16, 12);
  private readonly unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 18);
  private readonly unitCone = new THREE.ConeGeometry(1, 1, 20);

  get(shape: PrimitiveShape): GeometrySpec {
    switch (shape.kind) {
      case 'box':
        return {
          key: 'box',
          geometry: this.unitBox,
          scale: new THREE.Vector3(shape.hx * 2, shape.hy * 2, shape.hz * 2),
        };
      case 'sphere':
        return { key: 'sphere', geometry: this.unitSphere, scale: new THREE.Vector3(shape.r, shape.r, shape.r) };
      case 'cylinder':
        return {
          key: 'cylinder',
          geometry: this.unitCylinder,
          scale: new THREE.Vector3(shape.r, shape.hh * 2, shape.r),
        };
      case 'cone':
        return {
          key: 'cone',
          geometry: this.unitCone,
          scale: new THREE.Vector3(shape.r, shape.hh * 2, shape.r),
        };
      case 'capsule': {
        const key = `capsule:${shape.r.toFixed(3)}:${shape.hh.toFixed(3)}`;
        let spec = this.specs.get(key);
        if (!spec) {
          spec = {
            key,
            geometry: new THREE.CapsuleGeometry(shape.r, shape.hh * 2, 4, 10),
            scale: new THREE.Vector3(1, 1, 1),
          };
          this.specs.set(key, spec);
        }
        return spec;
      }
      case 'hull': {
        const hash = hashPoints(shape.points);
        const key = `hull:${hash}`;
        let spec = this.specs.get(key);
        if (!spec) {
          try {
            const vertices: THREE.Vector3[] = [];
            for (let i = 0; i + 2 < shape.points.length; i += 3) {
              vertices.push(
                new THREE.Vector3(shape.points[i]!, shape.points[i + 1]!, shape.points[i + 2]!),
              );
            }
            spec = { key, geometry: new ConvexGeometry(vertices), scale: new THREE.Vector3(1, 1, 1) };
          } catch {
            let ex = 0.1;
            let ey = 0.1;
            let ez = 0.1;
            for (let i = 0; i + 2 < shape.points.length; i += 3) {
              ex = Math.max(ex, Math.abs(shape.points[i]!));
              ey = Math.max(ey, Math.abs(shape.points[i + 1]!));
              ez = Math.max(ez, Math.abs(shape.points[i + 2]!));
            }
            spec = {
              key: 'box',
              geometry: this.unitBox,
              scale: new THREE.Vector3(ex * 2, ey * 2, ez * 2),
            };
          }
          this.specs.set(key, spec);
        }
        return spec;
      }
    }
  }

  getMaterial(name: MaterialName): THREE.MeshStandardMaterial {
    let material = this.materials.get(name);
    if (material) return material;
    const preset = MATERIALS[name];
    const transparent = preset.opacity !== undefined;
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: preset.roughness,
      metalness: preset.metalness,
      transparent,
      opacity: preset.opacity ?? 1,
      depthWrite: !transparent,
      envMapIntensity: name === 'metal' || name === 'gold' ? 1.4 : 0.65,
    });
    material.name = name;
    if (name === 'glass' || name === 'water') {
      material.roughness = Math.min(material.roughness, 0.15);
    }
    this.materials.set(name, material);
    return material;
  }

  dispose(): void {
    this.unitBox.dispose();
    this.unitSphere.dispose();
    this.unitCylinder.dispose();
    this.unitCone.dispose();
    for (const spec of this.specs.values()) spec.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.specs.clear();
    this.materials.clear();
  }
}
