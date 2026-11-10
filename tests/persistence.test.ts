import { describe, expect, it } from 'vitest';
import { registry } from '../src/catalog';
import { WorldHistory } from '../src/sim/history';
import {
  parseWorldSnapshot,
  restoreWorld,
  serializeWorldSnapshot,
  snapshotWorld,
} from '../src/sim/persistence';
import { entityPosition, entityRotation, entityVelocity } from '../src/sim/SimWorld';
import { makeWorld, stepFor } from './helpers';

const def = (id: string) => {
  const found = registry.get(id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
};

describe('world snapshots', () => {
  it('round-trips positions, rotations, scale, colour and motion', async () => {
    const source = await makeWorld();
    const block = source.spawn(def('block'), {
      position: [1.5, 0, -2],
      scale: 1.4,
      color: '#ff8844',
      rotation: [0.2, 0.5, -0.1, 0.8],
    });
    block.hp = 42;
    stepFor(source, 0.4);
    const before = entityPosition(block);
    const rotationBefore = entityRotation(block);
    const snapshot = snapshotWorld(source);
    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.entities[0]!.scale).toBeCloseTo(1.4);

    const json = serializeWorldSnapshot(snapshot);
    const parsed = parseWorldSnapshot(json);
    const target = await makeWorld();
    const result = restoreWorld(target, parsed, (id) => registry.get(id));
    expect(result.restored).toBe(1);
    expect(result.skipped).toHaveLength(0);
    const loaded = [...target.entities][0]!;
    expect(loaded.color).toBe('#ff8844');
    expect(loaded.hp).toBe(42);
    expect(entityPosition(loaded)[0]).toBeCloseTo(before[0], 4);
    expect(entityPosition(loaded)[1]).toBeCloseTo(before[1], 4);
    expect(entityPosition(loaded)[2]).toBeCloseTo(before[2], 4);
    expect(entityRotation(loaded)[3]).toBeCloseTo(rotationBefore[3], 4);
  });

  it('restores ragdolls and vehicle engine state', async () => {
    const source = await makeWorld();
    source.spawn(def('crash-dummy'), { position: [0, 0, 0] });
    const vehicle = source.spawn(def('sedan'), { position: [5, 0, 0] });
    source.setVehicleEngine(vehicle, true);
    stepFor(source, 0.3);
    const snapshot = snapshotWorld(source);
    const target = await makeWorld();
    const result = restoreWorld(target, snapshot, (id) => registry.get(id));
    expect(result.restored).toBe(2);
    const restoredRagdoll = [...target.entities].find((e) => e.def.id === 'crash-dummy')!;
    const restoredVehicle = [...target.entities].find((e) => e.def.id === 'sedan')!;
    expect(restoredRagdoll.bodies).toHaveLength(11);
    expect(restoredRagdoll.standing).toBe(true);
    expect(restoredVehicle.engineOn).toBe(true);
    expect(restoredVehicle.motorJoints).toHaveLength(4);
  });

  it('skips unknown catalog entries but restores the rest', async () => {
    const source = await makeWorld();
    source.spawn(def('block'), { position: [0, 0, 0] });
    const snapshot = snapshotWorld(source);
    snapshot.entities.push({
      ...snapshot.entities[0]!,
      defId: 'removed-object-from-old-build',
    });
    const target = await makeWorld();
    const result = restoreWorld(target, snapshot, (id) => registry.get(id));
    expect(result.restored).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(target.entityCount).toBe(1);
  });

  it('rejects invalid and outdated files with readable errors', () => {
    expect(() => parseWorldSnapshot('{nope')).toThrow(/valid JSON/i);
    expect(() => parseWorldSnapshot('{"hello":"world"}')).toThrow(/not a Sandbox3D/i);
    expect(() =>
      parseWorldSnapshot(
        JSON.stringify({
          format: 'sandbox3d-world',
          version: 999,
          gravity: -9.81,
          timeScale: 1,
          entities: [],
        }),
      ),
    ).toThrow(/newer Sandbox3D/i);
  });
});

describe('undo and redo', () => {
  it('restores complete world states and clears redo after a new edit', async () => {
    const world = await makeWorld();
    const history = new WorldHistory(
      () => snapshotWorld(world),
      (snapshot) => restoreWorld(world, snapshot, (id) => registry.get(id)),
    );
    history.record('Spawn block');
    world.spawn(def('block'), { position: [0, 0, 0] });
    expect(world.entityCount).toBe(1);
    history.record('Spawn chair');
    world.spawn(def('chair'), { position: [2, 0, 0] });
    expect(world.entityCount).toBe(2);

    expect(history.undo()).toBe('Spawn chair');
    expect(world.entityCount).toBe(1);
    expect([...world.entities][0]!.def.id).toBe('block');
    expect(history.undo()).toBe('Spawn block');
    expect(world.entityCount).toBe(0);
    expect(history.undo()).toBeNull();

    expect(history.redo()).toBe('Spawn block');
    expect(world.entityCount).toBe(1);
    history.record('Spawn cone');
    world.spawn(def('traffic-cone'), { position: [4, 0, 0] });
    expect(history.canRedo).toBe(false);
  });

  it('bounds memory by the configured history limit', async () => {
    const world = await makeWorld();
    const history = new WorldHistory(
      () => snapshotWorld(world),
      (snapshot) => restoreWorld(world, snapshot, (id) => registry.get(id)),
      3,
    );
    for (let i = 0; i < 10; i++) {
      history.record(`Spawn ${i}`);
      world.spawn(def('block'), { position: [i, 0, 0] });
    }
    expect(history.size).toBe(3);
  });
});

describe('ragdoll balance and vehicle controls', () => {
  it('keeps an untouched ragdoll standing, then goes limp when disturbed', async () => {
    const world = await makeWorld();
    const ragdoll = world.spawn(def('crash-dummy'), { position: [0, 0, 0] });
    stepFor(world, 2);
    expect(ragdoll.standing).toBe(true);
    expect(entityPosition(ragdoll)[1]).toBeGreaterThan(1.02);
    expect(ragdoll.bodies[2]!.body.translation().y).toBeGreaterThan(1.28);

    world.explodeAt([0, 1, 0], 6, 24, 0);
    expect(ragdoll.standing).toBe(false);
    stepFor(world, 1);
    expect(ragdoll.removed).toBe(false);
  });

  it('throttles and steers a driven vehicle', async () => {
    const world = await makeWorld();
    const car = world.spawn(def('sedan'), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
    stepFor(world, 0.4);
    const start = entityPosition(car);
    for (let i = 0; i < 84; i++) {
      world.driveVehicle(car, 1, 0);
      world.step(1 / 60);
    }
    const driven = entityPosition(car);
    expect(Math.hypot(driven[0] - start[0], driven[2] - start[2])).toBeGreaterThan(1);

    world.driveVehicle(car, 0, 1);
    stepFor(world, 0.5);
    const yaw = car.bodies[0]!.body.angvel().y;
    expect(Math.abs(yaw)).toBeGreaterThan(0.01);
    expect(entityVelocity(car)).toBeDefined();
  });
});
