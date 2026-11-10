import { describe, expect, it } from 'vitest';
import { registry } from '../src/catalog';
import { entityPosition } from '../src/sim/SimWorld';
import { makeWorld, stepFor } from './helpers';

const def = (id: string) => {
  const found = registry.get(id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
};

describe('physics stepping', () => {
  it('applies gravity and integrates at a fixed timestep', async () => {
    const world = await makeWorld();
    const ball = world.spawn(def('boulder-small'), { position: [0, 6, 0] });
    const before = entityPosition(ball)[1];
    stepFor(world, 0.5);
    const after = entityPosition(ball)[1];
    expect(after).toBeLessThan(before - 0.5);
    expect(Number.isFinite(after)).toBe(true);
  });

  it('caps substeps and can pause / slow time', async () => {
    const world = await makeWorld();
    world.spawn(def('block'), { position: [0, 3, 0] });
    expect(world.step(0.1)).toBe(4);
    world.setPaused(true);
    expect(world.step(1 / 60)).toBe(0);
    world.setPaused(false);
    world.setTimeScale(0.5);
    expect(world.step(1 / 30)).toBe(1);
    world.setTimeScale(1);
  });

  it('sleeps resting bodies and reports awake counts', async () => {
    const world = await makeWorld();
    world.spawn(def('brick'), { position: [0, 0.1, 0] });
    stepFor(world, 4);
    const awake = world.measureAwake();
    expect(awake).toBeLessThanOrEqual(world.bodyCount);
  });

  it('raycasts the ground and spawned objects with normals', async () => {
    const world = await makeWorld();
    const ground = world.raycast([0, 10, 0], [0, -1, 0]);
    expect(ground).not.toBeNull();
    expect(ground!.entity).toBeNull();
    expect(ground!.point[1]).toBeCloseTo(0, 1);
    expect(ground!.normal[1]).toBeGreaterThan(0.5);

    const box = world.spawn(def('block'), { position: [0, 0, 0] });
    const hit = world.raycast([0, 4, 0], [0, -1, 0]);
    expect(hit?.entity).toBe(box);
    expect(hit?.bodyIndex).toBe(0);
  });

  it('matches ray hit points to world space', async () => {
    const world = await makeWorld();
    world.spawn(def('block'), { position: [2, 0, 0] });
    const hit = world.raycast([2, 3, 0], [0, -1, 0]);
    expect(hit?.point[0]).toBeCloseTo(2, 1);
    expect(hit?.point[1]).toBeGreaterThan(0.2);
  });
});
