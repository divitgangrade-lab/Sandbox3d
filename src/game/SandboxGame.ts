/** SandboxGame glues physics, rendering, camera, input and UI together. */

import * as THREE from 'three';
import { registry } from '../catalog';
import type { ObjectDef } from '../catalog/types';
import { clamp, quatFromY, quatMul, type Vec3 } from '../core/math';
import { entityWorldBounds } from '../sim/bounds';
import { initPhysics } from '../sim/physics';
import { SimWorld, entityPosition, entityRotation } from '../sim/SimWorld';
import { SimGrabber } from '../sim/grabber';
import type { RayHit, SimEntity } from '../sim/types';
import {
  parseWorldSnapshot,
  restoreWorld,
  serializeWorldSnapshot,
  snapshotWorld,
} from '../sim/persistence';
import { WorldHistory } from '../sim/history';
import { SceneRenderer } from '../render/scene';
import { GhostPreview, HoverHighlight } from '../render/ghost';
import { OrbitCamera } from './OrbitCamera';
import { Input } from './input';
import { UI, type BuildAction, type Tool } from '../ui/ui';
import { SaveStore } from './saveStore';
import { downloadText } from './download';
import { mountTopNav, type GooeyNavController } from '../ui/gooeyNavMount';
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
  build: 'Build mode: click an object to select it, then nudge, rotate, scale or duplicate it.',
};

export class SandboxGame {
  private sim!: SimWorld;
  private scene!: SceneRenderer;
  private camera!: OrbitCamera;
  private input!: Input;
  private ui!: UI;
  private nav!: GooeyNavController;
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
  private selectedEntity: SimEntity | null = null;
  private drivingEntity: SimEntity | null = null;
  private snapEnabled = true;
  private gridSize = 0.5;
  private inspectTimer = 0;
  private history!: WorldHistory;
  private readonly saveStore = new SaveStore();

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
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onSavesOpened: () => this.refreshSaves(),
      onSaveWorld: (name) => this.saveWorld(name),
      onLoadSave: (id) => this.loadSave(id),
      onDeleteSave: (id) => this.deleteSave(id),
      onExportSave: () => this.exportWorld(),
      onImportSave: (text) => this.importWorld(text),
      onGravity: (value) => {
        this.sim.setGravity(value);
        this.ui.setHint(`Gravity ${value.toFixed(1)} m/s²`);
      },
      onBuildAction: (action) => this.buildAction(action),
      onToggleSnap: () => {
        this.snapEnabled = !this.snapEnabled;
        this.ui.setSnap(this.snapEnabled);
      },
      onGridSize: (size) => {
        this.gridSize = size;
      },
      onHelpChange: (open) => {
        this.nav?.setActive(open ? 2 : 0);
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
    this.history = new WorldHistory(
      () => snapshotWorld(this.sim),
      (snapshot) => {
        const result = restoreWorld(this.sim, snapshot, (id) => registry.get(id));
        this.afterWorldRestore();
        if (result.skipped.length > 0) {
          this.ui.toast(
            `Skipped ${result.skipped.length} object${result.skipped.length === 1 ? '' : 's'} from an older catalog`,
            'warn',
          );
        }
      },
    );
    this.syncHistoryUi();
    this.ui.setGravity(this.sim.gravityValue);
    this.ui.setSnap(this.snapEnabled);
    this.ui.setGridSize(this.gridSize);
    this.ui.setSaveSlots(this.saveStore.list());

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

    this.handleKeys();
    this.updateVehicle(dt);
    this.camera.update(this.input, dt);

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
    this.updateInspector(dt);
    this.input.endFrame();
    this.raf = requestAnimationFrame(this.frame);
  };

