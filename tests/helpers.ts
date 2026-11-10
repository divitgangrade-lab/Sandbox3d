import { initPhysics } from '../src/sim/physics';
import { SimWorld } from '../src/sim/SimWorld';
import type { SimWorldOptions } from '../src/sim/types';
import { registry } from '../src/catalog';

export async function makeWorld(options: Partial<SimWorldOptions> = {}): Promise<SimWorld> {
  await initPhysics();
  return new SimWorld({
    seed: 42,
    maxBodies: 4000,
    getDef: (id) => registry.get(id),
    ...options,
  });
}

export function stepFor(world: SimWorld, seconds: number): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) world.step(1 / 60);
}

export function getVisibleDefs() {
  return registry.visible();
}
