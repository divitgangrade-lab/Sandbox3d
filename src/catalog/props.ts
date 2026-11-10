/** Furniture and everyday props. Everything is a compound rigid body. */

import type { ObjectDef } from './types';
import { PALETTES, type MaterialName } from './materials';
import { box, cone, cyl, moved } from './shapes';

interface PropOptions {
  material?: MaterialName;
  colors?: readonly string[];
  partColor?: string;
  tags?: string[];
  description?: string;
}

function prop(
  id: string,
  name: string,
  icon: string,
  parts: NonNullable<ObjectDef['parts']>,
  options: PropOptions = {},
): ObjectDef {
  return {
    id,
    name,
    icon,
    category: 'props',
    kind: 'rigid',
    material: options.material ?? 'wood',
    colors: [...(options.colors ?? PALETTES.wood)],
    parts,
    tags: ['prop', ...(options.tags ?? [])],
    description: options.description ?? `${name}. A solid prop for stacking and throwing.`,
  };
}

function chairParts(w = 0.5, h = 0.46): NonNullable<ObjectDef['parts']> {
  const s = w;
  return [
    box(s, 0.08, s, { pos: [0, h, 0] }),
    box(s, 0.55, 0.07, { pos: [0, h + 0.3, -s / 2 + 0.04] }),
    box(0.06, h, 0.06, { pos: [-s / 2 + 0.06, h / 2, -s / 2 + 0.06] }),
    box(0.06, h, 0.06, { pos: [s / 2 - 0.06, h / 2, -s / 2 + 0.06] }),
    box(0.06, h, 0.06, { pos: [-s / 2 + 0.06, h / 2, s / 2 - 0.06] }),
    box(0.06, h, 0.06, { pos: [s / 2 - 0.06, h / 2, s / 2 - 0.06] }),
  ];
}

function tableParts(w: number, d: number, h: number): NonNullable<ObjectDef['parts']> {
  const inset = 0.12;
  return [
    box(w, 0.08, d, { pos: [0, h, 0] }),
    box(0.08, h, 0.08, { pos: [-w / 2 + inset, h / 2, -d / 2 + inset] }),
    box(0.08, h, 0.08, { pos: [w / 2 - inset, h / 2, -d / 2 + inset] }),
    box(0.08, h, 0.08, { pos: [-w / 2 + inset, h / 2, d / 2 - inset] }),
    box(0.08, h, 0.08, { pos: [w / 2 - inset, h / 2, d / 2 - inset] }),
  ];
}