  private handleKeys(): void {
    const pressed = (code: string) => this.input.wasPressed(code);
    if (pressed('Escape')) {
      if (this.ui.isSaveOpen) this.ui.openSaves(false);
      else if (this.ui.isHelpOpen) this.ui.showHelp(false);
      else if (this.grabber.isGrabbing) this.releaseGrab(false);
    }
    if (this.ui.isOverlayOpen) return;

    const modifier = this.input.ctrlKey || this.input.metaKey;
    if (modifier && pressed('KeyZ')) {
      if (this.input.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (modifier && pressed('KeyS')) {
      this.ui.openSaves(true);
      return;
    }

    if (pressed('KeyH')) this.ui.showHelp(!this.ui.isHelpOpen);
    if (pressed('KeyG')) this.setTool('grab');
    if (pressed('KeyS')) this.setTool('spawn');
    if (pressed('KeyB')) this.setTool('blast');
    if (pressed('KeyX')) this.setTool('delete');
    if (pressed('KeyV')) this.setTool('build');
    if (pressed('KeyF')) this.useActive();
    if (pressed('Space')) this.togglePause();
    if (pressed('KeyT')) this.toggleSlow();
    if (pressed('KeyC')) this.clearWorld();
    if (pressed('KeyR')) this.resetView();
    if (pressed('Slash')) this.ui.focusSearch();
  }

  private readonly handlePointerDown = (): void => {
    if (this.ui.isOverlayOpen) return;
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
          `Holding ${hit.entity.def.name}. Release to throw${hit.entity.def.behaviors?.weapon ? ', or press F to fire' : ''}.`,
        );
        break;
      }
      case 'blast': {
        if (!hit) return;
        this.recordHistory('Blast');
        this.sim.explodeAt(
          [hit.point[0], Math.max(hit.point[1], 0.15), hit.point[2]],
          7,
          20,
          150,
          '#ff9a3d',
        );
        this.syncHistoryUi();
        break;
      }
      case 'delete': {
        if (!hit?.entity) {
          this.ui.toast('Click an object to delete it', 'warn');
          return;
        }
        this.recordHistory(`Delete ${hit.entity.def.name}`);
        const t = hit.entity.bodies[0]?.body.translation();
        if (t) this.scene.fx.burst([t.x, t.y, t.z], hit.entity.color, 14, 3, 7, 0.6);
        this.sim.remove(hit.entity);
        this.forgetEntity(hit.entity.id);
        this.syncHistoryUi();
        this.ui.setHint(TOOL_HINTS.delete);
        break;
      }
      case 'build': {
        if (!hit?.entity) {
          this.selectedEntity = null;
          this.ui.setBuildSelection(null);
          this.ui.setHint('Build mode: click an object to select it');
          return;
        }
        this.selectedEntity = hit.entity;
        this.ui.setBuildSelection(hit.entity.def.name);
        this.ui.setHint(`${hit.entity.def.name} selected · nudge, rotate, scale or duplicate it`);
        break;
      }
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    // pointercancel has no reliable button value; any terminal pointer event releases a grab.
    if (event.type !== 'pointercancel' && event.button !== 0) return;
    if (this.grabber.isGrabbing) this.releaseGrab(event.type !== 'pointercancel');
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
    if (this.ui.isOverlayOpen) {
      this.ghost.hide();
      this.hover.hide();
      this.hoverEntity = null;
      return;
    }
    if (this.selectedEntity?.removed) this.selectedEntity = null;
    if (this.grabber.isGrabbing) {
      this.ghost.hide();
      this.hover.hide();
      this.hoverEntity = null;
      return;
    }

    if (this.tool === 'build') {
      this.ghost.hide();
      const hit = this.pick();
      this.hoverEntity = hit?.entity ?? null;
      const target = this.hoverEntity ?? this.selectedEntity;
      if (target && !target.removed) {
        const info = this.highlightFor(target);
        this.hover.show(info.center, info.radius, '#b9a6ff');
        this.canvas.style.cursor = 'pointer';
      } else {
        this.hover.hide();
        this.canvas.style.cursor = 'default';
      }
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
    const bounds = entityWorldBounds(entity);
    return { center: bounds.center, radius: bounds.radius };
  }

  private useActive(): void {
    const target = this.grabber.grabbed ?? this.drivingEntity ?? this.hoverEntity;
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
      if (this.drivingEntity && this.drivingEntity !== target) {
        this.sim.setVehicleEngine(this.drivingEntity, false);
      }
      const turnOn = !target.engineOn;
      if (!this.sim.setVehicleEngine(target, turnOn)) {
        this.ui.toast('That vehicle has no working motor', 'warn');
        return;
      }
      if (turnOn) {
        this.drivingEntity = target;
        this.input.cameraPanEnabled = false;
        this.camera.follow(entityPosition(target));
        this.ui.setHint('Driving. W/S throttle, A/D steer, F to stop.');
        this.ui.toast('Engine on. W/S throttle, A/D steer, F to stop.', 'good');
      } else {
        if (this.drivingEntity === target) this.stopDriving();
        this.ui.setHint('Engine off');
        this.ui.toast('Engine off', 'info');
      }
      return;
    }
    this.ui.toast('No trigger on that object. Try a gun or a vehicle.', 'warn');
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
    this.recordHistory(`Spawn ${this.selectedDef.name}`);
    try {
      this.sim.spawn(this.selectedDef, { position: point, scale: this.scale });
      this.scene.fx.spawnPuff([point[0], point[1] + 0.1, point[2]]);
      this.ui.setHint(
        `${this.selectedDef.name} spawned. Click again to add more, or grab it to throw.`,
      );
      this.syncHistoryUi();
    } catch (error) {
      this.history.discardLast();
      this.syncHistoryUi();
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
    this.ui.setBuild(tool === 'build');
    this.ui.setHint(TOOL_HINTS[tool]);
    this.hover.hide();
    if (tool !== 'spawn') this.ghost.hide();
    this.ui.setBuildSelection(tool === 'build' ? this.selectedEntity?.def.name ?? null : null);
    this.canvas.style.cursor =
      tool === 'grab' ? 'grab' : tool === 'build' ? 'default' : 'crosshair';
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
    if (this.sim.entityCount === 0) {
      this.ui.toast('The world is already empty', 'info');
      return;
    }
    this.recordHistory('Clear world');
    if (this.grabber.isGrabbing) this.releaseGrab(false);
    this.stopDriving();
    this.selectedEntity = null;
    this.sim.clear();
    this.scene.bridge.removeAll();
    this.hover.hide();
    this.ghost.hide();
    this.ui.setBuildSelection(null);
    this.ui.setInspector(null);
    this.syncHistoryUi();
    this.ui.toast('World cleared', 'good');
  }

  private resetView(): void {
    this.camera.reset();
    this.ui.toast('Camera reset', 'info');
  }

  private recordHistory(label: string): void {
    this.history.record(label);
  }

  private syncHistoryUi(): void {
    this.ui.setUndoRedo(
      this.history.canUndo,
      this.history.canRedo,
      this.history.undoLabel,
      this.history.redoLabel,
    );
  }

  private undo(): void {
    const label = this.history.undo();
    if (!label) return;
    this.syncHistoryUi();
    this.ui.toast(`Undid ${label}`, 'info');
  }

  private redo(): void {
    const label = this.history.redo();
    if (!label) return;
    this.syncHistoryUi();
    this.ui.toast(`Redid ${label}`, 'good');
  }

  private afterWorldRestore(): void {
    this.grabber.release();
    this.stopDriving();
    this.input.cameraPanEnabled = true;
    this.selectedEntity = null;
    this.hoverEntity = null;
    this.hover.hide();
    this.ghost.hide();
    this.scene.bridge.sync();
    this.sim.drainEvents();
    this.ui.setPaused(this.sim.isPaused);
    this.ui.setSlow(this.sim.timeScale <= 0.5);
    this.ui.setGravity(this.sim.gravityValue);
    this.ui.setBuildSelection(null);
    this.ui.setInspector(null);
    this.ui.setHint(TOOL_HINTS[this.tool]);
    this.inspectTimer = 1;
    this.syncHistoryUi();
  }

  private forgetEntity(id: number): void {
    if (this.selectedEntity?.id === id) {
      this.selectedEntity = null;
      this.ui.setBuildSelection(null);
    }
    if (this.drivingEntity?.id === id) this.stopDriving();
    if (this.hoverEntity?.id === id) {
      this.hoverEntity = null;
      this.hover.hide();
      this.ui.setInspector(null);
    }
  }

  private stopDriving(): void {
    this.drivingEntity = null;
    this.input.cameraPanEnabled = true;
    this.ui.setHint(TOOL_HINTS[this.tool]);
  }

  private updateVehicle(dt: number): void {
    const vehicle = this.drivingEntity;
    if (!vehicle) return;
    if (vehicle.removed || !vehicle.engineOn || vehicle.bodies.length === 0) {
      this.stopDriving();
      return;
    }
    const up = this.input.isDown('KeyW') || this.input.isDown('ArrowUp');
    const down = this.input.isDown('KeyS') || this.input.isDown('ArrowDown');
    const left = this.input.isDown('KeyA') || this.input.isDown('ArrowLeft');
    const right = this.input.isDown('KeyD') || this.input.isDown('ArrowRight');
    const throttle = (up ? 1 : 0) - (down ? 1 : 0);
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    this.sim.driveVehicle(vehicle, throttle, steer, dt);
    this.camera.follow(entityPosition(vehicle));
  }

  private updateInspector(dt: number): void {
    this.inspectTimer += dt;
    if (this.inspectTimer < 0.2) return;
    this.inspectTimer = 0;
    if (this.tool === 'build') {
      this.ui.setInspector(null);
      return;
    }
    const target =
      this.grabber.grabbed ??
      this.hoverEntity ??
      (this.selectedEntity && !this.selectedEntity.removed ? this.selectedEntity : null);
    if (!target || target.removed) {
      this.ui.setInspector(null);
      return;
    }
    const primary = target.bodies[0]?.body;
    if (!primary) return;
    const mass = target.bodies.reduce((sum, simBody) => sum + simBody.body.mass(), 0);
    const colliders = target.bodies.reduce((sum, simBody) => sum + simBody.parts.length, 0);
    const v = primary.linvel();
    const velocity = Math.hypot(v.x, v.y, v.z);
    const t = primary.translation();
    const q = primary.rotation();
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion(q.x, q.y, q.z, q.w),
      'YXZ',
    );
    const allSleeping = target.bodies.every((simBody) => simBody.body.isSleeping());
    const state = target.held
      ? 'held'
      : target.standing
        ? 'balanced'
        : allSleeping
          ? 'sleeping'
          : 'awake';
    const extra: string[] = [];
    if (target.def.kind === 'vehicle') extra.push(target.engineOn ? 'engine on' : 'engine off');
    if (target.fuse !== null) extra.push(`fuse ${Math.max(0, target.fuse).toFixed(2)}s`);
    if (target.def.behaviors?.destructible) extra.push('destructible');
    if (target.def.behaviors?.weapon) extra.push('weapon');
    this.ui.setInspector({
      name: target.def.name,
      icon: target.def.icon ?? '▣',
      state,
      mass,
      velocity,
      position: [t.x, t.y, t.z],
      rotation: [
        THREE.MathUtils.radToDeg(euler.x),
        THREE.MathUtils.radToDeg(euler.y),
        THREE.MathUtils.radToDeg(euler.z),
      ],
      material: target.def.material ?? 'mixed',
      colliders,
      health: target.def.behaviors?.destructible
        ? `${Math.max(0, target.hp).toFixed(0)} HP`
        : '—',
      extra: extra.join(' · '),
    });
  }

