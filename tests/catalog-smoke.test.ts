import { describe, expect, it } from 'vitest';
import { registry } from '../src/catalog';
import { makeWorld, stepFor } from './helpers';

describe('catalog smoke test', () => {
  it('spawns and simulates every visible object without throwing', async () => {
    const world = await makeWorld({ maxBodies: 5000, killPlane: -200 });
    const defs = registry.visible();
    const spawned = [];

    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]!;
      const x = ((i % 20) - 10) * 4;
      const z = (Math.floor(i / 20) - 5) * 4;
      const entity = world.spawn(def, { position: [x, 1, z] });
      spawned.push(entity);
      expect(entity.bodies.length, `${def.id} bodies`).toBeGreaterThan(0);
      expect(entity.bodies.every((b) => b.parts.length > 0), `${def.id} parts`).toBe(true);
    }

    expect(spawned.length).toBe(defs.length);
    stepFor(world, 0.25);
    expect(world.entityCount).toBeGreaterThan(0);
    for (const entity of world.entities) {
      const body = entity.bodies[0];
      if (!body) continue;
      const p = body.body.translation();
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
    }
    world.clear();
    expect(world.entityCount).toBe(0);
  }, 60_000);
});