export const PROPS: ObjectDef[] = [
  prop('chair', 'Chair', '🪑', chairParts()),
  prop('chair-plastic', 'Plastic Chair', '💺', chairParts(0.48, 0.44), {
    material: 'plastic',
    colors: PALETTES.plastic,
  }),
  prop(
    'stool',
    'Stool',
    '🪑',
    [
      cyl(0.24, 0.06, { pos: [0, 0.5, 0] }),
      cyl(0.03, 0.5, { pos: [-0.14, 0.25, -0.1], rot: [0, 0, 0.12] }),
      cyl(0.03, 0.5, { pos: [0.14, 0.25, -0.1], rot: [0, 0, -0.12] }),
      cyl(0.03, 0.5, { pos: [0, 0.25, 0.16] }),
    ],
    { description: 'A three-legged wooden stool' },
  ),
  prop(
    'bar-stool',
    'Bar Stool',
    '🪑',
    [
      cyl(0.24, 0.07, { pos: [0, 0.78, 0] }),
      cyl(0.03, 0.78, { pos: [-0.15, 0.39, -0.09] }),
      cyl(0.03, 0.78, { pos: [0.15, 0.39, -0.09] }),
      cyl(0.03, 0.78, { pos: [0, 0.39, 0.17] }),
      cyl(0.22, 0.03, { pos: [0, 0.3, 0] }),
    ],
    { material: 'metal', colors: PALETTES.paintedMetal, tags: ['tall'] },
  ),
  prop('table', 'Table', '🪵', tableParts(1.4, 0.8, 0.74)),
  prop('coffee-table', 'Coffee Table', '🪵', tableParts(1.1, 0.62, 0.42), {
    material: 'wood',
    colors: PALETTES.darkWood,
  }),
  prop(
    'desk',
    'Office Desk',
    '🗄️',
    [...tableParts(1.5, 0.78, 0.75), box(0.5, 0.45, 0.62, { pos: [0.42, 0.38, 0] })],
    { description: 'A desk with a drawer pedestal' },
  ),
  prop(
    'sofa',
    'Sofa',
    '🛋️',
    [
      box(1.9, 0.34, 0.85, { pos: [0, 0.28, 0] }),
      box(1.9, 0.55, 0.22, { pos: [0, 0.62, -0.33] }),
      box(0.2, 0.46, 0.85, { pos: [-0.85, 0.44, 0] }),
      box(0.2, 0.46, 0.85, { pos: [0.85, 0.44, 0] }),
      box(0.8, 0.16, 0.7, { pos: [-0.42, 0.53, 0.03] }),
      box(0.8, 0.16, 0.7, { pos: [0.42, 0.53, 0.03] }),
    ],
    { material: 'cloth', colors: PALETTES.cloth, tags: ['furniture', 'soft-ish'] },
  ),
  prop(
    'armchair',
    'Armchair',
    '🛋️',
    [
      box(0.95, 0.34, 0.85, { pos: [0, 0.28, 0] }),
      box(0.95, 0.55, 0.2, { pos: [0, 0.62, -0.33] }),
      box(0.16, 0.44, 0.85, { pos: [-0.4, 0.44, 0] }),
      box(0.16, 0.44, 0.85, { pos: [0.4, 0.44, 0] }),
      box(0.62, 0.15, 0.68, { pos: [0, 0.52, 0.03] }),
    ],
    { material: 'cloth', colors: PALETTES.cloth },
  ),
  prop(
    'bed',
    'Bed',
    '🛏️',
    [
      box(1.7, 0.24, 2.2, { pos: [0, 0.24, 0] }),
      box(1.55, 0.22, 2, { pos: [0, 0.47, 0], material: 'cloth' }),
      box(0.6, 0.15, 0.36, { pos: [0, 0.62, -0.78], color: '#f4f1ea', material: 'cloth' }),
    ],
    { description: 'A double bed with a mattress and pillow' },
  ),
  prop(
    'bookshelf',
    'Bookshelf',
    '📚',
    [
      box(1.2, 1.9, 0.05, { pos: [0, 0.95, -0.27] }),
      box(0.05, 1.9, 0.55, { pos: [-0.58, 0.95, 0] }),
      box(0.05, 1.9, 0.55, { pos: [0.58, 0.95, 0] }),
      box(1.15, 0.06, 0.5, { pos: [0, 0.3, 0] }),
      box(1.15, 0.06, 0.5, { pos: [0, 0.85, 0] }),
      box(1.15, 0.06, 0.5, { pos: [0, 1.4, 0] }),
      box(1.15, 0.06, 0.5, { pos: [0, 1.87, 0] }),
    ],
    { material: 'wood', colors: PALETTES.darkWood },
  ),
  prop(
    'wardrobe',
    'Wardrobe',
    '🚪',
    [
      box(1.2, 2, 0.6, { pos: [0, 1, 0] }),
      box(0.55, 1.9, 0.04, { pos: [-0.29, 1, 0.31], color: '#6f472b' }),
      box(0.55, 1.9, 0.04, { pos: [0.29, 1, 0.31], color: '#6f472b' }),
      box(0.03, 0.18, 0.03, { pos: [-0.06, 1, 0.35], material: 'metal' }),
      box(0.03, 0.18, 0.03, { pos: [0.06, 1, 0.35], material: 'metal' }),
    ],
    { material: 'wood', colors: PALETTES.wood, tags: ['heavy', 'tall'] },
  ),
  prop(
    'tv',
    'Television',
    '📺',
    [
      box(1.15, 0.68, 0.09, { pos: [0, 0.34, 0] }),
      box(1.02, 0.56, 0.02, { pos: [0, 0.35, 0.06], color: '#1a2633', material: 'glass' }),
      box(0.3, 0.04, 0.2, { pos: [0, 0.02, 0], material: 'metal' }),
    ],
    { material: 'plastic', colors: ['#252b33', '#343b45'], tags: ['fragile'], description: 'A flat-screen TV' },
  ),
  prop(
    'fridge',
    'Fridge',
    '🧊',
    [
      box(0.82, 1.85, 0.7, { pos: [0, 0.93, 0] }),
      box(0.04, 0.5, 0.04, { pos: [0.32, 1.25, 0.36], material: 'metal' }),
      box(0.04, 0.3, 0.04, { pos: [0.32, 0.65, 0.36], material: 'metal' }),
      box(0.78, 0.02, 0.02, { pos: [0, 1.45, 0.36], color: '#aeb6c1' }),
    ],
    { material: 'metal', colors: ['#e6e9ee', '#cfd5dd', '#a9b4c2'], tags: ['heavy', 'tall'] },
  ),
  prop('crate', 'Crate', '📦', [
    box(0.8, 0.8, 0.8, { pos: [0, 0.4, 0] }),
    box(0.86, 0.08, 0.08, { pos: [0, 0.06, -0.4] }),
    box(0.86, 0.08, 0.08, { pos: [0, 0.74, -0.4] }),
    box(0.86, 0.08, 0.08, { pos: [0, 0.06, 0.4] }),
    box(0.86, 0.08, 0.08, { pos: [0, 0.74, 0.4] }),
  ]),
  prop('crate-small', 'Small Crate', '📦', [box(0.5, 0.5, 0.5, { pos: [0, 0.25, 0] })], {
    material: 'wood',
    colors: PALETTES.wood,
  }),
  prop(
    'barrel',
    'Wooden Barrel',
    '🛢️',
    [
      cyl(0.32, 0.9, { pos: [0, 0.45, 0] }),
      cyl(0.335, 0.05, { pos: [0, 0.2, 0], material: 'metal' }),
      cyl(0.335, 0.05, { pos: [0, 0.7, 0], material: 'metal' }),
    ],
    { material: 'wood', colors: PALETTES.darkWood, tags: ['round'] },
  ),
  prop(
    'barrel-metal',
    'Steel Barrel',
    '🛢️',
    [cyl(0.32, 0.9, { pos: [0, 0.45, 0] }), cyl(0.34, 0.04, { pos: [0, 0.45, 0], color: '#5d6672' })],
    { material: 'metal', colors: PALETTES.paintedMetal, tags: ['round'] },
  ),
  prop('bucket', 'Bucket', '🪣', [
    cyl(0.26, 0.36, { pos: [0, 0.18, 0] }),
    cyl(0.275, 0.03, { pos: [0, 0.35, 0], color: '#4e5560' }),
  ], { material: 'plastic', colors: PALETTES.plastic }),
  prop(
    'toolbox',
    'Toolbox',
    '🧰',
    [
      box(0.62, 0.3, 0.32, { pos: [0, 0.15, 0] }),
      box(0.3, 0.04, 0.05, { pos: [0, 0.38, 0], material: 'metal' }),
      box(0.04, 0.12, 0.04, { pos: [-0.13, 0.33, 0], material: 'metal' }),
      box(0.04, 0.12, 0.04, { pos: [0.13, 0.33, 0], material: 'metal' }),
    ],
    { material: 'metal', colors: PALETTES.paintedMetal },
  ),
  prop(
    'mug',
    'Mug',
    '☕',
    [cyl(0.09, 0.14, { pos: [0, 0.07, 0] }), box(0.03, 0.1, 0.06, { pos: [0.11, 0.07, 0] })],
    { material: 'ceramic', colors: PALETTES.ceramic, tags: ['small', 'fragile'] },
  ),
  prop('plate', 'Plate', '🍽️', [cyl(0.17, 0.025, { pos: [0, 0.015, 0] })], {
    material: 'ceramic',
    colors: PALETTES.ceramic,
    tags: ['small', 'fragile'],
  }),
  prop(
    'pan',
    'Frying Pan',
    '🍳',
    [
      cyl(0.2, 0.05, { pos: [0, 0.035, 0] }),
      box(0.32, 0.04, 0.06, { pos: [0.32, 0.05, 0] }),
      box(0.03, 0.06, 0.04, { pos: [0.46, 0.05, 0], color: '#22262c' }),
    ],
    { material: 'metal', colors: ['#3a3f46', '#4b515a'] },
  ),
  prop(
    'pot',
    'Cooking Pot',
    '🍲',
    [
      cyl(0.2, 0.24, { pos: [0, 0.12, 0] }),
      box(0.08, 0.04, 0.03, { pos: [-0.22, 0.18, 0] }),
      box(0.08, 0.04, 0.03, { pos: [0.22, 0.18, 0] }),
    ],
    { material: 'metal', colors: PALETTES.metal },
  ),
  prop(
    'bottle',
    'Bottle',
    '🍾',
    [
      cyl(0.07, 0.24, { pos: [0, 0.12, 0] }),
      cyl(0.035, 0.14, { pos: [0, 0.31, 0] }),
      cyl(0.038, 0.03, { pos: [0, 0.39, 0], material: 'metal' }),
    ],
    { material: 'glass', colors: ['#3f7f45', '#2f5f37'] },
  ),
  prop(
    'toaster',
    'Toaster',
    '🍞',
    [
      box(0.34, 0.22, 0.22, { pos: [0, 0.11, 0] }),
      box(0.3, 0.015, 0.04, { pos: [0, 0.225, 0], color: '#20242a' }),
      box(0.3, 0.015, 0.04, { pos: [0, 0.225, 0.08], color: '#20242a' }),
    ],
    { material: 'metal', colors: PALETTES.metal },
  ),
  prop(
    'microwave',
    'Microwave',
    '📡',
    [
      box(0.62, 0.42, 0.42, { pos: [0, 0.21, 0] }),
      box(0.38, 0.28, 0.02, { pos: [-0.08, 0.22, 0.22], color: '#26303b' }),
      box(0.04, 0.3, 0.03, { pos: [0.25, 0.21, 0.22] }),
    ],
    { material: 'metal', colors: ['#d7dbe0', '#b8bec7'] },
  ),
  prop(
    'traffic-cone',
    'Traffic Cone',
    '🚧',
    [
      cone(0.19, 0.6, { pos: [0, 0.3, 0] }),
      box(0.42, 0.05, 0.42, { pos: [0, 0.025, 0] }),
      cyl(0.13, 0.12, { pos: [0, 0.32, 0], color: '#f5f0e6' }),
    ],
    { material: 'plastic', colors: ['#ef6c2f', '#f4511e'] },
  ),
  prop(
    'traffic-barrier',
    'Traffic Barrier',
    '🚧',
    [
      box(1.3, 0.32, 0.08, { pos: [0, 0.6, 0] }),
      box(0.1, 0.6, 0.5, { pos: [-0.55, 0.3, 0] }),
      box(0.1, 0.6, 0.5, { pos: [0.55, 0.3, 0] }),
      box(1.3, 0.06, 0.4, { pos: [0, 0.03, 0] }),
    ],
    { material: 'plastic', colors: ['#e83b2e', '#f5f0e6'] },
  ),
  prop(
    'sign',
    'Sign',
    '🪧',
    [
      cyl(0.05, 1.5, { pos: [0, 0.75, 0] }),
      box(0.75, 0.5, 0.06, { pos: [0, 1.26, 0], color: '#f1f1ec' }),
      box(0.62, 0.37, 0.02, { pos: [0, 1.26, 0.04], color: '#e6392f' }),
    ],
    { material: 'wood', colors: PALETTES.wood },
  ),
  prop(
    'fence',
    'Wooden Fence',
    '🪵',
    [
      box(1.8, 0.08, 0.05, { pos: [0, 0.5, 0] }),
      box(1.8, 0.08, 0.05, { pos: [0, 0.9, 0] }),
      box(0.09, 1.1, 0.09, { pos: [-0.82, 0.55, 0] }),
      box(0.09, 1.1, 0.09, { pos: [0.82, 0.55, 0] }),
      box(0.08, 1, 0.08, { pos: [0, 0.5, 0] }),
    ],
    { material: 'wood', colors: PALETTES.darkWood },
  ),
  prop(
    'bench',
    'Bench',
    '🪑',
    [
      box(1.5, 0.08, 0.45, { pos: [0, 0.46, 0] }),
      box(1.5, 0.42, 0.06, { pos: [0, 0.7, -0.21] }),
      box(0.08, 0.46, 0.4, { pos: [-0.65, 0.23, 0] }),
      box(0.08, 0.46, 0.4, { pos: [0.65, 0.23, 0] }),
    ],
    { material: 'wood', colors: PALETTES.wood },
  ),
  prop(
    'trash-can',
    'Trash Can',
    '🗑️',
    [
      cyl(0.27, 0.7, { pos: [0, 0.35, 0] }),
      cyl(0.285, 0.05, { pos: [0, 0.72, 0] }),
      box(0.18, 0.04, 0.04, { pos: [0, 0.78, 0], material: 'metal' }),
    ],
    { material: 'metal', colors: ['#626b75', '#4f5862'] },
  ),
  prop(
    'bathtub',
    'Bathtub',
    '🛁',
    [
      box(1.6, 0.48, 0.78, { pos: [0, 0.24, 0] }),
      box(1.7, 0.08, 0.88, { pos: [0, 0.5, 0] }),
      box(1.4, 0.06, 0.6, { pos: [0, 0.51, 0] }),
      cyl(0.04, 0.3, { pos: [-0.6, 0.64, 0], material: 'metal' }),
    ],
    { material: 'ceramic', colors: ['#f5f3ed', '#eae6dc'], tags: ['heavy'] },
  ),
  prop(
    'toilet',
    'Toilet',
    '🚽',
    [
      box(0.42, 0.4, 0.55, { pos: [0, 0.2, 0] }),
      cyl(0.25, 0.1, { pos: [0, 0.44, 0.03] }),
      box(0.48, 0.5, 0.2, { pos: [0, 0.55, -0.26] }),
      box(0.4, 0.04, 0.04, { pos: [0, 0.65, -0.15] }),
    ],
    { material: 'ceramic', colors: ['#f7f5f0', '#e8e4da'], tags: ['fragile'] },
  ),
  prop(
    'washing-machine',
    'Washing Machine',
    '🧺',
    [
      box(0.68, 0.85, 0.68, { pos: [0, 0.43, 0] }),
      moved(cyl(0.21, 0.04), [0, 0.44, 0.36], [Math.PI / 2, 0, 0]),
      box(0.68, 0.06, 0.68, { pos: [0, 0.06, 0] }),
      box(0.3, 0.08, 0.03, { pos: [0, 0.82, 0.3], color: '#202733' }),
    ],
    { material: 'metal', colors: ['#e2e5ea', '#c3c8d1'], tags: ['heavy'] },
  ),
  prop(
    'piano',
    'Piano',
    '🎹',
    [
      box(1.5, 1.05, 0.55, { pos: [0, 0.55, 0] }),
      box(1.2, 0.07, 0.28, { pos: [0, 0.77, 0.36], color: '#f2efe7' }),
      box(1.25, 0.08, 0.06, { pos: [0, 0.72, 0.5], color: '#20242b' }),
      box(0.1, 0.4, 0.1, { pos: [-0.6, 0.2, -0.15] }),
      box(0.1, 0.4, 0.1, { pos: [0.6, 0.2, -0.15] }),
    ],
    { material: 'wood', colors: ['#2c2520', '#41342b'], tags: ['heavy'] },
  ),
  prop(
    'safe',
    'Safe',
    '🔒',
    [
      box(0.66, 0.7, 0.62, { pos: [0, 0.35, 0] }),
      cyl(0.09, 0.04, { pos: [0.12, 0.38, 0.33], rot: [Math.PI / 2, 0, 0], material: 'metal' }),
      box(0.28, 0.05, 0.04, { pos: [-0.12, 0.38, 0.33], material: 'metal' }),
    ],
    { material: 'metal', colors: ['#3c4652', '#2b333d'], tags: ['heavy'] },
  ),
  prop(
    'fire-extinguisher',
    'Fire Extinguisher',
    '🧯',
    [
      cyl(0.12, 0.52, { pos: [0, 0.26, 0] }),
      cyl(0.05, 0.1, { pos: [0, 0.57, 0], material: 'metal' }),
      box(0.16, 0.04, 0.06, { pos: [0.1, 0.62, 0], color: '#20242b' }),
    ],
    { material: 'metal', colors: ['#c4312a', '#a52822'] },
  ),
  prop(
    'mailbox',
    'Mailbox',
    '📬',
    [
      box(0.08, 1, 0.08, { pos: [0, 0.5, 0] }),
      box(0.42, 0.3, 0.5, { pos: [0, 1.15, 0] }),
      box(0.02, 0.2, 0.04, { pos: [0.22, 1.22, 0.1], color: '#e6392f' }),
    ],
    { material: 'metal', colors: PALETTES.paintedMetal },
  ),
  prop(
    'vending-machine',
    'Vending Machine',
    '🥤',
    [
      box(1.05, 1.9, 0.8, { pos: [0, 0.95, 0] }),
      box(0.6, 1.2, 0.03, { pos: [-0.16, 1.03, 0.41], color: '#273240', material: 'glass' }),
      box(0.75, 0.16, 0.03, { pos: [-0.08, 0.3, 0.41], color: '#161c24' }),
      box(0.18, 0.3, 0.03, { pos: [0.32, 1.25, 0.41], color: '#202733' }),
    ],
    { material: 'metal', colors: ['#d94b41', '#2d5da8'], tags: ['heavy', 'tall'] },
  ),
  prop(
    'lamp',
    'Table Lamp',
    '💡',
    [
      cyl(0.16, 0.05, { pos: [0, 0.025, 0] }),
      cyl(0.026, 0.62, { pos: [0, 0.33, 0] }),
      cone(0.24, 0.3, { pos: [0, 0.76, 0], color: '#f3e2b4' }),
    ],
    { material: 'metal', colors: PALETTES.paintedMetal, tags: ['fragile'] },
  ),
  prop(
    'floor-lamp',
    'Floor Lamp',
    '🛋️',
    [
      cyl(0.2, 0.04, { pos: [0, 0.02, 0] }),
      cyl(0.022, 1.55, { pos: [0, 0.8, 0] }),
      cone(0.28, 0.38, { pos: [0, 1.65, 0], color: '#f3e2b4' }),
    ],
    { material: 'metal', colors: ['#3b414a', '#5a626d'], tags: ['tall'] },
  ),
];