  private buildAction(action: BuildAction): void {
    const entity = this.selectedEntity;
    if (!entity || entity.removed) {
      this.ui.toast('Select an object first', 'warn');
      return;
    }
    if (action === 'focus') {
      this.camera.follow(entityPosition(entity));
      this.ui.toast(`Focused ${entity.def.name}`, 'info');
      return;
    }

    const labels: Record<Exclude<BuildAction, 'focus'>, string> = {
      left: 'Nudge',
      right: 'Nudge',
      forward: 'Nudge',
      back: 'Nudge',
      'rotate-left': 'Rotate',
      'rotate-right': 'Rotate',
      'scale-down': 'Scale',
      'scale-up': 'Scale',
      duplicate: 'Duplicate',
      delete: 'Delete',
    };
    this.recordHistory(`${labels[action]} ${entity.def.name}`);
    try {
      const position = entityPosition(entity);
      const rotation = entityRotation(entity);
      const step = this.snapEnabled ? this.gridSize : 0.1;
      switch (action) {
        case 'left':
        case 'right':
        case 'forward':
        case 'back': {
          const rawX = position[0] + (action === 'left' ? -step : action === 'right' ? step : 0);
          const rawZ = position[2] + (action === 'back' ? step : action === 'forward' ? -step : 0);
          const next: Vec3 = this.snapEnabled
            ? [Math.round(rawX / step) * step, position[1], Math.round(rawZ / step) * step]
            : [rawX, position[1], rawZ];
          this.sim.setEntityTransform(entity, next, rotation);
          break;
        }
        case 'rotate-left':
        case 'rotate-right': {
          const angle = (action === 'rotate-left' ? 1 : -1) * (Math.PI / 12);
          const next = quatMul(quatFromY(angle), rotation);
          this.sim.setEntityTransform(entity, position, next);
          break;
        }
        case 'scale-down':
        case 'scale-up': {
          const nextScale = clamp(
            entity.scale + (action === 'scale-up' ? 0.1 : -0.1),
            0.4,
            3,
          );
          if (Math.abs(nextScale - entity.scale) < 1e-4) {
            this.history.discardLast();
            this.syncHistoryUi();
            this.ui.toast('Scale limit reached', 'warn');
            return;
          }
          this.rescaleEntity(entity, nextScale);
          break;
        }
        case 'duplicate': {
          const next: Vec3 = [position[0] + step, position[1], position[2]];
          const copy = this.sim.spawn(entity.def, {
            position: next,
            rotation,
            scale: entity.scale,
            color: entity.color,
            silent: true,
          });
          this.sim.setEntityTransform(copy, next, rotation);
          copy.hp = entity.hp;
          copy.fuse = entity.fuse;
          this.selectedEntity = copy;
          this.scene.fx.spawnPuff([next[0], next[1] + 0.1, next[2]]);
          break;
        }
        case 'delete': {
          const primary = entity.bodies[0]?.body.translation();
          if (primary) {
            this.scene.fx.burst([primary.x, primary.y, primary.z], entity.color, 14, 3, 7, 0.6);
          }
          this.sim.remove(entity);
          this.selectedEntity = null;
          this.ui.setBuildSelection(null);
          break;
        }
      }
    } catch (error) {
      this.history.discardLast();
      this.syncHistoryUi();
      this.ui.toast(
        error instanceof Error ? error.message : 'That build edit could not be applied',
        'warn',
      );
      return;
    }
    this.scene.bridge.sync();
    this.syncHistoryUi();
    this.ui.setBuildSelection(this.selectedEntity?.def.name ?? null);
  }

