/** SandboxGame glues physics, rendering, camera, input and UI together. */

import * as THREE from 'three';
import { registry } from '../catalog';
import type { ObjectDef } from '../catalog/types';
import { halfExtents } from '../catalog/shapes';
import { clamp, type Vec3 } from '../core/math';
import { initPhysics } from '../sim/physics';
import { SimWorld } from '../sim/SimWorld';
import { SimGrabber } from '../sim/grabber';
import type { RayHit, SimEntity } from '../sim/types';
import { SceneRenderer } from '../render/scene';
import { GhostPreview, HoverHighlight } from '../render/ghost';
import { OrbitCamera } from './OrbitCamera';
import { Input } from './input';
import { UI, type Tool } from '../ui/ui';
import { mountTopNav, type GooeyNavController } from '../ui/gooeyNavMount';
import { mountLiquidChrome, type LiquidChromeController } from '../ui/liquidChromeMount';
import { mountParticleText, type ParticleTextController } from '../ui/particleTextMount';
import { mountTargetCursor, type TargetCursorController } from '../ui/targetCursorMount';

interface GrabSample {
  point: THREE.Vector3;
  time: number;
}

const TOOL_HINTS: Record<Tool, string> = {
  grab: 'Click and hold an object, drag to move it, release to throw. Press F on a held gun.',
  spawn: 'Click a surface to spawn the selected object. Scroll to zoom, right-drag to orbit.',
  blast: 'Click anywhere to detonate a blast. Chain reactions are encouraged.',
  delete: 'Click an object to remove it from the world.',
};

export class SandboxGame {
  private sim!: SimWorld;
  private scene!: SceneRenderer;
  private camera!: OrbitCamera;
  private input!: Input;
  private ui!: UI;
  private nav!: GooeyNavController;
  private liquidChrome: LiquidChromeController | null = null;
  private helpParticle: ParticleTextController | null = null;
  private targetCursor!: TargetCursorController;
  private grabber!: SimGrabber;
  private ghost!: GhostPreview;
  private hover!: HoverHighlight;
  private readonly canvas: HTMLCanvasElement;

  private selectedDef: ObjectDef;
  private tool: Tool = 'spawn';
  private scale = 1;
  private running = false;
  private raf = 0;
  private lastFrame = 0;
  private fps = 60;
  private statTimer = 0;
  private qualityDropped = false;
  private lowFpsTime = 0;
  private grabDepth = 8;
  private grabSamples: GrabSample[] = [];
  private hoverEntity: SimEntity | null = null;

  constructor() {
    const canvas = document.getElementById('scene');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #scene was not found');
    this.canvas = canvas;
    const initial = registry.get('block') ?? registry.visible()[0];
    if (!initial) throw new Error('The object catalog is empty');
    this.selectedDef = initial;
  }

  async init(): Promise<void> {
    await initPhysics();

    this.sim = new SimWorld({ getDef: (id) => registry.get(id) });
    this.scene = new SceneRenderer(this.canvas, this.sim);
    this.camera = new OrbitCamera();
    this.scene.resize(window.innerWidth, window.innerHeight, this.camera.camera);
    this.input = new Input(this.canvas);
    this.grabber = new SimGrabber(this.sim);
    this.ghost = new GhostPreview(this.scene.scene, this.scene.factory);
    this.hover = new HoverHighlight(this.scene.scene);

    this.ui = new UI(registry, {
      onSelect: (id) => this.selectDef(id),
      onTool: (tool) => this.setTool(tool),
      onTogglePause: () => this.togglePause(),
      onToggleSlow: () => this.toggleSlow(),
      onClear: () => this.clearWorld(),
      onResetView: () => this.resetView(),
      onScale: (scale) => {
        this.scale = scale;
      },
      onHelpChange: (open) => {
        this.nav?.setActive(open ? 2 : 0);
        if (open) {
          const chromeHost = document.getElementById('help-chrome');
          if (chromeHost && !this.liquidChrome) {
            try {
              this.liquidChrome = mountLiquidChrome(chromeHost);
            } catch (error) {
              console.error('[Sandbox3D] LiquidChrome backdrop failed to mount', error);
            }
          }
          const particleHost = document.getElementById('help-particle');
          if (particleHost && !this.helpParticle) {
            try {
              this.helpParticle = mountParticleText(particleHost);
            } catch (error) {
              console.error('[Sandbox3D] ParticleText headline failed to mount', error);
            }
          }
        } else {
          this.liquidChrome?.dispose();
          this.liquidChrome = null;
          this.helpParticle?.dispose();
          this.helpParticle = null;
        }
        if (!open) {
          try {
            localStorage.setItem('sandbox3d.helpSeen', '1');
          } catch {
            // Storage can be unavailable in private modes; help still closes.
          }
        }
      },
    });

    const navContainer = document.getElementById('gooey-nav');
    if (!(navContainer instanceof HTMLElement)) {
      throw new Error('Navigation container #gooey-nav was not found');
    }
    this.nav = mountTopNav(navContainer, (index) => this.handleNav(index));

    const cursorContainer = document.getElementById('target-cursor-root');
    if (!(cursorContainer instanceof HTMLElement)) {
      throw new Error('Target cursor container #target-cursor-root was not found');
    }
    this.targetCursor = mountTargetCursor(cursorContainer);

    this.ghost.setDef(this.selectedDef);
    this.ui.setSelected(this.selectedDef);
    this.ui.setTool(this.tool);
    this.ui.setPaused(false);
    this.ui.setSlow(false);
    this.ui.setHint(TOOL_HINTS.spawn);
    this.seedScene();
    this.scene.bridge.sync();

    this.input.onPointerDown(this.handlePointerDown);
    this.input.onPointerUp(this.handlePointerUp);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibility);

