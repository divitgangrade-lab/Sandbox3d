/** Jointed crash-test bodies. The builder creates 11 bodies and spherical joints. */

import type { ObjectDef } from './types';
import { PALETTES } from './materials';

interface DummyOptions {
  height?: number;
  limb?: number;
  head?: 'sphere' | 'box';
  headColor?: string;
  colors?: readonly string[];
  icon: string;
  description?: string;
  tags?: string[];
}

function dummy(id: string, name: string, o: DummyOptions): ObjectDef {
  return {
    id,
    name,
    icon: o.icon,
    category: 'ragdolls',
    kind: 'ragdoll',
    material: 'flesh',
    colors: [...(o.colors ?? PALETTES.flesh)],
    tags: ['ragdoll', 'humanoid', 'dummy', ...(o.tags ?? [])],
    description: o.description ?? `${name} — 11 jointed limbs, ready for abuse`,
    ragdoll: {
      height: o.height ?? 1.72,
      limbScale: o.limb ?? 1,
      head: o.head ?? 'sphere',
      headColor: o.headColor,
    },
    parts: [{ shape: { kind: 'sphere', r: 0.15 } }],
  };
}

export const RAGDOLLS: ObjectDef[] = [
  dummy('crash-dummy', 'Crash Dummy', {
    icon: '🧍',
    colors: ['#e8b24a', '#d99f34'],
    headColor: '#e8b24a',
    description: 'Bright yellow, highly smashable',
  }),
  dummy('test-dummy', 'Test Dummy', {
    icon: '🧑‍🔬',
    colors: ['#d9c7a8', '#c2ad8d'],
    description: 'A plain humanoid dummy',
  }),
  dummy('melon-man', 'Melon Man', {
    icon: '🍉',
    colors: ['#5b8f45', '#4a7a39'],
    headColor: '#3f8f3a',
    head: 'sphere',
    height: 1.66,
    limb: 0.92,
    description: 'His head is a watermelon. It is not attached well.',
    tags: ['funny'],
  }),
  dummy('zombie', 'Zombie', {
    icon: '🧟',
    colors: ['#7f9a6d', '#6b855b'],
    headColor: '#8aa878',
    height: 1.78,
    limb: 0.9,
    description: 'Shambling, jointed and surprisingly durable',
  }),
  dummy('skeleton', 'Skeleton', {
    icon: '💀',
    colors: ['#e6e1d3', '#cfc9b8'],
    headColor: '#f2eee4',
    height: 1.74,
    limb: 0.7,
    description: 'All bones, no meat',
    tags: ['spooky'],
  }),
  dummy('robot', 'Robot', {
    icon: '🤖',
    colors: ['#9aa7b8', '#7e8b9c'],
    head: 'box',
    headColor: '#b7c3d2',
    height: 1.85,
    limb: 1.15,
    description: 'A heavy metal test frame',
    tags: ['metal'],
  }),
  dummy('ninja', 'Ninja', {
    icon: '🥷',
    colors: ['#2e3440', '#3b4252'],
    headColor: '#1f242c',
    height: 1.7,
    limb: 0.95,
    description: 'Stealthy until it hits the ground',
  }),
  dummy('clown', 'Clown', {
    icon: '🤡',
    colors: ['#f2f2f2', '#e8e8e8'],
    headColor: '#fff1f1',
    height: 1.62,
    limb: 1.05,
    description: 'Honking is not implemented',
    tags: ['funny'],
  }),
  dummy('knight', 'Knight', {
    icon: '🛡️',
    colors: ['#aeb6c1', '#8f98a5'],
    head: 'box',
    headColor: '#c9d2dd',
    height: 1.8,
    limb: 1.1,
    description: 'Armoured, not protected',
    tags: ['metal'],
  }),
  dummy('prisoner', 'Prisoner', {
    icon: '🧑‍🦱',
    colors: ['#e4a94a', '#d49a3c'],
    headColor: '#d9a06a',
    height: 1.72,
    description: 'Striped and doomed',
  }),
];
