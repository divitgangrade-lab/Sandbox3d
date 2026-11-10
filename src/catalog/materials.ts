/** Physical and visual material presets. Sizes are metres, densities kg/m³. */

export type MaterialName =
  | 'plastic'
  | 'wood'
  | 'metal'
  | 'stone'
  | 'rubber'
  | 'glass'
  | 'flesh'
  | 'ice'
  | 'cloth'
  | 'explosive'
  | 'jelly'
  | 'water'
  | 'ceramic'
  | 'foam'
  | 'concrete'
  | 'gold';

export interface MaterialPreset {
  density: number;
  friction: number;
  restitution: number;
  roughness: number;
  metalness: number;
  opacity?: number;
  emissive?: string;
}

export const MATERIALS: Record<MaterialName, MaterialPreset> = {
  plastic: { density: 420, friction: 0.55, restitution: 0.28, roughness: 0.45, metalness: 0.02 },
  wood: { density: 620, friction: 0.7, restitution: 0.16, roughness: 0.78, metalness: 0 },
  metal: { density: 2100, friction: 0.45, restitution: 0.12, roughness: 0.32, metalness: 0.9 },
  stone: { density: 2350, friction: 0.85, restitution: 0.08, roughness: 0.92, metalness: 0.02 },
  rubber: { density: 900, friction: 0.95, restitution: 0.82, roughness: 0.62, metalness: 0 },
  glass: {
    density: 2450,
    friction: 0.28,
    restitution: 0.06,
    roughness: 0.08,
    metalness: 0.05,
    opacity: 0.44,
  },
  flesh: { density: 980, friction: 0.72, restitution: 0.2, roughness: 0.58, metalness: 0 },
  ice: {
    density: 900,
    friction: 0.06,
    restitution: 0.12,
    roughness: 0.12,
    metalness: 0.05,
    opacity: 0.72,
  },
  cloth: { density: 320, friction: 0.8, restitution: 0.05, roughness: 0.95, metalness: 0 },
  explosive: { density: 780, friction: 0.6, restitution: 0.15, roughness: 0.6, metalness: 0.05 },
  jelly: { density: 1050, friction: 0.5, restitution: 0.55, roughness: 0.25, metalness: 0 },
  water: {
    density: 1000,
    friction: 0.15,
    restitution: 0.05,
    roughness: 0.05,
    metalness: 0.08,
    opacity: 0.66,
  },
  ceramic: { density: 1400, friction: 0.6, restitution: 0.14, roughness: 0.38, metalness: 0.05 },
  foam: { density: 90, friction: 0.6, restitution: 0.45, roughness: 0.9, metalness: 0 },
  concrete: { density: 2400, friction: 0.9, restitution: 0.06, roughness: 0.95, metalness: 0 },
  gold: { density: 5200, friction: 0.4, restitution: 0.18, roughness: 0.22, metalness: 1 },
};

export const DEFAULT_MATERIAL: MaterialName = 'plastic';
export const DEFAULT_COLOR = '#7c8ba1';

export const PALETTES = {
  plastic: ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc', '#26c6da', '#ff7043'],
  wood: ['#b07a4a', '#8d5a34', '#c98e58', '#a0653c', '#d6a775'],
  darkWood: ['#5d3a24', '#70472b', '#4a2d1c', '#8a5a37'],
  metal: ['#b9c2cf', '#8e99a8', '#d4dae3', '#6f7a89', '#a8b4c3'],
  paintedMetal: ['#d94841', '#2f7fbf', '#4a5568', '#e0a72a', '#3c8d5a'],
  stone: ['#8a8d94', '#74777e', '#9a9da4', '#63666d', '#a8a9ad'],
  rubber: ['#262a30', '#3b4048', '#1c1f24', '#4e5560'],
  glass: ['#9fd8e8', '#bfe7f2', '#d9f1f7'],
  flesh: ['#f0a58c', '#e0917a', '#f7bda8', '#d97f68'],
  ice: ['#c9ecf7', '#a8dcef', '#dbf5fb'],
  cloth: ['#d9534f', '#5b8ff9', '#5ad1a0', '#f0c24b', '#9d7bea'],
  explosive: ['#d93a2b', '#c62828', '#e04b3a', '#8e1f1f'],
  jelly: ['#ff4f8b', '#7bff6b', '#4fc3ff', '#ffd166', '#c77dff'],
  water: ['#4cc3f2', '#66d9ef', '#3aa8dd'],
  ceramic: ['#f2efe8', '#e8e2d4', '#ffffff', '#d8d1c2'],
  foam: ['#ff9f1c', '#ffbf69', '#f7f7ff', '#8ecae6'],
  concrete: ['#9a9a94', '#86867f', '#b0b0a8', '#74746d'],
  gold: ['#e6b325', '#f2cd4b', '#c99914'],
  nature: ['#4c9a46', '#3d8b3a', '#6bbf5a', '#2f7a33'],
  melon: ['#3f8f3a', '#4fa843', '#2f7330'],
  flower: ['#ff8fb1', '#ffd166', '#c77dff', '#ff6b6b', '#ffffff'],
  earth: ['#7a5a3a', '#8b6a45', '#5c422c', '#a17b52'],
} as const;

export function materialOf(name: MaterialName | undefined): MaterialPreset {
  return MATERIALS[name ?? DEFAULT_MATERIAL];
}

export function colorOf(colors: readonly string[] | undefined): string {
  return colors && colors.length > 0 ? colors[0] : DEFAULT_COLOR;
}
