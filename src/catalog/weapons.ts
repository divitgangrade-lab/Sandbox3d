/** Melee weapons and firearms. Guns fire their projectile when you press F. */

import type { ObjectDef } from './types';
import { PALETTES } from './materials';
import { ball, box, cone, cyl, moved } from './shapes';

function melee(
  id: string,
  name: string,
  icon: string,
  parts: NonNullable<ObjectDef['parts']>,
  extra: Partial<ObjectDef> = {},
): ObjectDef {
  return {
    id,
    name,
    icon,
    category: 'weapons',
    kind: 'rigid',
    material: 'metal',
    colors: PALETTES.metal,
    parts,
    tags: ['weapon', 'melee', 'tool'],
    description: `${name}. Grab it and swing.`,
    ...extra,
  };
}

interface GunOptions {
  icon: string;
  projectile: string;
  speed: number;
  cooldown: number;
  count?: number;
  spread?: number;
  muzzle: [number, number, number];
  recoil?: number;
  tags?: string[];
  description?: string;
}

function gun(
  id: string,
  name: string,
  parts: NonNullable<ObjectDef['parts']>,
  o: GunOptions,
): ObjectDef {
  return {
    id,
    name,
    icon: o.icon,
    category: 'weapons',
    kind: 'rigid',
    material: 'metal',
    colors: PALETTES.metal,
    parts,
    tags: ['weapon', 'gun', 'ranged', 'tool', ...(o.tags ?? [])],
    description: o.description ?? `${name}. Press F to fire.`,
    behaviors: {
      weapon: {
        projectile: o.projectile,
        speed: o.speed,
        cooldown: o.cooldown,
        count: o.count,
        spread: o.spread,
        muzzle: o.muzzle,
        recoil: o.recoil ?? 1.2,
      },
    },
  };
}

const swordParts = (length: number, width = 0.075): NonNullable<ObjectDef['parts']> => [
  box(width, length, 0.018, { pos: [0, 0.24 + length / 2, 0], color: '#d5dbe4' }),
  box(0.3, 0.05, 0.07, { pos: [0, 0.22, 0], color: '#c8a23a' }),
  cyl(0.032, 0.24, { pos: [0, 0.1, 0], color: '#6b3f2a', material: 'wood' }),
  ball(0.05, { pos: [0, -0.03, 0], color: '#c8a23a' }),
];