    let seenHelp = false;
    try {
      seenHelp = localStorage.getItem('sandbox3d.helpSeen') === '1';
    } catch {
      seenHelp = false;
    }
    if (!seenHelp) this.ui.showHelp(true);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    this.liquidChrome?.dispose();
    this.liquidChrome = null;
    this.helpParticle?.dispose();
    this.helpParticle = null;
    this.targetCursor.dispose();
    this.ui.dispose();
    this.nav.dispose();
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.input.dispose();
    this.grabber.dispose();
    this.ghost.dispose();
    this.hover.dispose();
    this.scene.dispose();
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const rawDt = this.lastFrame === 0 ? 1 / 60 : (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = clamp(rawDt, 0, 0.05);

    this.camera.update(this.input, dt);
    this.handleKeys();

    if (this.grabber.isGrabbing) {
      this.updateGrab();
    } else {
      this.ui.setDragTip(false);
    }

    this.updateHover();
    this.sim.step(dt);
    this.processEvents();
    this.scene.bridge.sync();
    this.scene.fx.update(dt);
    this.scene.render(this.camera.camera, this.scene.fx.shakeOffset);

    this.updateStats(rawDt, dt);
    this.input.endFrame();
    this.raf = requestAnimationFrame(this.frame);
  };

  private handleKeys(): void {
    const pressed = (code: string) => this.input.wasPressed(code);
    if (pressed('KeyH')) this.ui.showHelp(!this.ui.isHelpOpen);
    if (pressed('Escape')) {
      if (this.ui.isHelpOpen) this.ui.showHelp(false);
      else if (this.grabber.isGrabbing) this.releaseGrab(false);
    }
    if (this.ui.isHelpOpen) return;

    if (pressed('KeyG')) this.setTool('grab');
    if (pressed('KeyS')) this.setTool('spawn');
    if (pressed('KeyB')) this.setTool('blast');
    if (pressed('KeyX')) this.setTool('delete');
    if (pressed('KeyF')) this.useActive();
    if (pressed('Space')) this.togglePause();
    if (pressed('KeyT')) this.toggleSlow();
    if (pressed('KeyC')) this.clearWorld();
    if (pressed('KeyR')) this.resetView();
    if (pressed('Slash')) this.ui.focusSearch();
  }

