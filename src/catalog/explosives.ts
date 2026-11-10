/** Explosive devices: fused bombs, impact mines and chain-reaction barrels. */

import type { ObjectDef } from './types';
import { PALETTES } from './materials';
import { box, cone, cyl, ball } from './shapes';

interface BoomOptions {
  radius: number;
  impulse: number;
  damage: number;
  fuse?: number;
  impact?: boolean;
  threshold?: number;
  shatter?: number;
  colors?: readonly string[];
  material?: ObjectDef['material'];
  tags?: string[];
  icon: string;
}

function boom(
  id: string,
  name: string,
  parts: NonNullable<ObjectDef['parts']>,
  o: BoomOptions,
): ObjectDef {
  return {
    id,
    name,
    icon: o.icon,
    category: 'explosives',
    kind: 'rigid',
    material: o.material ?? 'explosive',
    colors: [...(o.colors ?? PALETTES.explosive)],
    parts,
    tags: ['explosive', 'boom', ...(o.tags ?? [])],
    description: `${name} — blast radius ${o.radius.toFixed(0)} m`,
    behaviors: {
      explosive: {
        radius: o.radius,
        impulse: o.impulse,
        damage: o.damage,
        fuse: o.fuse,
        impactTrigger: o.impact,
        triggerThreshold: o.threshold,
        shatter: o.shatter ?? 8,
        color: o.colors?.[0] ?? '#ff7a2f',
      },
    },
  };
}

