/** The single catalog registry. Adding a new object starts (and ends) in these files. */

import { ObjectRegistry } from './registry';
import { BLOCKS } from './blocks';
import { PROPS } from './props';
import { FRAGILE } from './fragile';
import { EXPLOSIVES } from './explosives';
import { VEHICLES } from './vehicles';
import { RAGDOLLS } from './ragdolls';
import { NATURE } from './nature';
import { SOFT } from './soft';
import { WEAPONS } from './weapons';
import { GADGETS } from './gadgets';
import { PROJECTILES } from './projectiles';

export const registry = new ObjectRegistry();

registry
  .registerAll(BLOCKS)
  .registerAll(PROPS)
  .registerAll(FRAGILE)
  .registerAll(EXPLOSIVES)
  .registerAll(VEHICLES)
  .registerAll(RAGDOLLS)
  .registerAll(NATURE)
  .registerAll(SOFT)
  .registerAll(WEAPONS)
  .registerAll(GADGETS)
  .registerAll(PROJECTILES);

export { ObjectRegistry, CATEGORY_META, CATEGORY_ORDER, validateDef } from './registry';
export type {
  Behaviors,
  Category,
  ClothConfig,
  DestructibleConfig,
  EntityKind,
  ExplosiveConfig,
  FluidConfig,
  ObjectDef,
  PrimitiveShape,
  RagdollConfig,
  ShapeBounds,
  ShapePart,
  SoftConfig,
  SpawnOptions,
  VehicleConfig,
  WeaponConfig,
  WheelSpec,
} from './types';
export { CATEGORIES } from './types';
export { MATERIALS, PALETTES, type MaterialName, type MaterialPreset } from './materials';

export const VISIBLE_OBJECT_COUNT = registry.visible().length;
export const TOTAL_OBJECT_COUNT = registry.size;
