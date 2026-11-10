/** Damped orbit/pan/zoom camera with WASD panning and screen-ray helpers. */

import * as THREE from 'three';
import {
  DEFAULT_CAMERA_AZIMUTH,
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_CAMERA_POLAR,
  DEFAULT_CAMERA_TARGET,
} from '../core/config';
import { clamp, type Vec3 } from '../core/math';
import type { Input } from './input';

export class OrbitCamera {
  readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 320);

  private target = new THREE.Vector3(...DEFAULT_CAMERA_TARGET);
  private desiredTarget = new THREE.Vector3(...DEFAULT_CAMERA_TARGET);
  private distance = DEFAULT_CAMERA_DISTANCE;
  private desiredDistance = DEFAULT_CAMERA_DISTANCE;
  private azimuth = DEFAULT_CAMERA_AZIMUTH;
  private desiredAzimuth = DEFAULT_CAMERA_AZIMUTH;
  private polar = DEFAULT_CAMERA_POLAR;
  private desiredPolar = DEFAULT_CAMERA_POLAR;

  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  update(input: Input, dt: number): void {
    if (input.lookX !== 0 || input.lookY !== 0) {
      this.desiredAzimuth -= input.lookX * 0.0052;
      this.desiredPolar = clamp(this.desiredPolar - input.lookY * 0.0042, 0.16, 1.46);
    }

    if (input.panX !== 0 || input.panY !== 0) {
      const scale = this.desiredDistance * 0.00145;
      this.computeBasis();
      this.desiredTarget.addScaledVector(this.right, -input.panX * scale);
      this.desiredTarget.addScaledVector(this.forward, input.panY * scale);
    }

    if (input.wheel !== 0) {
      this.desiredDistance = clamp(
        this.desiredDistance * Math.exp(input.wheel * 0.0011),
        3,
        70,
      );
    }

    const panSpeed = this.desiredDistance * 0.62 * dt;
    this.computeBasis();
    if (!input.cameraPanEnabled) {
      this.desiredTarget.y = clamp(this.desiredTarget.y, 0.25, 14);
      this.desiredTarget.x = clamp(this.desiredTarget.x, -90, 90);
      this.desiredTarget.z = clamp(this.desiredTarget.z, -90, 90);
      const smoothDriving = 1 - Math.exp(-dt * 12);
      this.target.lerp(this.desiredTarget, smoothDriving);
      this.distance += (this.desiredDistance - this.distance) * smoothDriving;
      this.azimuth += (this.desiredAzimuth - this.azimuth) * smoothDriving;
      this.polar += (this.desiredPolar - this.polar) * smoothDriving;
      const spDriving = Math.sin(this.polar);
      this.camera.position.set(
        this.target.x + this.distance * spDriving * Math.sin(this.azimuth),
        this.target.y + this.distance * Math.cos(this.polar),
        this.target.z + this.distance * spDriving * Math.cos(this.azimuth),
      );
      this.camera.lookAt(this.target);
      this.camera.updateMatrixWorld();
      return;
    }
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) {
      this.desiredTarget.addScaledVector(this.forward, panSpeed);
    }
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
      this.desiredTarget.addScaledVector(this.forward, -panSpeed);
    }
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) {
      this.desiredTarget.addScaledVector(this.right, -panSpeed);
    }
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) {
      this.desiredTarget.addScaledVector(this.right, panSpeed);
    }
    if (input.isDown('KeyQ')) this.desiredAzimuth += dt * 1.4;
    if (input.isDown('KeyE')) this.desiredAzimuth -= dt * 1.4;

    this.desiredTarget.y = clamp(this.desiredTarget.y, 0.25, 14);
    this.desiredTarget.x = clamp(this.desiredTarget.x, -90, 90);
    this.desiredTarget.z = clamp(this.desiredTarget.z, -90, 90);

    const smooth = 1 - Math.exp(-dt * 12);
    this.target.lerp(this.desiredTarget, smooth);
    this.distance += (this.desiredDistance - this.distance) * smooth;
    this.azimuth += (this.desiredAzimuth - this.azimuth) * smooth;
    this.polar += (this.desiredPolar - this.polar) * smooth;

    const sp = Math.sin(this.polar);
    this.camera.position.set(
      this.target.x + this.distance * sp * Math.sin(this.azimuth),
      this.target.y + this.distance * Math.cos(this.polar),
      this.target.z + this.distance * sp * Math.cos(this.azimuth),
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private computeBasis(): void {
    this.forward.set(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth)).normalize();
    this.right.set(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth)).normalize();
  }

  ray(ndcX: number, ndcY: number): { origin: THREE.Vector3; direction: THREE.Vector3 } {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return {
      origin: this.raycaster.ray.origin.clone(),
      direction: this.raycaster.ray.direction.clone().normalize(),
    };
  }

  pointOnRay(ndcX: number, ndcY: number, distance: number): THREE.Vector3 {
    const { origin, direction } = this.ray(ndcX, ndcY);
    return origin.addScaledVector(direction, distance);
  }

  /** Keep the orbit centre on a moving object (used while driving). */
  follow(point: Vec3): void {
    this.desiredTarget.set(point[0], Math.max(point[1], 0.8), point[2]);
  }

  /** Current orbit focus, exposed for building and vehicle helpers. */
  get focus(): Vec3 {
    return [this.target.x, this.target.y, this.target.z];
  }

  reset(): void {
    this.desiredTarget.set(...DEFAULT_CAMERA_TARGET);
    this.desiredDistance = DEFAULT_CAMERA_DISTANCE;
    this.desiredAzimuth = DEFAULT_CAMERA_AZIMUTH;
    this.desiredPolar = DEFAULT_CAMERA_POLAR;
  }

  get currentDistance(): number {
    return this.distance;
  }
}
