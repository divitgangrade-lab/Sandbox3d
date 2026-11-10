/** Wheeled vehicles: a compound chassis plus revolute-jointed wheels and motors. */

import type { ObjectDef, WheelSpec } from './types';
import { box, cyl, moved } from './shapes';

interface CarOptions {
  body: [number, number, number];
  bodyY?: number;
  cabin?: [number, number, number];
  cabinZ?: number;
  wheels: WheelSpec[];
  maxSpeed: number;
  motorForce: number;
  colors: readonly string[];
  icon: string;
  extraParts?: NonNullable<ObjectDef['parts']>;
  material?: ObjectDef['material'];
  description?: string;
  wheelColor?: string;
  tags?: string[];
}

function car(id: string, name: string, o: CarOptions): ObjectDef {
  const bodyY = o.bodyY ?? 0;
  const parts: NonNullable<ObjectDef['parts']> = [
    box(o.body[0], o.body[1], o.body[2], { pos: [0, bodyY, 0] }),
    ...(o.cabin
      ? [
          box(o.cabin[0], o.cabin[1], o.cabin[2], {
            pos: [0, bodyY + o.body[1] / 2 + o.cabin[1] / 2 - 0.04, o.cabinZ ?? 0],
            color: '#8fc7db',
            material: 'glass',
          }),
        ]
      : []),
    ...(o.extraParts ?? []),
  ];
  return {
    id,
    name,
    icon: o.icon,
    category: 'vehicles',
    kind: 'vehicle',
    material: o.material ?? 'metal',
    colors: [...o.colors],
    parts,
    tags: ['vehicle', 'drive', ...(o.tags ?? [])],
    description: o.description ?? `${name}. Grab it, or press F to start the engine.`,
    vehicle: {
      wheels: o.wheels,
      maxSpeed: o.maxSpeed,
      motorForce: o.motorForce,
      wheelColor: o.wheelColor ?? '#1d2026',
    },
  };
}

const wheel = (x: number, z: number, radius: number, width: number): WheelSpec => ({
  pos: [x, 0, z],
  radius,
  width,
});