  private readonly handlePointerDown = (): void => {
    if (this.ui.isHelpOpen) return;
    this.nav?.setActive(0);
    const hit = this.pick();

    switch (this.tool) {
      case 'spawn': {
        if (!hit) {
          this.ui.toast('Aim at the ground or an object to place something', 'warn');
          return;
        }
        this.spawnAt(hit.point);
        break;
      }
      case 'grab': {
        if (!hit?.entity || hit.bodyIndex < 0) {
          this.ui.toast('Click directly on an object to grab it', 'warn');
          return;
        }
        if (!this.grabber.grab(hit.entity, hit.bodyIndex, hit.point)) {
          this.ui.toast('That object is fixed in place', 'warn');
          return;
        }
        this.grabDepth = clamp(
          this.camera.camera.position.distanceTo(new THREE.Vector3(...hit.point)),
          1.2,
          45,
        );
        this.grabSamples = [];
        this.canvas.style.cursor = 'grabbing';
        this.ui.setDragTip(true, this.input.clientX, this.input.clientY);
        this.ui.setHint(
          `Holding ${hit.entity.def.name} — release to throw${hit.entity.def.behaviors?.weapon ? ' · F to fire' : ''}`,
        );
        break;
      }
      case 'blast': {
        if (!hit) return;
        this.sim.explodeAt(
          [hit.point[0], Math.max(hit.point[1], 0.15), hit.point[2]],
          7,
          20,
          150,
          '#ff9a3d',
        );
        break;
      }
      case 'delete': {
        if (!hit?.entity) {
          this.ui.toast('Click an object to delete it', 'warn');
          return;
        }
        const t = hit.entity.bodies[0]?.body.translation();
        if (t) this.scene.fx.burst([t.x, t.y, t.z], hit.entity.color, 14, 3, 7, 0.6);
        this.sim.remove(hit.entity);
        this.ui.setHint(TOOL_HINTS.delete);
        break;
      }
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    if (this.grabber.isGrabbing) this.releaseGrab(true);
  };

  private updateGrab(): void {
    const target = this.camera.pointOnRay(this.input.ndcX, this.input.ndcY, this.grabDepth);
    target.y = Math.max(0.2, target.y);
    this.grabber.moveTo([target.x, target.y, target.z]);
    const now = performance.now();
    this.grabSamples.push({ point: target.clone(), time: now });
    while (this.grabSamples.length > 0 && now - this.grabSamples[0]!.time > 320) {
      this.grabSamples.shift();
    }
    this.ui.setDragTip(true, this.input.clientX, this.input.clientY);
    this.canvas.style.cursor = 'grabbing';
  }

  private releaseGrab(throwObject: boolean): void {
    let velocity: Vec3 = [0, 0, 0];
    if (throwObject && this.grabSamples.length > 1) {
      const latest = this.grabSamples[this.grabSamples.length - 1]!;
      const cutoff = latest.time - 140;
      const oldest = this.grabSamples.find((sample) => sample.time >= cutoff) ?? this.grabSamples[0]!;
      const seconds = (latest.time - oldest.time) / 1000;
      if (seconds > 0.012) {
        const vx = ((latest.point.x - oldest.point.x) / seconds) * 0.75;
        const vy = ((latest.point.y - oldest.point.y) / seconds) * 0.75;
        const vz = ((latest.point.z - oldest.point.z) / seconds) * 0.75;
        const speed = Math.hypot(vx, vy, vz);
        const scale = speed > 28 ? 28 / speed : 1;
        velocity = [vx * scale, vy * scale, vz * scale];
      }
    }
    this.grabber.release(velocity);
    this.grabSamples = [];
    this.ui.setDragTip(false);
    this.ui.setHint(TOOL_HINTS[this.tool]);
    this.canvas.style.cursor = this.tool === 'grab' ? 'grab' : 'crosshair';
  }

  private updateHover(): void {
    if (this.grabber.isGrabbing) {
      this.ghost.hide();
      this.hover.hide();
      this.hoverEntity = null;
      return;
    }

    if (this.tool === 'spawn') {
      this.hoverEntity = null;
      this.hover.hide();
      const hit = this.pick();
      if (hit) {
        this.ghost.show(hit.point, this.scale);
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.ghost.hide();
        this.canvas.style.cursor = 'default';
      }
      return;
    }

    this.ghost.hide();
    const hit = this.pick();
    this.hoverEntity = hit?.entity ?? null;
    if (this.hoverEntity) {
      const info = this.highlightFor(this.hoverEntity);
      const color =
        this.tool === 'delete' ? '#ff6b6b' : this.tool === 'blast' ? '#ffb347' : '#b8ff5a';
      this.hover.show(info.center, info.radius, color);
      this.canvas.style.cursor = this.tool === 'grab' ? 'grab' : 'pointer';
    } else {
      this.hover.hide();
      this.canvas.style.cursor = 'crosshair';
    }
  }

  private highlightFor(entity: SimEntity): { center: Vec3; radius: number } {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const simBody of entity.bodies) {
      const t = simBody.body.translation();
      for (const part of simBody.parts) {
        const [ex, ey, ez] = halfExtents(part.shape);
        const x = t.x + part.localPos[0];
        const y = t.y + part.localPos[1];
        const z = t.z + part.localPos[2];
        minX = Math.min(minX, x - ex);
        minY = Math.min(minY, y - ey);
        minZ = Math.min(minZ, z - ez);
        maxX = Math.max(maxX, x + ex);
        maxY = Math.max(maxY, y + ey);
        maxZ = Math.max(maxZ, z + ez);
      }
    }
    if (!Number.isFinite(minX)) {
      const t = entity.bodies[0]?.body.translation();
      return { center: t ? [t.x, t.y, t.z] : [0, 1, 0], radius: 0.6 };
    }
    return {
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      radius: Math.max(0.4, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2),
    };
  }

