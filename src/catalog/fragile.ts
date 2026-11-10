/** Destructible glass, ceramics and other shatterable objects. */

import type { ObjectDef } from './types';
import { PALETTES } from './materials';
import { ball, box, cone, cyl, hull } from './shapes';

function fragile(
  id: string,
  name: string,
  icon: string,
  parts: NonNullable<ObjectDef['parts']>,
  extra: {
    threshold?: number;
    hp?: number;
    fragments?: number;
    colors?: readonly string[];
    material?: ObjectDef['material'];
    tags?: string[];
    releaseFluid?: boolean;
  } = {},
): ObjectDef {
  const colors = [...(extra.colors ?? PALETTES.glass)];
  return {
    id,
    name,
    icon,
    category: 'fragile',
    kind: 'rigid',
    material: extra.material ?? 'glass',
    colors,
    parts,
    tags: ['fragile', 'breakable', ...(extra.tags ?? [])],
    description: `${name}. Shatters on hard impacts.`,
    behaviors: {
      destructible: {
        hp: extra.hp ?? 70,
        impactThreshold: extra.threshold ?? 34,
        fragments: extra.fragments ?? 9,
        fragmentColors: [...colors],
        releaseFluid: extra.releaseFluid ? { count: 16, radius: 0.1, speed: 2 } : undefined,
      },
    },
  };
}

