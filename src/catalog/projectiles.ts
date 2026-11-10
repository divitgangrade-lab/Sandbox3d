/** Hidden defs spawned by weapons. Not shown in the catalog. */

import type { ObjectDef } from './types';
import { PALETTES } from './materials';
import { ball, box, cone, cyl, moved } from './shapes';

type ProjectileDef = Omit<ObjectDef, 'category' | 'hidden' | 'kind' | 'tags'> & { tags?: string[] };

const projectile = (def: ProjectileDef): ObjectDef => ({
  hidden: true,
  category: 'weapons',
  kind: 'rigid',
  tags: ['projectile'],
  ...def,
});

export const PROJECTILES: ObjectDef[] = [
  projectile({
    id: 'bullet',
    name: 'Bullet',
    icon: '•',
    material: 'gold',
    colors: PALETTES.gold,
    parts: [moved(cyl(0.022, 0.09), [0, 0, 0], [Math.PI / 2, 0, 0]), cone(0.022, 0.03, { pos: [0, 0, 0.06], rot: [Math.PI / 2, 0, 0] })],
    spawnScale: [1, 1],
  }),
  projectile({
    id: 'pellet',
    name: 'Pellet',
    icon: '•',
    material: 'metal',
    colors: PALETTES.metal,
    parts: [ball(0.03)],
    spawnScale: [1, 1],
  }),
  projectile({
    id: 'cannonball',
    name: 'Cannonball',
    icon: '⚫',
    material: 'metal',
    colors: ['#2b3038'],
    parts: [ball(0.18)],
    spawnScale: [1, 1],
    behaviors: {
      explosive: { radius: 5, impulse: 12, damage: 65, impactTrigger: true, triggerThreshold: 30, shatter: 6, color: '#ffb347' },
    },
  }),
  projectile({
    id: 'rocket-projectile',
    name: 'Rocket',
    icon: '🚀',
    material: 'metal',
    colors: ['#d8dde5'],
    parts: [
      moved(cyl(0.07, 0.35), [0, 0, 0], [Math.PI / 2, 0, 0]),
      cone(0.07, 0.12, { pos: [0, 0, 0.24], rot: [Math.PI / 2, 0, 0], color: '#c23a2f' }),
      box(0.22, 0.02, 0.14, { pos: [0, 0, -0.16], color: '#2c3038' }),
      box(0.02, 0.22, 0.14, { pos: [0, 0, -0.16], color: '#2c3038' }),
    ],
    spawnScale: [1, 1],
    behaviors: {
      explosive: { radius: 8, impulse: 18, damage: 110, impactTrigger: true, triggerThreshold: 18, shatter: 10, color: '#ff8a3d' },
    },
  }),
  projectile({
    id: 'arrow',
    name: 'Arrow',
    icon: '🏹',
    material: 'wood',
    colors: PALETTES.wood,
    parts: [
      cyl(0.018, 0.7, { pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] }),
      cone(0.04, 0.12, { pos: [0, 0, 0.4], rot: [Math.PI / 2, 0, 0], color: '#9aa7b8', material: 'metal' }),
      box(0.12, 0.008, 0.14, { pos: [0, 0, -0.3], color: '#e6e9ee' }),
    ],
    spawnScale: [1, 1],
  }),
  projectile({
    id: 'grenade-projectile',
    name: 'Grenade',
    icon: '💥',
    material: 'metal',
    colors: ['#4b5a3d'],
    parts: [ball(0.11), cyl(0.045, 0.07, { pos: [0, 0.14, 0], material: 'metal' })],
    spawnScale: [1, 1],
    behaviors: {
      explosive: { radius: 6, impulse: 14, damage: 80, fuse: 1.8, shatter: 8, color: '#ff9f1c' },
    },
  }),
];