export const WEAPONS: ObjectDef[] = [
  melee('sword', 'Sword', '⚔️', swordParts(0.95), { description: 'A classic steel sword' }),
  melee('greatsword', 'Greatsword', '🗡️', swordParts(1.4, 0.11), {
    tags: ['weapon', 'melee', 'heavy'],
    description: 'Big, slow and satisfying',
  }),
  melee(
    'katana',
    'Katana',
    '🗡️',
    [
      box(0.05, 1.05, 0.012, { pos: [0, 0.8, 0], color: '#e8edf3' }),
      box(0.16, 0.04, 0.05, { pos: [0, 0.26, 0], color: '#30262a' }),
      cyl(0.03, 0.24, { pos: [0, 0.13, 0], color: '#2b2b30' }),
    ],
    { description: 'A slender curved blade' },
  ),
  melee(
    'dagger',
    'Dagger',
    '🔪',
    [
      box(0.05, 0.3, 0.012, { pos: [0, 0.32, 0], color: '#d5dbe4' }),
      box(0.14, 0.03, 0.05, { pos: [0, 0.15, 0], color: '#b48a30' }),
      cyl(0.028, 0.14, { pos: [0, 0.07, 0], color: '#4a2f22', material: 'wood' }),
    ],
    { tags: ['weapon', 'melee', 'small'] },
  ),
  melee(
    'battle-axe',
    'Battle Axe',
    '🪓',
    [
      cyl(0.04, 1.2, { pos: [0, 0.6, 0], color: '#6b4a30', material: 'wood' }),
      box(0.34, 0.28, 0.06, { pos: [0.18, 1.12, 0], color: '#9aa7b8' }),
      cone(0.17, 0.3, { pos: [0.34, 1.12, 0], rot: [0, 0, -Math.PI / 2], color: '#c3ccd8' }),
      box(0.1, 0.14, 0.1, { pos: [0, 1.12, 0], color: '#6f7a89' }),
    ],
    { tags: ['weapon', 'melee', 'heavy'] },
  ),
  melee(
    'hammer',
    'Hammer',
    '🔨',
    [
      cyl(0.035, 0.8, { pos: [0, 0.4, 0], color: '#6b4a30', material: 'wood' }),
      box(0.34, 0.14, 0.14, { pos: [0, 0.78, 0], color: '#8e99a8' }),
      box(0.08, 0.2, 0.2, { pos: [-0.18, 0.78, 0], color: '#6f7a89' }),
    ],
    { tags: ['weapon', 'melee', 'tool'] },
  ),
  melee(
    'sledgehammer',
    'Sledgehammer',
    '🔨',
    [
      cyl(0.045, 1, { pos: [0, 0.5, 0], color: '#5b3d27', material: 'wood' }),
      box(0.45, 0.2, 0.2, { pos: [0, 0.98, 0], color: '#6f7a89' }),
      box(0.1, 0.28, 0.28, { pos: [-0.24, 0.98, 0], color: '#4a525d' }),
    ],
    { tags: ['weapon', 'melee', 'heavy'] },
  ),
  melee(
    'baseball-bat',
    'Baseball Bat',
    '🏏',
    [
      cyl(0.035, 0.35, { pos: [0, 0.18, 0], color: '#8b5a34', material: 'wood' }),
      cyl(0.06, 0.7, { pos: [0, 0.68, 0], color: '#b07a4a', material: 'wood' }),
      cyl(0.075, 0.16, { pos: [0, 1.0, 0], color: '#c98e58', material: 'wood' }),
    ],
    { tags: ['weapon', 'melee', 'wood'], material: 'wood', colors: PALETTES.wood },
  ),
  melee(
    'crowbar',
    'Crowbar',
    '🪓',
    [
      cyl(0.025, 1, { pos: [0, 0.45, 0], color: '#c23a2f' }),
      cyl(0.025, 0.25, { pos: [0.1, 0.95, 0], rot: [0, 0, -0.9], color: '#c23a2f' }),
      cone(0.035, 0.16, { pos: [-0.1, 0.06, 0], rot: [0, 0, Math.PI / 2], color: '#a52c24' }),
    ],
    { tags: ['weapon', 'melee', 'tool'], colors: ['#c23a2f'] },
  ),
  melee(
    'spear',
    'Spear',
    '🔱',
    [
      cyl(0.025, 1.9, { pos: [0, 0.95, 0], color: '#7a5234', material: 'wood' }),
      cone(0.06, 0.3, { pos: [0, 2.02, 0], color: '#d5dbe4' }),
      cyl(0.035, 0.08, { pos: [0, 1.86, 0], color: '#b48a30' }),
    ],
    { tags: ['weapon', 'melee', 'long'] },
  ),
  melee(
    'shield',
    'Shield',
    '🛡️',
    [
      box(0.7, 0.9, 0.08, { pos: [0, 0.5, 0], color: '#7f8a9a' }),
      box(0.66, 0.86, 0.02, { pos: [0, 0.5, 0.05], color: '#c8a23a' }),
      ball(0.09, { pos: [0, 0.5, 0.08], color: '#c8a23a' }),
      box(0.1, 0.25, 0.08, { pos: [0, 0.5, -0.08] }),
    ],
    { tags: ['weapon', 'melee', 'armor', 'heavy'], description: 'A heavy round shield' },
  ),
  gun(
    'pistol',
    'Pistol',
    [
      box(0.3, 0.14, 0.08, { pos: [0, 0.18, 0], color: '#3a3f46' }),
      box(0.09, 0.24, 0.1, { pos: [0, 0.05, -0.03], rot: [0.2, 0, 0], color: '#2b3038' }),
      moved(cyl(0.028, 0.22, { pos: [0, 0.2, 0.16], color: '#59636f' }), [0, 0.2, 0.16], [Math.PI / 2, 0, 0]),
    ],
    { icon: '🔫', projectile: 'bullet', speed: 55, cooldown: 0.28, muzzle: [0, 0.2, 0.3], recoil: 1.1, description: 'A small sidearm. Press F to fire.' },
  ),
  gun(
    'shotgun',
    'Shotgun',
    [
      box(0.26, 0.14, 0.9, { pos: [0, 0.2, 0.2], color: '#57392a', material: 'wood' }),
      moved(cyl(0.035, 0.85, { pos: [0, 0.26, 0.42], color: '#59636f' }), [0, 0.26, 0.42], [Math.PI / 2, 0, 0]),
      moved(cyl(0.028, 0.7, { pos: [0, 0.18, 0.45], color: '#4a525d' }), [0, 0.18, 0.45], [Math.PI / 2, 0, 0]),
      box(0.1, 0.2, 0.14, { pos: [0, 0.06, -0.12], rot: [0.2, 0, 0], color: '#3b2a20' }),
    ],
    { icon: '🔫', projectile: 'pellet', speed: 48, cooldown: 0.75, count: 6, spread: 0.1, muzzle: [0, 0.22, 0.9], recoil: 3, description: 'Six pellets per shot' },
  ),
  gun(
    'rifle',
    'Rifle',
    [
      box(0.22, 0.12, 1.3, { pos: [0, 0.22, 0.15], color: '#4a3a2e', material: 'wood' }),
      moved(cyl(0.026, 1, { pos: [0, 0.26, 0.5], color: '#59636f' }), [0, 0.26, 0.5], [Math.PI / 2, 0, 0]),
      box(0.1, 0.24, 0.16, { pos: [0, 0.06, -0.12], rot: [0.25, 0, 0], color: '#3b2a20' }),
      box(0.12, 0.12, 0.3, { pos: [0, 0.12, 0.15], color: '#2b3038' }),
    ],
    { icon: '🔫', projectile: 'bullet', speed: 75, cooldown: 0.5, spread: 0.015, muzzle: [0, 0.26, 1.02], recoil: 2, description: 'Accurate and fast' },
  ),
  gun(
    'rocket-launcher',
    'Rocket Launcher',
    [
      moved(cyl(0.13, 1.2, { pos: [0, 0.35, 0.2], color: '#4f5a42' }), [0, 0.35, 0.2], [Math.PI / 2, 0, 0]),
      cyl(0.16, 0.16, { pos: [0, 0.35, -0.35], rot: [Math.PI / 2, 0, 0], color: '#3a4231' }),
      box(0.08, 0.24, 0.1, { pos: [0, 0.1, 0], color: '#2c3038' }),
      box(0.3, 0.04, 0.08, { pos: [0, 0.5, 0.1], color: '#2c3038' }),
    ],
    { icon: '🚀', projectile: 'rocket-projectile', speed: 32, cooldown: 1.5, muzzle: [0, 0.35, 1.1], recoil: 4, tags: ['heavy'], description: 'Fires an explosive rocket' },
  ),
  gun(
    'cannon',
    'Cannon',
    [
      moved(cyl(0.2, 1.1, { pos: [0, 0.45, 0.25], color: '#3f4650' }), [0, 0.45, 0.25], [Math.PI / 2, 0, 0]),
      cyl(0.22, 0.1, { pos: [0, 0.45, 0.8], rot: [Math.PI / 2, 0, 0], color: '#2f343c' }),
      box(0.6, 0.25, 0.9, { pos: [0, 0.18, 0], color: '#6b4a30', material: 'wood' }),
      cyl(0.3, 0.16, { pos: [-0.42, 0.3, 0], rot: [0, 0, Math.PI / 2], color: '#7a5234', material: 'wood' }),
      cyl(0.3, 0.16, { pos: [0.42, 0.3, 0], rot: [0, 0, Math.PI / 2], color: '#7a5234', material: 'wood' }),
    ],
    { icon: '💣', projectile: 'cannonball', speed: 28, cooldown: 2.2, muzzle: [0, 0.45, 1], recoil: 6, tags: ['heavy'], description: 'Slow to reload, devastating at range' },
  ),
  gun(
    'crossbow',
    'Crossbow',
    [
      box(0.1, 0.1, 0.9, { pos: [0, 0.2, 0.25], color: '#6b4a30', material: 'wood' }),
      box(0.8, 0.05, 0.09, { pos: [0, 0.26, 0.6], color: '#3b2a20' }),
      box(0.03, 0.03, 0.85, { pos: [0, 0.28, 0.6], color: '#d9d2b4' }),
      box(0.08, 0.18, 0.12, { pos: [0, 0.08, -0.05], color: '#2c3038' }),
    ],
    { icon: '🏹', projectile: 'arrow', speed: 34, cooldown: 1.1, spread: 0.01, muzzle: [0, 0.26, 1.05], recoil: 0.8, description: 'Silent, springy and pointy' },
  ),
  gun(
    'grenade-launcher',
    'Grenade Launcher',
    [
      box(0.26, 0.24, 0.5, { pos: [0, 0.28, 0], color: '#4a5340' }),
      moved(cyl(0.075, 0.6, { pos: [0, 0.32, 0.4] }), [0, 0.32, 0.4], [Math.PI / 2, 0, 0]),
      cyl(0.14, 0.1, { pos: [0, 0.34, -0.1], rot: [Math.PI / 2, 0, 0], color: '#333a2c' }),
      box(0.08, 0.24, 0.1, { pos: [0, 0.08, -0.1], color: '#2c3038' }),
      box(0.2, 0.14, 0.3, { pos: [0, 0.5, 0], color: '#333a2c' }),
    ],
    { icon: '💥', projectile: 'grenade-projectile', speed: 20, cooldown: 1.6, muzzle: [0, 0.34, 0.75], recoil: 2.5, description: 'Lobs a fused grenade' },
  ),
];