export const FRAGILE: ObjectDef[] = [
  fragile(
    'wine-glass',
    'Wine Glass',
    '🍷',
    [
      cyl(0.075, 0.012, { pos: [0, 0.006, 0] }),
      cyl(0.018, 0.16, { pos: [0, 0.09, 0] }),
      ball(0.085, { pos: [0, 0.24, 0] }),
      cyl(0.085, 0.1, { pos: [0, 0.22, 0], color: '#cfeef7' }),
    ],
    { threshold: 20, fragments: 11, tags: ['small', 'glass'] },
  ),
  fragile(
    'tumbler',
    'Glass Tumbler',
    '🥛',
    [cyl(0.085, 0.17, { pos: [0, 0.085, 0] }), cyl(0.078, 0.02, { pos: [0, 0.16, 0], color: '#e8f6fa' })],
    { threshold: 24, fragments: 9, tags: ['small', 'glass'] },
  ),
  fragile(
    'mug-glass',
    'Glass Mug',
    '☕',
    [cyl(0.09, 0.15, { pos: [0, 0.075, 0] }), box(0.03, 0.1, 0.06, { pos: [0.11, 0.075, 0] })],
    { threshold: 26, fragments: 9, tags: ['small', 'glass'] },
  ),
  fragile(
    'vase',
    'Vase',
    '🏺',
    [
      cyl(0.12, 0.3, { pos: [0, 0.15, 0] }),
      cyl(0.17, 0.16, { pos: [0, 0.36, 0] }),
      cyl(0.08, 0.08, { pos: [0, 0.48, 0] }),
    ],
    { colors: ['#5f8fbf', '#8f6fbf', '#bf6f7f'], threshold: 30, fragments: 12, tags: ['ceramic'], material: 'ceramic' },
  ),
  fragile(
    'mirror',
    'Mirror',
    '🪞',
    [
      box(0.9, 1.4, 0.06, { pos: [0, 0.7, 0], color: '#cfd8e0' }),
      box(1, 1.5, 0.04, { pos: [0, 0.75, -0.03], color: '#9a6b3f' }),
    ],
    { threshold: 22, fragments: 14, tags: ['glass', 'flat'] },
  ),
  fragile(
    'window',
    'Window',
    '🪟',
    [
      box(1.5, 0.08, 0.08, { pos: [0, 1.6, 0], color: '#ece7dc', material: 'wood' }),
      box(1.5, 0.08, 0.08, { pos: [0, 0.08, 0], color: '#ece7dc', material: 'wood' }),
      box(0.08, 1.6, 0.08, { pos: [-0.71, 0.8, 0], color: '#ece7dc', material: 'wood' }),
      box(0.08, 1.6, 0.08, { pos: [0.71, 0.8, 0], color: '#ece7dc', material: 'wood' }),
      box(1.35, 1.45, 0.02, { pos: [0, 0.8, 0] }),
      box(1.35, 0.04, 0.03, { pos: [0, 0.8, 0], color: '#ece7dc' }),
    ],
    { threshold: 18, fragments: 16, tags: ['glass', 'flat', 'large'] },
  ),
  fragile(
    'jar',
    'Glass Jar',
    '🫙',
    [
      cyl(0.11, 0.22, { pos: [0, 0.11, 0] }),
      cyl(0.115, 0.04, { pos: [0, 0.23, 0], material: 'metal', color: '#b9c2cf' }),
    ],
    { threshold: 24, fragments: 8, tags: ['small', 'glass'] },
  ),
  fragile(
    'lightbulb',
    'Light Bulb',
    '💡',
    [
      ball(0.1, { pos: [0, 0.15, 0] }),
      cyl(0.045, 0.08, { pos: [0, 0.02, 0], material: 'metal', color: '#b6bdc7' }),
      cyl(0.025, 0.03, { pos: [0, -0.02, 0], material: 'metal' }),
    ],
    { threshold: 10, hp: 25, fragments: 10, tags: ['small', 'glass'] },
  ),
  fragile(
    'ceramic-plate',
    'Ceramic Plate',
    '🍽️',
    [cyl(0.18, 0.025, { pos: [0, 0.015, 0] })],
    { threshold: 18, fragments: 8, material: 'ceramic', colors: PALETTES.ceramic, tags: ['small', 'ceramic'] },
  ),
  fragile(
    'crystal',
    'Crystal',
    '💎',
    [
      hull([
        0, 0.34, 0, 0.13, 0.06, 0, 0, 0.06, 0.13, -0.13, 0.06, 0, 0, 0.06, -0.13, 0, -0.1, 0,
        0.13, 0.06, 0, 0, 0.06, -0.13, -0.13, 0.06, 0, 0, 0.06, 0.13, 0, 0.34, 0, 0, -0.1, 0,
      ], { pos: [0, 0.12, 0] }),
    ],
    { colors: ['#8fe3ff', '#c59bff', '#9fffd0'], threshold: 14, fragments: 10, tags: ['glass'] },
  ),
  fragile(
    'fishbowl',
    'Fish Bowl',
    '🐠',
    [ball(0.24, { pos: [0, 0.24, 0] }), cyl(0.2, 0.05, { pos: [0, 0.025, 0] })],
    { threshold: 18, fragments: 16, tags: ['glass', 'round'] },
  ),
  fragile(
    'champagne-flute',
    'Champagne Flute',
    '🥂',
    [
      cyl(0.05, 0.01, { pos: [0, 0.005, 0] }),
      cyl(0.012, 0.18, { pos: [0, 0.1, 0] }),
      cyl(0.055, 0.22, { pos: [0, 0.29, 0] }),
    ],
    { threshold: 12, fragments: 10, tags: ['small', 'glass'] },
  ),
  fragile(
    'tv-screen',
    'Cracked TV Screen',
    '📺',
    [
      box(1.1, 0.66, 0.1, { pos: [0, 0.33, 0], color: '#20262e' }),
      box(1, 0.55, 0.03, { pos: [0, 0.34, 0.06], color: '#3f6f86' }),
    ],
    { threshold: 20, fragments: 14, tags: ['flat', 'glass'], colors: ['#3f6f86'] },
  ),
  fragile(
    'glass-bottle',
    'Glass Bottle',
    '🍶',
    [
      cyl(0.08, 0.26, { pos: [0, 0.13, 0] }),
      cyl(0.035, 0.16, { pos: [0, 0.33, 0] }),
      cyl(0.04, 0.03, { pos: [0, 0.42, 0], material: 'metal' }),
    ],
    { threshold: 20, fragments: 10, tags: ['glass'] },
  ),
  fragile(
    'glass-cube',
    'Glass Cube',
    '🧊',
    [box(0.42, 0.42, 0.42, { pos: [0, 0.21, 0] })],
    { threshold: 16, fragments: 12, tags: ['glass'] },
  ),
  fragile(
    'terracotta-pot',
    'Terracotta Pot',
    '🏺',
    [cyl(0.16, 0.24, { pos: [0, 0.12, 0] }), cyl(0.18, 0.05, { pos: [0, 0.24, 0] })],
    {
      colors: ['#b7643c', '#a05432'],
      material: 'ceramic',
      threshold: 26,
      fragments: 9,
      tags: ['ceramic'],
    },
  ),
  fragile(
    'porcelain-doll',
    'Porcelain Doll',
    '🎎',
    [
      box(0.2, 0.3, 0.14, { pos: [0, 0.3, 0], color: '#f4f1ea' }),
      ball(0.11, { pos: [0, 0.55, 0], color: '#f4f1ea' }),
      cyl(0.03, 0.25, { pos: [-0.14, 0.32, 0], rot: [0, 0, 0.25] }),
      cyl(0.03, 0.25, { pos: [0.14, 0.32, 0], rot: [0, 0, -0.25] }),
      cone(0.18, 0.28, { pos: [0, 0.14, 0], color: '#c8586f' }),
    ],
    { colors: ['#f4f1ea'], material: 'ceramic', threshold: 18, fragments: 12, tags: ['toy'] },
  ),
  fragile(
    'glass-shelf',
    'Glass Shelf',
    '🗄️',
    [
      box(1.2, 0.04, 0.4, { pos: [0, 0.75, 0] }),
      box(1.2, 0.04, 0.4, { pos: [0, 0.4, 0] }),
      box(0.05, 0.8, 0.4, { pos: [-0.58, 0.4, 0], color: '#b9c2cf', material: 'metal' }),
      box(0.05, 0.8, 0.4, { pos: [0.58, 0.4, 0], color: '#b9c2cf', material: 'metal' }),
    ],
    { threshold: 16, fragments: 16 },
  ),
];