  private rescaleEntity(entity: SimEntity, scale: number): void {
    const position = entityPosition(entity);
    const rotation = entityRotation(entity);
    const wasStanding = entity.standing;
    const copy = this.sim.spawn(entity.def, {
      position,
      rotation,
      scale,
      color: entity.color,
      silent: true,
    });
    this.sim.setEntityTransform(copy, position, rotation);
    copy.hp = entity.hp;
    copy.fuse = entity.fuse;
    if (entity.def.kind === 'ragdoll' && !wasStanding) {
      copy.standing = false;
      copy.standPose = null;
    }
    if (entity.engineOn && entity.def.vehicle) this.sim.setVehicleEngine(copy, true);
    this.sim.remove(entity);
    this.selectedEntity = copy;
  }

  private refreshSaves(): void {
    try {
      this.ui.setSaveSlots(this.saveStore.list());
    } catch (error) {
      this.ui.toast(error instanceof Error ? error.message : 'Could not read saves', 'warn');
    }
  }

  private saveWorld(name: string): void {
    try {
      const summary = this.saveStore.save(name, snapshotWorld(this.sim));
      this.refreshSaves();
      this.ui.clearSaveName();
      this.ui.toast(`Saved “${summary.name}”`, 'good');
    } catch (error) {
      this.ui.toast(error instanceof Error ? error.message : 'Could not save this world', 'warn');
    }
  }

