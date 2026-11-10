import { describe, expect, it } from 'vitest';
import { CATEGORIES, registry, validateDef } from '../src/catalog';
import { CATEGORY_META } from '../src/catalog/registry';

describe('catalog registry', () => {
  it('ships a large, validated catalog', () => {
    const visible = registry.visible();
    expect(visible.length).toBeGreaterThanOrEqual(150);
    const ids = visible.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of registry.all()) {
      expect(validateDef(def), `${def.id} should validate`).toEqual([]);
    }
  });

  it('covers every category with several entries', () => {
    const counts = registry.counts();
    for (const category of CATEGORIES) {
      expect(counts[category], `${category} count`).toBeGreaterThanOrEqual(5);
      expect(CATEGORY_META[category].label.length).toBeGreaterThan(1);
    }
  });

  it('exposes generated kinds', () => {
    const kinds = new Set(registry.visible().map((d) => d.kind ?? 'rigid'));
    for (const kind of ['rigid', 'ragdoll', 'vehicle', 'soft', 'cloth', 'fluid']) {
      expect(kinds.has(kind as never)).toBe(true);
    }
  });

  it('resolves every weapon projectile', () => {
    const weapons = registry.visible().filter((d) => d.behaviors?.weapon);
    expect(weapons.length).toBeGreaterThanOrEqual(5);
    for (const weapon of weapons) {
      const projectile = weapon.behaviors!.weapon!.projectile;
      expect(registry.get(projectile), `${weapon.id} → ${projectile}`).toBeDefined();
      expect(registry.get(projectile)!.hidden).toBe(true);
    }
  });

  it('searches names, tags and categories', () => {
    expect(registry.search('glass').length).toBeGreaterThan(3);
    expect(registry.search('ragdoll').length).toBeGreaterThan(3);
    expect(registry.search('explosive').length).toBeGreaterThan(3);
    expect(registry.search('zzzzz-not-real')).toHaveLength(0);
    expect(registry.search('ball', { category: 'blocks' }).length).toBeGreaterThan(2);
    expect(registry.search('', { category: 'vehicles' }).every((d) => d.category === 'vehicles')).toBe(true);
  });

  it('keeps hidden projectiles out of the visible catalog', () => {
    expect(registry.visible().some((d) => d.hidden)).toBe(false);
    expect(registry.search('bullet')).toHaveLength(0);
    expect(registry.search('bullet', { includeHidden: true }).length).toBeGreaterThan(0);
  });

  it('rejects malformed definitions', () => {
    expect(
      validateDef({
        id: 'Bad Id',
        name: '',
        category: 'blocks',
        parts: [],
      }).length,
    ).toBeGreaterThan(2);

    expect(() =>
      registry.register({
        id: 'broken-thing',
        name: 'Broken',
        category: 'blocks',
        kind: 'rigid',
      }),
    ).toThrow(/Invalid object definition/);

    expect(() =>
      registry.register({
        id: 'block',
        name: 'Duplicate',
        category: 'blocks',
        parts: [{ shape: { kind: 'box', hx: 0.1, hy: 0.1, hz: 0.1 } }],
      }),
    ).toThrow(/Duplicate/);
  });
});
