/** Catalog registry + validation. Pure data; safe to import from Node tests. */

import type { Category, CategoryMeta, ObjectDef } from './types';
import { CATEGORIES } from './types';
import { validateShape } from './shapes';

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  blocks: { id: 'blocks', label: 'Blocks', icon: '▦', hint: 'Primitives and building material' },
  props: { id: 'props', label: 'Props', icon: '🪑', hint: 'Furniture and everyday objects' },
  fragile: { id: 'fragile', label: 'Fragile', icon: '🫙', hint: 'Breakable glass and ceramics' },
  explosives: { id: 'explosives', label: 'Explosives', icon: '💥', hint: 'Things that go boom' },
  vehicles: { id: 'vehicles', label: 'Vehicles', icon: '🚗', hint: 'Wheeled machines you can drive' },
  ragdolls: { id: 'ragdolls', label: 'Ragdolls', icon: '🧍', hint: 'Joint-driven crash test bodies' },
  nature: { id: 'nature', label: 'Nature', icon: '🌳', hint: 'Trees, rocks, fruit and ice' },
  soft: { id: 'soft', label: 'Soft & Fluids', icon: '🫧', hint: 'Jelly, cloth and water' },
  weapons: { id: 'weapons', label: 'Weapons', icon: '⚔️', hint: 'Melee and projectile weapons' },
  gadgets: { id: 'gadgets', label: 'Gadgets', icon: '🧲', hint: 'Forces, magnets and launchers' },
};

export const CATEGORY_ORDER: Category[] = [...CATEGORIES];

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function validateDef(def: ObjectDef): string[] {
  const errors: string[] = [];
  if (!def || typeof def !== 'object') return ['definition must be an object'];
  if (!def.id || !ID_PATTERN.test(def.id)) errors.push('id must be lowercase kebab-case');
  if (!def.name || def.name.trim().length === 0) errors.push('name is required');
  if (!CATEGORIES.includes(def.category)) errors.push(`unknown category "${String(def.category)}"`);
  if (def.colors && def.colors.some((c) => typeof c !== 'string' || c.length === 0)) {
    errors.push('colors must be non-empty strings');
  }
  if (def.spawnScale) {
    const [min, max] = def.spawnScale;
    if (!(min > 0) || !(max >= min)) errors.push('spawnScale must be [min > 0, max >= min]');
  }

  const kind = def.kind ?? 'rigid';
  switch (kind) {
    case 'rigid': {
      if (!def.parts || def.parts.length === 0) errors.push('rigid objects need at least one part');
      break;
    }
    case 'ragdoll':
      if (!def.ragdoll) errors.push('ragdoll objects need a ragdoll config');
      break;
    case 'vehicle':
      if (!def.vehicle) errors.push('vehicle objects need a vehicle config');
      else if (def.vehicle.wheels.length === 0) errors.push('vehicle needs at least one wheel');
      if (!def.parts || def.parts.length === 0) errors.push('vehicle needs chassis parts');
      break;
    case 'soft':
      if (!def.soft) errors.push('soft objects need a soft config');
      else {
        const [x, y, z] = def.soft.grid;
        if (x < 1 || y < 1 || z < 1) errors.push('soft grid must be at least 1x1x1');
        if (!(def.soft.spacing > 0)) errors.push('soft spacing must be positive');
      }
      break;
    case 'cloth':
      if (!def.cloth) errors.push('cloth objects need a cloth config');
      else {
        const [w, h] = def.cloth.grid;
        if (w < 2 || h < 2) errors.push('cloth grid must be at least 2x2');
        if (!(def.cloth.spacing > 0)) errors.push('cloth spacing must be positive');
      }
      break;
    case 'fluid':
      if (!def.fluid) errors.push('fluid objects need a fluid config');
      else if (def.fluid.count < 1) errors.push('fluid count must be positive');
      break;
  }

  if (def.parts) {
    def.parts.forEach((part, i) => {
      if (!part || !part.shape) {
        errors.push(`part ${i} has no shape`);
        return;
      }
      for (const message of validateShape(part.shape)) errors.push(`part ${i}: ${message}`);
      if (part.pos && part.pos.some((v) => !Number.isFinite(v))) {
        errors.push(`part ${i}: pos must be finite`);
      }
    });
  }

  const b = def.behaviors;
  if (b?.explosive) {
    if (!(b.explosive.radius > 0)) errors.push('explosive radius must be positive');
    if (!(b.explosive.impulse > 0)) errors.push('explosive impulse must be positive');
    if (b.explosive.fuse !== undefined && b.explosive.fuse < 0) errors.push('fuse cannot be negative');
  }
  if (b?.destructible) {
    if (!(b.destructible.hp > 0)) errors.push('destructible hp must be positive');
    if (!(b.destructible.impactThreshold > 0)) errors.push('destructible threshold must be positive');
    if (b.destructible.fragments < 0) errors.push('fragments cannot be negative');
  }
  if (b?.weapon) {
    if (!b.weapon.projectile) errors.push('weapon needs a projectile id');
    if (!(b.weapon.speed > 0)) errors.push('weapon speed must be positive');
    if (!(b.weapon.cooldown >= 0)) errors.push('weapon cooldown cannot be negative');
  }
  if (b?.forceField && !(b.forceField.radius > 0)) errors.push('force field radius must be positive');
  if (b?.buoyant && !(b.buoyant.lift > 0)) errors.push('buoyancy lift must be positive');

  return errors;
}

export class ObjectRegistry {
  private readonly defs = new Map<string, ObjectDef>();

  register(def: ObjectDef): this {
    const errors = validateDef(def);
    if (errors.length > 0) {
      throw new Error(`Invalid object definition "${def?.id ?? '?'}": ${errors.join('; ')}`);
    }
    if (this.defs.has(def.id)) throw new Error(`Duplicate object id "${def.id}"`);
    this.defs.set(def.id, def);
    return this;
  }

  registerAll(defs: readonly ObjectDef[]): this {
    for (const def of defs) this.register(def);
    return this;
  }

  get(id: string): ObjectDef | undefined {
    return this.defs.get(id);
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  all(): ObjectDef[] {
    return [...this.defs.values()];
  }

  visible(): ObjectDef[] {
    return this.all().filter((def) => !def.hidden);
  }

  byCategory(category: Category): ObjectDef[] {
    return this.visible().filter((def) => def.category === category);
  }

  categories(): CategoryMeta[] {
    return CATEGORY_ORDER.map((id) => CATEGORY_META[id]);
  }

  counts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const category of CATEGORY_ORDER) counts[category] = 0;
    for (const def of this.visible()) counts[def.category] = (counts[def.category] ?? 0) + 1;
    return counts;
  }

  search(query: string, options: { category?: Category; includeHidden?: boolean } = {}): ObjectDef[] {
    const q = query.trim().toLowerCase();
    return this.all()
      .filter((def) => {
        if (!options.includeHidden && def.hidden) return false;
        if (options.category && def.category !== options.category) return false;
        if (!q) return true;
        const haystack = [def.name, def.id, def.category, def.description ?? '', ...(def.tags ?? [])]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get size(): number {
    return this.defs.size;
  }
}