export const VEHICLES: ObjectDef[] = [
  car('sedan', 'Sedan', {
    body: [1.8, 0.6, 4],
    bodyY: 0.1,
    cabin: [1.62, 0.52, 1.9],
    cabinZ: -0.15,
    wheels: [wheel(-0.88, 1.32, 0.34, 0.24), wheel(0.88, 1.32, 0.34, 0.24), wheel(-0.88, -1.32, 0.34, 0.24), wheel(0.88, -1.32, 0.34, 0.24)],
    maxSpeed: 22,
    motorForce: 26,
    colors: ['#c8433b', '#2f6fb5', '#e6e9ee', '#2d323a'],
    icon: '🚗',
    extraParts: [
      box(1.5, 0.14, 0.1, { pos: [0, 0.32, 2.01], color: '#f2e7c4' }),
      box(1.5, 0.12, 0.08, { pos: [0, 0.3, -2.01], color: '#b83a32' }),
    ],
    description: 'A four-door sedan with working wheels',
  }),
  car('sports-car', 'Sports Car', {
    body: [1.85, 0.46, 4.2],
    bodyY: 0.02,
    cabin: [1.5, 0.4, 1.5],
    cabinZ: -0.3,
    wheels: [wheel(-0.9, 1.38, 0.35, 0.28), wheel(0.9, 1.38, 0.35, 0.28), wheel(-0.9, -1.4, 0.38, 0.32), wheel(0.9, -1.4, 0.38, 0.32)],
    maxSpeed: 32,
    motorForce: 34,
    colors: ['#f2c230', '#d63b3b', '#2b2f36', '#e8e8e8'],
    icon: '🏎️',
    extraParts: [box(1.7, 0.08, 0.6, { pos: [0, 0.3, -2.1], color: '#20242a' })],
    description: 'Low, fast and slightly ridiculous',
  }),
  car('truck', 'Pickup Truck', {
    body: [2.1, 0.65, 5],
    bodyY: 0.1,
    cabin: [1.9, 0.65, 1.8],
    cabinZ: 0.7,
    wheels: [wheel(-1.02, 1.75, 0.42, 0.3), wheel(1.02, 1.75, 0.42, 0.3), wheel(-1.02, -1.7, 0.42, 0.3), wheel(1.02, -1.7, 0.42, 0.3)],
    maxSpeed: 20,
    motorForce: 38,
    colors: ['#3f7a4e', '#b23a31', '#33506f', '#c9c9c0'],
    icon: '🛻',
    extraParts: [box(1.9, 0.3, 2.1, { pos: [0, 0.55, -1.35], color: '#30363d' })],
    description: 'A pickup with a cargo bed',
  }),
  car('bus', 'City Bus', {
    body: [2.4, 1.4, 7.4],
    bodyY: 0.45,
    wheels: [wheel(-1.12, 2.4, 0.5, 0.34), wheel(1.12, 2.4, 0.5, 0.34), wheel(-1.12, -2.4, 0.5, 0.34), wheel(1.12, -2.4, 0.5, 0.34)],
    maxSpeed: 16,
    motorForce: 48,
    colors: ['#e0a72a', '#3f7a4e', '#c8433b'],
    icon: '🚌',
    extraParts: [
      box(2.42, 0.6, 6.8, { pos: [0, 0.92, 0], color: '#33465a' }),
      box(0.12, 0.7, 6.4, { pos: [1.23, 0.9, 0], color: '#92c6dd', material: 'glass' }),
      box(0.12, 0.7, 6.4, { pos: [-1.23, 0.9, 0], color: '#92c6dd', material: 'glass' }),
    ],
    description: 'A long city bus. Good luck steering this.',
  }),
  car('van', 'Van', {
    body: [2, 1.3, 4.8],
    bodyY: 0.3,
    wheels: [wheel(-0.95, 1.6, 0.38, 0.28), wheel(0.95, 1.6, 0.38, 0.28), wheel(-0.95, -1.6, 0.38, 0.28), wheel(0.95, -1.6, 0.38, 0.28)],
    maxSpeed: 18,
    motorForce: 32,
    colors: ['#e5e7ea', '#b9c2cf', '#5c7fa4'],
    icon: '🚐',
    extraParts: [box(1.6, 0.6, 0.08, { pos: [0, 0.6, 1.95], color: '#8fc7db', material: 'glass' })],
    description: 'A boxy delivery van',
  }),
  car('jeep', 'Jeep', {
    body: [1.9, 0.65, 3.9],
    bodyY: 0.1,
    wheels: [wheel(-0.95, 1.35, 0.45, 0.32), wheel(0.95, 1.35, 0.45, 0.32), wheel(-0.95, -1.3, 0.45, 0.32), wheel(0.95, -1.3, 0.45, 0.32)],
    maxSpeed: 20,
    motorForce: 36,
    colors: ['#5f7a3a', '#9a7a3a', '#4b5c3a'],
    icon: '🚙',
    extraParts: [
      box(1.8, 0.06, 1.4, { pos: [0, 0.75, -0.5] }),
      box(1.8, 0.06, 0.12, { pos: [0, 0.48, 1.9], color: '#30363d' }),
    ],
    description: 'Rugged off-road chassis with big wheels',
  }),
  car('go-kart', 'Go-Kart', {
    body: [1.1, 0.24, 2.1],
    bodyY: -0.02,
    wheels: [wheel(-0.62, 0.75, 0.22, 0.2), wheel(0.62, 0.75, 0.22, 0.2), wheel(-0.62, -0.72, 0.25, 0.24), wheel(0.62, -0.72, 0.25, 0.24)],
    maxSpeed: 26,
    motorForce: 18,
    colors: ['#e05a2b', '#2f6fb5', '#f2c230'],
    icon: '🏁',
    extraParts: [
      box(0.55, 0.5, 0.5, { pos: [0, 0.28, -0.2], color: '#2c3038' }),
      box(0.9, 0.06, 0.35, { pos: [0, 0.28, 0.75], color: '#2c3038' }),
      box(0.08, 0.5, 0.08, { pos: [0, 0.7, -0.9], color: '#2c3038' }),
      box(0.5, 0.06, 0.08, { pos: [0, 0.92, -0.9], color: '#e8433a' }),
    ],
    description: 'A tiny, twitchy go-kart',
  }),
  car('monster-truck', 'Monster Truck', {
    body: [2.2, 0.8, 4.4],
    bodyY: 0.65,
    wheels: [wheel(-1.15, 1.45, 0.75, 0.5), wheel(1.15, 1.45, 0.75, 0.5), wheel(-1.15, -1.4, 0.75, 0.5), wheel(1.15, -1.4, 0.75, 0.5)],
    maxSpeed: 14,
    motorForce: 70,
    colors: ['#8f3fd6', '#3fb56a', '#d63f3f'],
    icon: '🚚',
    extraParts: [
      box(2, 0.55, 1.8, { pos: [0, 1.3, 0.25], color: '#455062' }),
      box(0.1, 0.1, 4, { pos: [1.05, 1.2, 0], color: '#2c3038' }),
      box(0.1, 0.1, 4, { pos: [-1.05, 1.2, 0], color: '#2c3038' }),
    ],
    description: 'Huge tires, huge torque, no subtlety',
  }),
  car('tank', 'Tank', {
    body: [2.3, 0.8, 5.2],
    bodyY: 0.2,
    wheels: [wheel(-1.15, 1.8, 0.5, 0.58), wheel(1.15, 1.8, 0.5, 0.58), wheel(-1.15, -1.8, 0.5, 0.58), wheel(1.15, -1.8, 0.5, 0.58)],
    maxSpeed: 12,
    motorForce: 80,
    colors: ['#6b7a4a', '#57613b', '#8a8f6a'],
    icon: '🛡️',
    extraParts: [
      box(1.7, 0.7, 2.1, { pos: [0, 1.05, 0.1] }),
      moved(cyl(0.09, 2, { pos: [0, 1.15, 1.6] }), [0, 1.15, 1.6], [Math.PI / 2, 0, 0]),
      box(0.4, 0.05, 0.05, { pos: [0.6, 1.3, -0.2], color: '#3a3f33' }),
    ],
    description: 'A tank hull with turret and gun barrel',
    tags: ['heavy', 'armored'],
  }),
];

