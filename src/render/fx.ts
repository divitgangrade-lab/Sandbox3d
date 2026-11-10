/** Pooled particles, shockwaves, scorch marks and camera shake. */

import * as THREE from 'three';
import { MAX_PARTICLES, MAX_SCORCHES, MAX_SHOCKWAVES } from '../core/config';
import type { Vec3 } from '../core/math';

function makeSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class FxSystem {
  private readonly points: THREE.Points;
  private readonly positions = new Float32Array(MAX_PARTICLES * 3);
  private readonly colors = new Float32Array(MAX_PARTICLES * 3);
  private readonly baseColors = new Float32Array(MAX_PARTICLES * 3);
  private readonly velocities = new Float32Array(MAX_PARTICLES * 3);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly maxLife = new Float32Array(MAX_PARTICLES);
  private readonly gravity = new Float32Array(MAX_PARTICLES);
  private nextParticle = 0;

  private readonly shockwaves: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; life: number; maxLife: number; radius: number }[] = [];
  private readonly scorches: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; life: number }[] = [];

  private shakeAmount = 0;
  private readonly color = new THREE.Color();
  readonly shakeOffset = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.32,
      map: makeSpriteTexture(),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -999;

    const ringGeometry = new THREE.RingGeometry(0.82, 1, 48);
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffc06a,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(ringGeometry, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.08;
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({ mesh, material: mat, life: 0, maxLife: 0.55, radius: 1 });
    }

    const scorchGeometry = new THREE.CircleGeometry(1, 28);
    for (let i = 0; i < MAX_SCORCHES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x05070a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(scorchGeometry, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.015;
      mesh.scale.setScalar(0.9);
      mesh.visible = false;
      this.scene.add(mesh);
      this.scorches.push({ mesh, material: mat, life: 0 });
    }
  }

  private emitParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: THREE.Color,
    life: number,
    gravity: number,
  ): void {
    const i = this.nextParticle;
    this.nextParticle = (this.nextParticle + 1) % MAX_PARTICLES;
    const p = i * 3;
    this.positions[p] = x;
    this.positions[p + 1] = y;
    this.positions[p + 2] = z;
    this.velocities[p] = vx;
    this.velocities[p + 1] = vy;
    this.velocities[p + 2] = vz;
    this.baseColors[p] = color.r;
    this.baseColors[p + 1] = color.g;
    this.baseColors[p + 2] = color.b;
    this.colors[p] = color.r;
    this.colors[p + 1] = color.g;
    this.colors[p + 2] = color.b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.gravity[i] = gravity;
  }

  burst(position: Vec3, color: string, count = 20, speed = 4, gravity = 9, life = 0.8): void {
    this.color.set(color);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.25 + Math.random() * 0.9);
      this.emitParticle(
        position[0] + (Math.random() - 0.5) * 0.2,
        position[1] + (Math.random() - 0.5) * 0.2,
        position[2] + (Math.random() - 0.5) * 0.2,
        Math.sin(phi) * Math.cos(theta) * s,
        Math.abs(Math.cos(phi)) * s * 0.9 + 1.2,
        Math.sin(phi) * Math.sin(theta) * s,
        this.color,
        life * (0.5 + Math.random() * 0.9),
        gravity,
      );
    }
    this.touchPoints();
  }

  blast(position: Vec3, radius: number, color = '#ff9a3d'): void {
    this.color.set(color);
    for (let i = 0; i < 54; i++) {
      const theta = Math.random() * Math.PI * 2;
      const s = (0.5 + Math.random()) * radius * 0.8;
      this.emitParticle(
        position[0],
        Math.max(position[1], 0.2),
        position[2],
        Math.cos(theta) * s,
        Math.random() * radius * 0.65,
        Math.sin(theta) * s,
        this.color,
        0.55 + Math.random() * 0.9,
        5,
      );
    }
    const smoke = new THREE.Color('#4a4a52');
    for (let i = 0; i < 18; i++) {
      this.emitParticle(
        position[0] + (Math.random() - 0.5) * radius * 0.4,
        position[1] + Math.random() * radius * 0.4,
        position[2] + (Math.random() - 0.5) * radius * 0.4,
        (Math.random() - 0.5) * 1.5,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 1.5,
        smoke,
        1.5 + Math.random() * 1.2,
        -0.2,
      );
    }
    this.spawnShockwave(position, radius);
    this.spawnScorch(position, radius);
    this.shakeAmount = Math.min(1.4, this.shakeAmount + radius * 0.055);
    this.touchPoints();
  }

  breakBurst(position: Vec3, color: string): void {
    this.burst(position, color, 26, 5.5, 10, 1.1);
    this.shakeAmount = Math.min(1, this.shakeAmount + 0.16);
  }

  spawnPuff(position: Vec3, color = '#b8ff5a'): void {
    this.burst(position, color, 8, 1.4, 2.5, 0.45);
  }

  muzzle(position: Vec3, direction: Vec3): void {
    this.color.set('#ffd48a');
    for (let i = 0; i < 6; i++) {
      this.emitParticle(
        position[0],
        position[1],
        position[2],
        direction[0] * (2 + Math.random() * 4) + (Math.random() - 0.5),
        direction[1] * 4 + (Math.random() - 0.5),
        direction[2] * (2 + Math.random() * 4) + (Math.random() - 0.5),
        this.color,
        0.12 + Math.random() * 0.1,
        0,
      );
    }
    this.shakeAmount = Math.min(1, this.shakeAmount + 0.08);
    this.touchPoints();
  }

  private spawnShockwave(position: Vec3, radius: number): void {
    const available = this.shockwaves.find((s) => s.life <= 0) ?? this.shockwaves[0];
    if (!available) return;
    available.life = available.maxLife;
    available.radius = radius;
    available.mesh.position.set(position[0], 0.08, position[2]);
    available.mesh.visible = true;
    available.mesh.scale.setScalar(radius * 0.25);
    available.material.opacity = 0.75;
  }

  private spawnScorch(position: Vec3, radius: number): void {
    const available = this.scorches.find((s) => s.life <= 0) ?? this.scorches[0];
    if (!available) return;
    available.life = 7;
    available.mesh.position.set(position[0], 0.015, position[2]);
    available.mesh.visible = true;
    available.mesh.scale.setScalar(Math.max(0.5, radius * 0.3));
    available.material.opacity = 0.34;
  }

  private touchPoints(): void {
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      if (this.life[i] <= 0) {
        this.positions[p + 1] = -999;
        this.colors[p] = 0;
        this.colors[p + 1] = 0;
        this.colors[p + 2] = 0;
        continue;
      }
      this.velocities[p + 1] -= this.gravity[i] * dt;
      const drag = Math.max(0, 1 - dt * 1.2);
      this.velocities[p] *= drag;
      this.velocities[p + 1] *= drag;
      this.velocities[p + 2] *= drag;
      this.positions[p] += this.velocities[p] * dt;
      this.positions[p + 1] += this.velocities[p + 1] * dt;
      this.positions[p + 2] += this.velocities[p + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const fade = t * t;
      this.colors[p] = this.baseColors[p] * fade;
      this.colors[p + 1] = this.baseColors[p + 1] * fade;
      this.colors[p + 2] = this.baseColors[p + 2] * fade;
    }
    this.touchPoints();

    for (const wave of this.shockwaves) {
      if (wave.life <= 0) continue;
      wave.life -= dt;
      const t = Math.max(0, wave.life / wave.maxLife);
      wave.material.opacity = t * 0.7;
      wave.mesh.scale.setScalar(wave.radius * (0.3 + (1 - t) * 0.85));
      if (wave.life <= 0) wave.mesh.visible = false;
    }

    for (const scorch of this.scorches) {
      if (scorch.life <= 0) continue;
      scorch.life -= dt;
      scorch.material.opacity = Math.min(0.34, scorch.life * 0.085);
      if (scorch.life <= 0) scorch.mesh.visible = false;
    }

    this.shakeAmount *= Math.exp(-dt * 7);
    if (this.shakeAmount < 0.002) this.shakeAmount = 0;
    this.shakeOffset.set(
      (Math.random() - 0.5) * this.shakeAmount * 0.42,
      (Math.random() - 0.5) * this.shakeAmount * 0.32,
      (Math.random() - 0.5) * this.shakeAmount * 0.42,
    );
  }

  get shake(): number {
    return this.shakeAmount;
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    const material = this.points.material as THREE.PointsMaterial;
    material.map?.dispose();
    material.dispose();
    for (const wave of this.shockwaves) {
      this.scene.remove(wave.mesh);
      wave.material.dispose();
    }
    for (const scorch of this.scorches) {
      this.scene.remove(scorch.mesh);
      scorch.material.dispose();
    }
  }
}
