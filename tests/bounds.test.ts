import { describe, expect, it } from 'vitest';
import { registry } from '../src/catalog';
import { entityWorldBounds } from '../src/sim/bounds';
import { makeWorld } from './helpers';

describe('selection bounds', () => {
  it('expands with a rotated body instead of using unrotated local offsets', async () => {
    const world = await makeWorld();
    const def = registry.get('block');
    if (!def) throw new Error('Missing block');
    const block = world.spawn(def, {
      position: [0, 1, 0],
      rotation: [0, 0, 0, 1],
    });
    const upright = entityWorldBounds(block);
    block.bodies[0]!.body.setRotation(
      { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) },
      true,
    );
    world.world.propagateModifiedBodyPositionsToColliders();
    const tilted = entityWorldBounds(block);
    expect(tilted.radius).toBeGreaterThan(upright.radius + 0.08);
    expect(tilted.min[1]).toBeLessThan(upright.min[1]);
    expect(tilted.max[1]).toBeGreaterThan(upright.max[1]);
  });
});