  private useActive(): void {
    const target = this.grabber.grabbed ?? this.hoverEntity;
    if (!target || target.removed) {
      this.ui.toast('Aim at a weapon or vehicle, or grab one, then press F', 'warn');
      return;
    }
    if (target.def.behaviors?.weapon) {
      if (this.sim.time < target.nextFire) {
        this.ui.toast('Reloading…', 'warn');
        return;
      }
      const aim = this.aimPoint(target);
      const body = target.bodies[0]?.body.translation();
      if (!body) return;
      const direction: Vec3 = [
        aim[0] - body.x,
        aim[1] - body.y,
        aim[2] - body.z,
      ];
      this.sim.fireWeapon(target, direction);
      return;
    }
    if (target.def.vehicle) {
      if (this.sim.toggleVehicleEngine(target)) {
        this.ui.toast(`Engine ${target.engineOn ? 'on' : 'off'}`, 'good');
      }
      return;
    }
    this.ui.toast('That object has no trigger — try a gun or a vehicle', 'warn');
  }

  private aimPoint(exclude: SimEntity): Vec3 {
    const ray = this.camera.ray(this.input.ndcX, this.input.ndcY);
    const hit = this.sim.raycast(
      [ray.origin.x, ray.origin.y, ray.origin.z],
      [ray.direction.x, ray.direction.y, ray.direction.z],
      220,
      exclude,
    );
    if (hit) return hit.point;
    return [
      ray.origin.x + ray.direction.x * 60,
      ray.origin.y + ray.direction.y * 60,
      ray.origin.z + ray.direction.z * 60,
    ];
  }

  private pick(exclude?: SimEntity): RayHit | null {
    const ray = this.camera.ray(this.input.ndcX, this.input.ndcY);
    return this.sim.raycast(
      [ray.origin.x, ray.origin.y, ray.origin.z],
      [ray.direction.x, ray.direction.y, ray.direction.z],
      250,
      exclude,
    );
  }

  private spawnAt(point: Vec3): void {
    try {
      this.sim.spawn(this.selectedDef, { position: point, scale: this.scale });
      this.scene.fx.spawnPuff([point[0], point[1] + 0.1, point[2]]);
      this.ui.setHint(
        `${this.selectedDef.name} spawned. Click again to add more, or grab it to throw.`,
      );
    } catch (error) {
      this.ui.toast(
        error instanceof Error ? error.message : 'Could not spawn that object',
        'warn',
      );
    }
  }

  private selectDef(id: string): void {
    const def = registry.get(id);
    if (!def) return;
    this.selectedDef = def;
    this.ghost.setDef(def);
    this.ui.setSelected(def);
    this.ui.setHint(TOOL_HINTS.spawn);
    if (this.tool !== 'spawn') this.setTool('spawn');
    this.ghost.hide();
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    if (this.grabber.isGrabbing) this.releaseGrab(false);
    this.ui.setTool(tool);
    this.ui.setHint(TOOL_HINTS[tool]);
    this.hover.hide();
    if (tool !== 'spawn') this.ghost.hide();
    this.canvas.style.cursor = tool === 'grab' ? 'grab' : 'crosshair';
  }

  private togglePause(): void {
    const paused = !this.sim.isPaused;
    this.sim.setPaused(paused);
    this.ui.setPaused(paused);
    this.ui.toast(paused ? 'Physics paused' : 'Physics running', paused ? 'warn' : 'good');
  }

