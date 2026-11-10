import { describe, expect, it } from 'vitest';
import { registry } from '../src/catalog';
import type { SimEvent } from '../src/sim/types';
import { entityPosition } from '../src/sim/SimWorld';
import { makeWorld, stepFor } from './helpers';

function requireDef(id: string) {
  const def = registry.get(id);
  if (!def) throw new Error(`Missing def ${id}`);
  return def;
}

describe('spawning', () => {
  it('spawns a rigid object on the surface with the requested scale', async () => {
    const world = await makeWorld();
    const def = requireDef('block');
    const entity = world.spawn(def, { position: [0, 2, 0] });
    expect(world.entityCount).toBe(1);
    expect(world.bodyCount).toBe(1);
    expect(entity.bodies).toHaveLength(1);
    expect(entity.bodies[0]!.parts).toHaveLength(1);
    const part = entity.bodies[0]!.parts[0]!;
    if (part.shape.kind !== 'box') throw new Error('expected box');
    expect(part.shape.hx).toBeCloseTo(0.25);
    const pos = entityPosition(entity);
    expect(pos[1]).toBeGreaterThan(2);

    const doubled = world.spawn(def, { position: [3, 2, 0], scale: 2 });
    const part2 = doubled.bodies[0]!.parts[0]!;
    if (part2.shape.kind !== 'box') throw new Error('expected box');
    expect(part2.shape.hx).toBeCloseTo(0.5);
  });

  it('spawns every generated kind with the right body structure', async () => {
    const world = await makeWorld();

    const ragdoll = world.spawn(requireDef('crash-dummy'), { position: [0, 0, 0] });
    expect(ragdoll.def.kind).toBe('ragdoll');
    expect(ragdoll.bodies).toHaveLength(11);
    expect(ragdoll.joints).toHaveLength(10);
    expect(ragdoll.bodies.filter((b) => b.primary)).toHaveLength(1);

    const vehicle = world.spawn(requireDef('sedan'), { position: [5, 0, 0] });
    expect(vehicle.bodies).toHaveLength(5);
    expect(vehicle.motorJoints).toHaveLength(4);
    expect(vehicle.joints).toHaveLength(4);

    const jelly = world.spawn(requireDef('jelly-cube'), { position: [10, 0, 0] });
    expect(jelly.bodies).toHaveLength(27);
    expect(jelly.joints.length).toBe(54);

    const cloth = world.spawn(requireDef('trampoline'), { position: [15, 0, 0] });
    expect(cloth.bodies.length).toBeGreaterThanOrEqual(30);
    expect(cloth.bodies.some((b) => b.body.isFixed())).toBe(true);
    expect(cloth.joints.length).toBeGreaterThan(50);

    const water = world.spawn(requireDef('water-blob'), { position: [20, 0, 0] });
    expect(water.bodies.length).toBeGreaterThanOrEqual(30);
    expect(water.joints).toHaveLength(0);
  });

  it('evicts the oldest entities when the body cap is reached', async () => {
    const world = await makeWorld({ maxBodies: 8 });
    const def = requireDef('block-small');
    for (let i = 0; i < 20; i++) world.spawn(def, { position: [i * 0.6, 0, 0] });
    expect(world.bodyCount).toBeLessThanOrEqual(8);
    expect(world.entityCount).toBeLessThanOrEqual(8);
    const events = world.drainEvents();
    const capEvents = events.filter((e): e is Extract<SimEvent, { type: 'cap' }> => e.type === 'cap');
    expect(capEvents.length).toBeGreaterThan(0);
    expect(capEvents.reduce((sum, e) => sum + e.removed, 0)).toBeGreaterThan(0);
  });

  it('cleans up objects that fall through the kill plane', async () => {
    const world = await makeWorld({ killPlane: 3 });
    world.spawn(requireDef('marble'), { position: [0, 0, 0] });
    world.spawn(requireDef('marble'), { position: [1, 10, 0] });
    expect(world.entityCount).toBe(2);
    stepFor(world, 0.25);
    expect(world.entityCount).toBe(1);
  });

  it('removes entities safely twice and clears the world', async () => {
    const world = await makeWorld();
    const entity = world.spawn(requireDef('bottle'), { position: [0, 1, 0] });
    const glassParts = entity.bodies[0]!.parts.length;
    expect(world.bodyCount).toBe(1);
    world.remove(entity);
    world.remove(entity);
    expect(world.entityCount).toBe(0);
    expect(world.bodyCount).toBe(0);
    expect(glassParts).toBeGreaterThan(1);

    world.spawn(requireDef('chair'), { position: [0, 0, 0] });
    world.spawn(requireDef('trampoline'), { position: [3, 0, 0] });
    world.clear();
    expect(world.entityCount).toBe(0);
    expect(world.bodyCount).toBe(0);
  });

  it('supports deterministic spawning with a seed', async () => {
    const a = await makeWorld({ seed: 7 });
    const b = await makeWorld({ seed: 7 });
    const ea = a.spawn(requireDef('block'), { position: [0, 1, 0] });
    const eb = b.spawn(requireDef('block'), { position: [0, 1, 0] });
    expect(entityPosition(ea)[1]).toBeCloseTo(entityPosition(eb)[1]);
    expect(ea.color).toBe(eb.color);
  });
});
