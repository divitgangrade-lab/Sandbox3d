import type { CSSProperties, ReactElement } from 'react';

export type ParticleTextHighlightMode = 'motion' | 'gradient';
export type ParticleTextShape = 'circle' | 'square' | 'line';
export type ParticleTextIntro = 'gather' | 'rain' | 'spiral' | 'scan';
export type ParticleTextTrigger = 'mount' | 'hover' | 'click';

export interface ParticleTextProps {
  text?: string;
  color?: string;
  highlightColor?: string;
  highlightMode?: ParticleTextHighlightMode;
  shape?: ParticleTextShape;
  intro?: ParticleTextIntro;
  scatter?: number;
  gatherDuration?: number;
  stagger?: number;
  clickBurst?: boolean;
  burstStrength?: number;
  pointerRepel?: number;
  repelRadius?: number;
  idleDrift?: number;
  trigger?: ParticleTextTrigger;
  fontSize?: number | string;
  fontWeight?: number | string;
  fontFamily?: string;
  glow?: boolean;
  particleSize?: number;
  density?: number;
  className?: string;
  style?: CSSProperties;
}

declare function ParticleText(props: ParticleTextProps): ReactElement | null;

export default ParticleText;