  private toggleSlow(): void {
    const slow = this.sim.timeScale > 0.5;
    this.sim.setTimeScale(slow ? 0.25 : 1);
    this.ui.setSlow(slow);
    this.ui.toast(slow ? 'Slow motion' : 'Normal speed', slow ? 'good' : 'info');
  }

  private clearWorld(): void {
    if (this.grabber.isGrabbing) this.releaseGrab(false);
    this.sim.clear();
    this.scene.bridge.removeAll();
    this.hover.hide();
    this.ghost.hide();
    this.ui.toast('World cleared', 'good');
  }

  private resetView(): void {
    this.camera.reset();
    this.ui.toast('Camera reset', 'info');
  }

  private processEvents(): void {
    for (const event of this.sim.drainEvents()) {
      switch (event.type) {
        case 'blast':
          this.scene.fx.blast(event.position, event.radius, event.color);
          break;
        case 'break':
          this.scene.fx.breakBurst(event.position, event.color);
          break;
        case 'weapon':
          this.scene.fx.muzzle(event.position, event.direction);
          break;
        case 'cap':
          this.ui.toast(
            `${event.removed} oldest object${event.removed === 1 ? '' : 's'} recycled at the body cap`,
            'warn',
          );
          break;
        case 'spawn':
        case 'remove':
          break;
      }
    }
  }

  private updateStats(rawDt: number, dt: number): void {
    if (rawDt > 0 && rawDt < 0.5) {
      this.fps = this.fps * 0.9 + (1 / rawDt) * 0.1;
      if (document.visibilityState === 'visible') {
        if (rawDt > 1 / 26) this.lowFpsTime += rawDt;
        else this.lowFpsTime = Math.max(0, this.lowFpsTime - rawDt * 2);
      }
    }
    this.statTimer += dt;
    if (this.statTimer >= 0.25) {
      this.statTimer = 0;
      this.ui.setStats({
        fps: Math.round(this.fps),
        entities: this.sim.entityCount,
        bodies: this.sim.bodyCount,
        calls: this.scene.drawCalls,
      });
    }

    if (
      !this.qualityDropped &&
      this.lowFpsTime > 3 &&
      this.scene.pixelRatio > 1.2 &&
      document.visibilityState === 'visible'
    ) {
      this.qualityDropped = true;
      this.scene.setPixelRatio(1.1);
      this.scene.resize(window.innerWidth, window.innerHeight, this.camera.camera);
      this.ui.toast('Lowered render resolution to keep things smooth', 'warn');
    }
  }

  private seedScene(): void {
    const starters: { id: string; position: Vec3 }[] = [
      { id: 'chair', position: [-3.4, 0, 0.8] },
      { id: 'crash-dummy', position: [2.9, 0, 0.4] },
      { id: 'barrel', position: [-1.3, 0, -3.3] },
      { id: 'beach-ball', position: [1.8, 0, 2.7] },
      { id: 'watermelon', position: [-2.6, 0, 2.6] },
      { id: 'traffic-cone', position: [3.9, 0, -2.3] },
      { id: 'boulder', position: [4.3, 0, 2.8] },
      { id: 'block', position: [-4.5, 0, -2.4] },
      { id: 'block', position: [-4.5, 0.52, -2.4] },
      { id: 'block', position: [-4.5, 1.04, -2.4] },
      { id: 'fan', position: [0, 0, -4.6] },
    ];
    for (const starter of starters) {
      const def = registry.get(starter.id);
      if (!def) continue;
      try {
        this.sim.spawn(def, { position: starter.position, silent: true });
      } catch {
        // A failed starter prop must never block startup.
      }
    }
  }

  private readonly handleResize = (): void => {
    this.scene.resize(window.innerWidth, window.innerHeight, this.camera.camera);
  };

  private handleNav(index: number): void {
    switch (index) {
      case 0:
        this.ui.showHelp(false);
        this.ui.blurSearch();
        break;
      case 1:
        this.ui.showHelp(false);
        this.ui.focusSearch();
        break;
      case 2:
        this.ui.showHelp(true);
        break;
      default:
        return;
    }
    this.nav.setActive(index);
  }

  private readonly handleVisibility = (): void => {
    this.lastFrame = 0;
  };
}
