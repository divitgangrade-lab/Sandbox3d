/** Natural objects: trees, rocks, fruit, ice and snow. */

import type { ObjectDef } from './types';
import { PALETTES } from './materials';
import { ball, box, cone, cyl, hull, rockPoints } from './shapes';

function natural(
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
    category: 'nature',
    kind: 'rigid',
    material: 'wood',
    colors: [...PALETTES.wood],
    parts,
    tags: ['nature'],
    description: `${name} — part of the scenery`,
    ...extra,
  };
}

export const NATURE: ObjectDef[] = [
  natural(
    'tree',
    'Tree',
    '🌳',
    [
      cyl(0.22, 2.4, { pos: [0, 1.2, 0], color: '#7b5234' }),
      ball(0.95, { pos: [0, 2.6, 0], color: '#4c9a46' }),
      ball(0.7, { pos: [-0.75, 2.2, 0.1], color: '#3d8b3a' }),
      ball(0.65, { pos: [0.65, 2.3, -0.2], color: '#5aa84f' }),
      ball(0.55, { pos: [0.1, 3.2, 0.15], color: '#6bbf5a' }),
    ],
    { tags: ['tree', 'tall', 'heavy'], description: 'A leafy tree with a wide crown' },
  ),
  natural(
    'pine-tree',
    'Pine Tree',
    '🌲',
    [
      cyl(0.2, 2.6, { pos: [0, 1.3, 0], color: '#6b4a30' }),
      cone(1.1, 1.3, { pos: [0, 2.4, 0], color: '#2f6f3a' }),
      cone(0.85, 1.2, { pos: [0, 3.1, 0], color: '#357c40' }),
      cone(0.55, 1.1, { pos: [0, 3.8, 0], color: '#3d8b46' }),
    ],
    { tags: ['tree', 'tall'] },
  ),
  natural(
    'palm-tree',
    'Palm Tree',
    '🌴',
    [
      cyl(0.18, 3.2, { pos: [0, 1.6, 0], rot: [0, 0, 0.06], color: '#9a7748' }),
      box(2.6, 0.1, 0.32, { pos: [0, 3.3, 0], rot: [0, 0.4, 0], color: '#4fa843' }),
      box(2.6, 0.1, 0.32, { pos: [0, 3.3, 0], rot: [0, -0.4, 0], color: '#3f8f3a' }),
      box(2.4, 0.1, 0.3, { pos: [0, 3.3, 0], rot: [0, 1.9, 0], color: '#5bb34f' }),
      ball(0.18, { pos: [0.14, 3.1, 0.1], color: '#8a6a3c' }),
    ],
    { tags: ['tree', 'tall'], description: 'A palm with four fronds' },
  ),
  natural(
    'cactus',
    'Cactus',
    '🌵',
    [
      cyl(0.2, 1.4, { pos: [0, 0.7, 0], color: '#3f8f4a' }),
      cyl(0.11, 0.6, { pos: [0.26, 0.9, 0], rot: [0, 0, Math.PI / 2], color: '#4aa856' }),
      cyl(0.11, 0.8, { pos: [0.26, 1.05, 0], color: '#4aa856' }),
      cyl(0.09, 0.5, { pos: [-0.22, 0.65, 0], rot: [0, 0, Math.PI / 2], color: '#3d8547' }),
      cyl(0.09, 0.55, { pos: [-0.22, 0.82, 0], color: '#3d8547' }),
    ],
    { material: 'plastic', colors: ['#3f8f4a', '#4aa856'], tags: ['plant'] },
  ),
  natural(
    'bush',
    'Bush',
    '🌿',
    [ball(0.5, { pos: [0, 0.42, 0], color: '#4c9a46' }), ball(0.34, { pos: [0.38, 0.34, 0.1], color: '#3d8b3a' }), ball(0.3, { pos: [-0.35, 0.3, -0.1], color: '#5aa84f' })],
    { tags: ['plant'] },
  ),
  natural(
    'flower',
    'Flower',
    '🌷',
    [
      cyl(0.012, 0.4, { pos: [0, 0.2, 0], color: '#4c9a46' }),
      ball(0.08, { pos: [0, 0.42, 0], color: '#ff8fb1' }),
      ball(0.045, { pos: [0, 0.43, 0], color: '#ffd166' }),
      box(0.12, 0.01, 0.05, { pos: [0.05, 0.24, 0], color: '#4c9a46' }),
    ],
    { material: 'plastic', colors: PALETTES.flower, tags: ['plant', 'small'] },
  ),
  natural(
    'mushroom',
    'Mushroom',
    '🍄',
    [
      cyl(0.08, 0.28, { pos: [0, 0.14, 0], color: '#efe7d2' }),
      ball(0.22, { pos: [0, 0.32, 0], color: '#d94a3d' }),
      cyl(0.225, 0.04, { pos: [0, 0.28, 0], color: '#e8dcc3' }),
    ],
    { material: 'flesh', colors: ['#d94a3d', '#c23a2f'], tags: ['plant'] },
  ),
  natural(
    'watermelon',
    'Watermelon',
    '🍉',
    [ball(0.32, { pos: [0, 0.32, 0], color: '#3f8f3a' }), ball(0.08, { pos: [0, 0.64, 0], color: '#5f9e3a' })],
    {
      material: 'flesh',
      colors: ['#3f8f3a', '#4fa843'],
      tags: ['fruit', 'juicy', 'breakable'],
      behaviors: {
        destructible: {
          hp: 35,
          impactThreshold: 26,
          fragments: 8,
          fragmentColors: ['#3f8f3a', '#e5546b', '#f0d0d6'],
          releaseFluid: { count: 22, radius: 0.09, speed: 2.6 },
        },
      },
      description: 'A watermelon. It bursts into juice.',
    },
  ),
  natural(
    'pumpkin',
    'Pumpkin',
    '🎃',
    [ball(0.34, { pos: [0, 0.34, 0], color: '#e07a2a' }), cyl(0.02, 0.1, { pos: [0, 0.7, 0], color: '#4f6b32' })],
    { material: 'flesh', colors: ['#e07a2a', '#d06922'], tags: ['fruit', 'breakable'], behaviors: { destructible: { hp: 40, impactThreshold: 34, fragments: 9, fragmentColors: ['#e07a2a', '#c95c1f', '#f2b26b'] } } },
  ),
  natural(
    'snowman',
    'Snowman',
    '⛄',
    [
      ball(0.42, { pos: [0, 0.42, 0], color: '#eef6fa' }),
      ball(0.3, { pos: [0, 1.02, 0], color: '#f4fbff' }),
      ball(0.22, { pos: [0, 1.45, 0], color: '#ffffff' }),
      cone(0.05, 0.18, { pos: [0, 1.45, 0.24], rot: [Math.PI / 2, 0, 0], color: '#e07a2a' }),
      cyl(0.025, 0.4, { pos: [-0.3, 1.2, 0], rot: [0, 0, 0.9], color: '#6b4a30' }),
      cyl(0.025, 0.4, { pos: [0.3, 1.2, 0], rot: [0, 0, -0.9], color: '#6b4a30' }),
    ],
    { material: 'ice', colors: ['#eef6fa'], tags: ['snow', 'winter'] },
  ),
  natural(
    'ice-block',
    'Ice Block',
    '🧊',
    [box(0.9, 0.9, 0.9, { pos: [0, 0.45, 0] })],
    { material: 'ice', colors: PALETTES.ice, tags: ['slippery', 'glass'] },
  ),
  natural(
    'sandbag',
    'Sandbag',
    '🛖',
    [box(0.55, 0.2, 0.3, { pos: [0, 0.16, 0], rot: [0, 0.1, 0] }), box(0.52, 0.18, 0.28, { pos: [0.02, 0.36, 0], rot: [0, -0.15, 0.02] })],
    { material: 'cloth', colors: ['#c2a878', '#ad9364'], tags: ['soft-ish'] },
  ),
  natural(
    'hay-bale',
    'Hay Bale',
    '🌾',
    [cyl(0.55, 1.1, { pos: [0, 0.55, 0], rot: [0, 0, Math.PI / 2] }), cyl(0.56, 0.06, { pos: [-0.4, 0.55, 0], rot: [0, 0, Math.PI / 2], color: '#b38d4a' }), cyl(0.56, 0.06, { pos: [0.4, 0.55, 0], rot: [0, 0, Math.PI / 2], color: '#b38d4a' })],
    { material: 'cloth', colors: ['#c9a45c', '#b8944c'], tags: ['round'] },
  ),
  natural(
    'bamboo',
    'Bamboo',
    '🎋',
    [cyl(0.05, 2, { pos: [-0.1, 1, 0], color: '#7fae54' }), cyl(0.045, 1.7, { pos: [0.1, 0.85, 0.05], color: '#8fbe62' }), box(0.5, 0.03, 0.08, { pos: [0.1, 1.3, 0], rot: [0, 0.5, 0], color: '#5f8f3a' })],
    { material: 'wood', colors: ['#7fae54'], tags: ['plant', 'tall'] },
  ),
  natural(
    'moss-rock',
    'Mossy Rock',
    '🪨',
    [hull(rockPoints(0.55, 0.3, 31)), ball(0.25, { pos: [0, 0.46, 0], color: '#4c9a46' })],
    { material: 'stone', colors: PALETTES.stone, tags: ['rock'] },
  ),
  natural(
    'coral',
    'Coral',
    '🪸',
    [cyl(0.08, 0.6, { pos: [0, 0.3, 0], color: '#e06a8a' }), cyl(0.05, 0.5, { pos: [0.18, 0.45, 0], rot: [0, 0, -0.5], color: '#f07a9a' }), cyl(0.05, 0.4, { pos: [-0.16, 0.4, 0.05], rot: [0, 0, 0.5], color: '#d65a7a' })],
    { material: 'stone', colors: ['#e06a8a'], tags: ['plant'] },
  ),
  natural(
    'lily-pad',
    'Lily Pad',
    '🪷',
    [cyl(0.5, 0.03, { pos: [0, 0.015, 0], color: '#4c9a46' }), ball(0.08, { pos: [0.1, 0.06, 0], color: '#ff8fb1' })],
    { material: 'cloth', colors: ['#4c9a46'], tags: ['flat', 'plant'] },
  ),
  natural(
    'giant-seed',
    'Giant Seed',
    '🌰',
    [ball(0.24, { pos: [0, 0.24, 0], color: '#8a6034' }), cone(0.12, 0.25, { pos: [0, 0.58, 0], rot: [Math.PI, 0, 0], color: '#6b4a30' })],
    { material: 'wood', colors: ['#8a6034'], tags: ['fruit'] },
  ),
  natural(
    'mushroom-giant',
    'Giant Mushroom',
    '🍄‍🟫',
    [
      cyl(0.22, 0.9, { pos: [0, 0.45, 0], color: '#efe7d2' }),
      ball(0.7, { pos: [0, 1.05, 0], color: '#b34a3d' }),
      cyl(0.72, 0.1, { pos: [0, 0.85, 0], color: '#e8dcc3' }),
    ],
    { material: 'flesh', colors: ['#b34a3d'], tags: ['plant', 'tall'] },
  ),
];