export const EXPLOSIVES: ObjectDef[] = [
  boom(
    'tnt-bundle',
    'TNT Bundle',
    [
      box(0.24, 0.24, 0.5, { pos: [-0.26, 0.13, 0] }),
      box(0.24, 0.24, 0.5, { pos: [0, 0.13, 0] }),
      box(0.24, 0.24, 0.5, { pos: [0.26, 0.13, 0] }),
      box(0.4, 0.04, 0.04, { pos: [0, 0.28, 0], color: '#f0d9a0' }),
      cyl(0.01, 0.18, { pos: [0.1, 0.36, 0.08], rot: [0.4, 0, 0.5], color: '#2b2b2b' }),
    ],
    { radius: 8, impulse: 16, damage: 90, fuse: 3, shatter: 12, icon: '🧨', tags: ['tnt'] },
  ),
  boom(
    'bomb',
    'Round Bomb',
    [
      ball(0.28, { pos: [0, 0.28, 0] }),
      cyl(0.07, 0.1, { pos: [0, 0.62, 0], material: 'metal' }),
      cyl(0.012, 0.16, { pos: [0.02, 0.74, 0], rot: [0, 0, 0.3], color: '#2a2723' }),
    ],
    { radius: 7, impulse: 15, damage: 80, fuse: 2.5, shatter: 10, icon: '💣', colors: ['#23262b', '#33363d'] },
  ),
  boom(
    'dynamite',
    'Dynamite',
    [
      cyl(0.055, 0.5, { pos: [-0.05, 0.25, -0.05], color: '#c23a2f' }),
      cyl(0.055, 0.5, { pos: [0.05, 0.25, 0.02], color: '#d44436' }),
      cyl(0.055, 0.5, { pos: [0, 0.25, 0.08], color: '#b5332a' }),
      box(0.22, 0.04, 0.22, { pos: [0, 0.28, 0], color: '#e0c98a' }),
      cyl(0.008, 0.15, { pos: [0.02, 0.53, 0.02], rot: [0.2, 0, 0.2], color: '#252525' }),
    ],
    { radius: 6, impulse: 13, damage: 70, fuse: 2, shatter: 8, icon: '🧨' },
  ),
  boom(
    'grenade',
    'Grenade',
    [
      ball(0.11, { pos: [0, 0.11, 0] }),
      cyl(0.045, 0.07, { pos: [0, 0.24, 0], material: 'metal' }),
      box(0.02, 0.09, 0.02, { pos: [0.055, 0.27, 0], rot: [0, 0, 0.35], color: '#aeb6c1' }),
    ],
    {
      radius: 5.5,
      impulse: 12,
      damage: 65,
      fuse: 2.2,
      shatter: 9,
      icon: '💥',
      colors: ['#4b5a3d', '#3d4a32'],
      tags: ['small'],
    },
  ),
  boom(
    'landmine',
    'Land Mine',
    [
      cyl(0.24, 0.09, { pos: [0, 0.045, 0] }),
      cyl(0.1, 0.03, { pos: [0, 0.1, 0], material: 'metal' }),
      box(0.08, 0.02, 0.02, { pos: [0, 0.11, 0], color: '#d6b54a' }),
    ],
    {
      radius: 6,
      impulse: 14,
      damage: 100,
      impact: true,
      threshold: 24,
      shatter: 12,
      icon: '⚠️',
      colors: ['#4a4f45', '#383d34'],
      tags: ['mine', 'trap'],
    },
  ),
  boom(
    'rocket',
    'Rocket',
    [
      cyl(0.12, 0.7, { pos: [0, 0.35, 0], color: '#d8dde5', material: 'metal' }),
      cone(0.12, 0.26, { pos: [0, 0.82, 0], color: '#c23a2f' }),
      box(0.3, 0.05, 0.18, { pos: [0, 0.06, 0], color: '#aeb6c1' }),
      box(0.05, 0.2, 0.18, { pos: [0, 0.08, 0], color: '#2a2f36' }),
    ],
    { radius: 9, impulse: 20, damage: 110, fuse: 4, shatter: 14, icon: '🚀', colors: ['#d8dde5'] },
  ),
  boom(
    'gas-canister',
    'Gas Canister',
    [cyl(0.2, 0.65, { pos: [0, 0.325, 0] }), cyl(0.05, 0.12, { pos: [0, 0.68, 0], material: 'metal' })],
    { radius: 8.5, impulse: 17, damage: 95, fuse: 2.8, shatter: 12, icon: '🛢️', tags: ['round'] },
  ),
  boom(
    'firework',
    'Firework',
    [cyl(0.11, 0.55, { pos: [0, 0.28, 0], color: '#2c4f9e' }), cone(0.09, 0.14, { pos: [0, 0.63, 0], color: '#e64a3f' }), cyl(0.012, 0.16, { pos: [0, 0.72, 0], color: '#d6c08a' })],
    { radius: 10, impulse: 13, damage: 50, fuse: 2, shatter: 18, icon: '🎆', colors: ['#2c4f9e'] },
  ),
  boom(
    'powder-keg',
    'Powder Keg',
    [
      cyl(0.34, 0.85, { pos: [0, 0.425, 0] }),
      cyl(0.355, 0.05, { pos: [0, 0.2, 0], material: 'metal' }),
      cyl(0.355, 0.05, { pos: [0, 0.65, 0], material: 'metal' }),
    ],
    {
      radius: 9.5,
      impulse: 19,
      damage: 120,
      fuse: 3.4,
      shatter: 14,
      icon: '🛢️',
      colors: PALETTES.darkWood,
      material: 'wood',
      tags: ['round'],
    },
  ),
  boom(
    'oil-drum',
    'Oil Drum',
    [cyl(0.32, 0.9, { pos: [0, 0.45, 0] }), cyl(0.345, 0.04, { pos: [0, 0.3, 0], color: '#575e66' }), cyl(0.345, 0.04, { pos: [0, 0.6, 0], color: '#575e66' })],
    {
      radius: 8,
      impulse: 16,
      damage: 90,
      impact: true,
      threshold: 46,
      shatter: 12,
      icon: '🛢️',
      colors: ['#b54a2a', '#9e3f23'],
      material: 'metal',
      tags: ['round'],
    },
  ),
  boom(
    'c4',
    'C4 Charge',
    [
      box(0.36, 0.12, 0.24, { pos: [0, 0.06, 0] }),
      box(0.06, 0.14, 0.05, { pos: [-0.08, 0.1, 0], color: '#3c3f44' }),
      box(0.06, 0.14, 0.05, { pos: [0.08, 0.1, 0], color: '#3c3f44' }),
      cyl(0.009, 0.16, { pos: [0.12, 0.18, 0], rot: [0.2, 0, 0.3], color: '#252525' }),
    ],
    { radius: 7.5, impulse: 16, damage: 100, fuse: 3, shatter: 10, icon: '🧱', colors: ['#d9d2b4'] },
  ),
  boom(
    'nuke',
    'Big Bomb',
    [
      ball(0.7, { pos: [0, 0.7, 0], color: '#7d838c' }),
      cone(0.35, 0.5, { pos: [0, 1.55, 0], color: '#c23a2f' }),
      box(1.1, 0.1, 0.5, { pos: [0, 0.5, 0], color: '#3a3f46' }),
      box(0.1, 0.1, 1.3, { pos: [0, 0.5, 0], color: '#3a3f46' }),
    ],
    {
      radius: 24,
      impulse: 36,
      damage: 260,
      fuse: 7,
      shatter: 18,
      icon: '☢️',
      colors: ['#7d838c'],
      material: 'metal',
      tags: ['heavy', 'big'],
    },
  ),
  boom(
    'artillery-shell',
    'Artillery Shell',
    [cyl(0.14, 0.6, { pos: [0, 0.3, 0], material: 'metal', color: '#a7a45b' }), cone(0.14, 0.24, { pos: [0, 0.72, 0], material: 'metal', color: '#8c8a4c' })],
    {
      radius: 6,
      impulse: 14,
      damage: 85,
      impact: true,
      threshold: 30,
      shatter: 10,
      icon: '💣',
      colors: ['#a7a45b'],
      material: 'metal',
      tags: ['shell'],
    },
  ),
  boom(
    'molotov',
    'Molotov',
    [
      cyl(0.075, 0.24, { pos: [0, 0.12, 0] }),
      cyl(0.035, 0.14, { pos: [0, 0.31, 0] }),
      cyl(0.04, 0.03, { pos: [0, 0.39, 0], material: 'metal' }),
      cyl(0.03, 0.16, { pos: [0.02, 0.45, 0], rot: [0, 0, 0.25], color: '#d8c9a4' }),
    ],
    {
      radius: 5,
      impulse: 11,
      damage: 60,
      fuse: 2.8,
      shatter: 10,
      icon: '🔥',
      colors: ['#b8863b'],
      material: 'glass',
      tags: ['fire'],
    },
  ),
];

