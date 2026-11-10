import { describe, expect, it } from 'vitest';
import { registry } from '../src/catalog';
import { SimGrabber } from '../src/sim/grabber';
import { entityPosition, entityVelocity } from '../src/sim/SimWorld';
import type { SimEvent } from '../src/sim/types';
import { makeWorld, stepFor } from './helpers';

const def = (id: string) => {
  const found = registry.get(id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
};

describe('grab and throw', () => {
  it('attaches, follows the cursor and throws on release', async () => {
    const world = await makeWorld();
    const box = world.spawn(def('block'), { position: [0, 1, 0] });
    const grabber = new SimGrabber(world);
    const hit = world.raycast([0, 5, 0], [0, -1, 0]);
    expect(hit?.entity).toBe(box);
    expect(grabber.grab(box, hit!.bodyIndex, hit!.point)).toBe(true);
    expect(box.held).toBe(true);

    grabber.moveTo([0, 4, 0]);
    stepFor(world, 1);
    expect(entityPosition(box)[1]).toBeGreaterThan(2.2);

    grabber.release([0, 6, 0]);
    expect(grabber.isGrabbing).toBe(false);
    expect(box.held).toBe(false);
    stepFor(world, 0.1);
    expect(entityVelocity(box)[1]).toBeGreaterThan(0.5);
    grabber.dispose();
  });

  it('releases automatically if the held entity is removed', async () => {
    const world = await makeWorld();
    const box = world.spawn(def('block'), { position: [0, 1, 0] });
    const grabber = new SimGrabber(world);
    grabber.grab(box, 0, [0, 1.3, 0]);
    world.remove(box);
    expect(grabber.isGrabbing).toBe(false);
  });
});

describe('explosions and destruction', () => {
  it('applies falloff impulses and chains explosive reactions', async () => {
    const world = await makeWorld();
    const near = world.spawn(def('block-small'), { position: [1.2, 0, 0] });
    const far = world.spawn(def('block-small'), { position: [5.5, 0, 0] });
    world.explodeAt([0, 0.4, 0], 8, 14, 0);
    const nearSpeed = Math.abs(entityVelocity(near)[0]);
    const farSpeed = Math.abs(entityVelocity(far)[0]);
    expect(nearSpeed).toBeGreaterThan(farSpeed);
    expect(nearSpeed).toBeGreaterThan(0.5);

    const tnt = world.spawn(def('tnt-bundle'), { position: [12, 0, 0] });
    world.spawn(def('bomb'), { position: [14, 0, 0] });
    world.detonate(tnt);
    stepFor(world, 1.2);
    const blasts = world
      .drainEvents()
      .filter((e): e is Extract<SimEvent, { type: 'blast' }> => e.type === 'blast');
    expect(blasts.length).toBeGreaterThanOrEqual(2);
  });

  it('shatters breakables into physical fragments', async () => {
    const world = await makeWorld();
    const glass = world.spawn(def('wine-glass'), { position: [0, 0, 0] });
    const before = world.bodyCount;
    world.breakEntity(glass);
    expect(glass.removed).toBe(true);
    expect(world.bodyCount).toBeGreaterThan(before - 4);
    expect(world.entityCount).toBeGreaterThan(1);
    const breaks = world
      .drainEvents()
      .filter((e): e is Extract<SimEvent, { type: 'break' }> => e.type === 'break');
    expect(breaks).toHaveLength(1);
    stepFor(world, 0.4);
    expect(world.entityCount).toBeGreaterThan(1);
  });

  it('bursts water balloons into a fluid group', async () => {
    const world = await makeWorld();
    const balloon = world.spawn(def('water-balloon'), { position: [0, 1, 0] });
    world.breakEntity(balloon);
    const fluid = [...world.entities].find((e) => e.def.kind === 'fluid');
    expect(fluid).toBeDefined();
    expect(fluid!.bodies.length).toBeGreaterThanOrEqual(20);
    stepFor(world, 0.5);
    expect([...world.entities].some((e) => e.def.kind === 'fluid')).toBe(true);
  });

  it('breaks fragile objects on hard impacts, not at rest', async () => {
    const world = await makeWorld();
    const vase = world.spawn(def('vase'), { position: [0, 0, 0] });
    stepFor(world, 1.5);
    expect(vase.removed).toBe(false);

    world.spawn(def('block-huge'), { position: [0, 5, 0] });
    stepFor(world, 2);
    const broke = world.drainEvents().some((e) => e.type === 'break');
    expect(broke).toBe(true);
    expect(vase.removed).toBe(true);
  });
});

describe('weapons, vehicles, fields and soft bodies', () => {
  it('fires projectiles with a cooldown and recoil', async () => {
    const world = await makeWorld();
    const pistol = world.spawn(def('pistol'), { position: [0, 0, 0] });
    const first = world.fireWeapon(pistol, [0, 0, 1]);
    expect(first).not.toBeNull();
    expect(first!.def.id).toBe('bullet');
    const velocity = entityVelocity(first!);
    expect(velocity[2]).toBeGreaterThan(20);
    expect(world.fireWeapon(pistol, [0, 0, 1])).toBeNull();
    stepFor(world, 0.4);
    expect(world.fireWeapon(pistol, [0, 0, 1])).not.toBeNull();
  });

  it('drives vehicles with wheel motors', async () => {
    const world = await makeWorld();
    const sedan = world.spawn(def('sedan'), { position: [0, 0, 0] });
    stepFor(world, 0.5);
    expect(world.setVehicleEngine(sedan, true)).toBe(true);
    expect(sedan.engineOn).toBe(true);
    stepFor(world, 0.6);
    const wheel = sedan.bodies[1]!;
    const angular = wheel.body.angvel();
    expect(Math.abs(angular.x)).toBeGreaterThan(0.2);
    world.toggleVehicleEngine(sedan);
    expect(sedan.engineOn).toBe(false);
  });

  it('pushes bodies away from wind fields', async () => {
    const world = await makeWorld();
    world.spawn(def('fan'), { position: [0, 0, 0] });
    const box = world.spawn(def('block-small'), { position: [2.5, 0, 0] });
    stepFor(world, 1);
    expect(entityPosition(box)[0]).toBeGreaterThan(2.7);
  });

  it('keeps cloth pinned and jelly jointed', async () => {
    const world = await makeWorld();
    const cloth = world.spawn(def('trampoline'), { position: [0, 1, 0] });
    const pinned = cloth.bodies.filter((b) => b.body.isFixed());
    expect(pinned.length).toBe(4);
    const pinnedY = pinned.map((b) => b.body.translation().y);
    stepFor(world, 1);
    pinned.forEach((b, i) => expect(b.body.translation().y).toBeCloseTo(pinnedY[i]!, 3));

    const jelly = world.spawn(def('jelly-cube'), { position: [6, 1, 0] });
    const joints = jelly.joints.length;
    stepFor(world, 1);
    expect(jelly.removed).toBe(false);
    expect(jelly.joints.length).toBe(joints);
    expect(jelly.bodies.some((b) => b.body.translation().y > 0)).toBe(true);
  });
});
