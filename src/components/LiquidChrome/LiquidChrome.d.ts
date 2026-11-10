import type { CSSProperties, ReactElement } from 'react';

export interface LiquidChromeProps {
  color?: string;
  speed?: number;
  amplitude?: number;
  frequencyX?: number;
  frequencyY?: number;
  detail?: number;
  thickness?: number;
  depth?: number;
  roughness?: number;
  exposure?: number;
  interactive?: boolean;
  rippleStrength?: number;
  rippleSize?: number;
  tilt?: number;
  intro?: boolean;
  lightMode?: boolean;
  maxDevicePixelRatio?: number;
  className?: string;
  style?: CSSProperties;
}

declare function LiquidChrome(props: LiquidChromeProps): ReactElement | null;

export default LiquidChrome;