  private loadSave(id: string): void {
    try {
      const snapshot = this.saveStore.load(id);
      this.recordHistory('Load save');
      const result = restoreWorld(this.sim, snapshot, (defId) => registry.get(defId));
      this.afterWorldRestore();
      this.ui.openSaves(false);
      this.ui.toast(
        `Loaded ${result.restored} object${result.restored === 1 ? '' : 's'}${result.skipped.length ? ` · skipped ${result.skipped.length}` : ''}`,
        result.skipped.length > 0 ? 'warn' : 'good',
      );
    } catch (error) {
      this.ui.toast(error instanceof Error ? error.message : 'Could not load that save', 'warn');
    }
  }

  private deleteSave(id: string): void {
    try {
      this.saveStore.delete(id);
      this.refreshSaves();
      this.ui.toast('Save deleted', 'info');
    } catch (error) {
      this.ui.toast(error instanceof Error ? error.message : 'Could not delete that save', 'warn');
    }
  }

  private exportWorld(): void {
    try {
      const snapshot = snapshotWorld(this.sim);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadText(`sandbox3d-${stamp}.json`, serializeWorldSnapshot(snapshot));
      this.ui.openSaves(false);
      this.ui.toast('World exported', 'good');
    } catch (error) {
      this.ui.toast(error instanceof Error ? error.message : 'Could not export the world', 'warn');
    }
  }

  private importWorld(text: string): void {
    try {
      const snapshot = parseWorldSnapshot(text);
      this.recordHistory('Import world');
      const result = restoreWorld(this.sim, snapshot, (defId) => registry.get(defId));
      this.afterWorldRestore();
      this.ui.openSaves(false);
      this.ui.toast(
        `Imported ${result.restored} object${result.restored === 1 ? '' : 's'}${result.skipped.length ? ` · skipped ${result.skipped.length}` : ''}`,
        result.skipped.length > 0 ? 'warn' : 'good',
      );
    } catch (error) {
      this.ui.toast(error instanceof Error ? error.message : 'Could not import that file', 'warn');
    }
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
        case 'remove':
          this.forgetEntity(event.entityId);
          break;
        case 'spawn':
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
