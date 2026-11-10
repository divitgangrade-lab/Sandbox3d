/** WebGL setup: sky, grid floor, lighting, shadows, environment and the render bridge. */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MAX_PIXEL_RATIO, SHADOW_MAP_SIZE } from '../core/config';
import { GeometryFactory } from './geometry';
import { RenderBridge } from './RenderBridge';
import { FxSystem } from './fx';
import type { SimWorld } from '../sim/SimWorld';

function makeGridTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#121a25';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(122, 158, 196, 0.085)';
  ctx.lineWidth = 1;
  for (let i = 32; i < size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(size, i + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(146, 190, 235, 0.16)';
  ctx.lineWidth = 2;
  for (let i = 128; i < size; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(size, i + 0.5);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 60);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly factory = new GeometryFactory();
  readonly bridge: RenderBridge;
  readonly fx: FxSystem;

  private readonly environmentTexture: THREE.Texture | null = null;
  private readonly sky: THREE.Mesh;
  private readonly ground: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement, world: SimWorld) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.fog = new THREE.Fog(0x0b1220, 42, 135);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    try {
      const room = new RoomEnvironment();
      this.environmentTexture = pmrem.fromScene(room, 0.03).texture;
      this.scene.environment = this.environmentTexture;
      this.scene.environmentIntensity = 0.32;
      room.dispose();
    } catch {
      this.scene.environment = null;
    }
    pmrem.dispose();

    this.sky = this.createSky();
    this.scene.add(this.sky);
    this.ground = this.createGround();
    this.scene.add(this.ground);

    const hemi = new THREE.HemisphereLight(0xaaccff, 0x17202b, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff1d8, 2.35);
    key.position.set(16, 24, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    key.shadow.camera.left = -24;
    key.shadow.camera.right = 24;
    key.shadow.camera.top = 24;
    key.shadow.camera.bottom = -24;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 80;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.035;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x6ea8ff, 0.24);
    fill.position.set(-14, 9, -16);
    this.scene.add(fill);

    this.bridge = new RenderBridge(this.scene, world, this.factory);
    this.fx = new FxSystem(this.scene);
  }

  private createSky(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(260, 32, 16);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1f3a63) },
        bottomColor: { value: new THREE.Color(0x070b12) },
        horizonColor: { value: new THREE.Color(0x2d4563) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 lower = mix(bottomColor, horizonColor, smoothstep(-0.25, 0.08, h));
          vec3 color = mix(lower, topColor, smoothstep(0.02, 0.8, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }

  private createGround(): THREE.Mesh {
    const texture = makeGridTexture();
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0.06,
      color: 0xffffff,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  }

  resize(width: number, height: number, camera: THREE.PerspectiveCamera): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  render(camera: THREE.Camera, shake: THREE.Vector3): void {
    if (shake.lengthSq() > 0) {
      camera.position.add(shake);
      this.renderer.render(this.scene, camera);
      camera.position.sub(shake);
    } else {
      this.renderer.render(this.scene, camera);
    }
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  get triangles(): number {
    return this.renderer.info.render.triangles;
  }

  get pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  setPixelRatio(ratio: number): void {
    this.renderer.setPixelRatio(Math.min(ratio, MAX_PIXEL_RATIO));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  dispose(): void {
    this.bridge.dispose();
    this.fx.dispose();
    this.factory.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        object.geometry?.dispose();
      }
    });
    this.environmentTexture?.dispose();
    this.renderer.dispose();
  }
}
