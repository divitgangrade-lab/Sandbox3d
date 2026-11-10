import type { CSSProperties, ReactElement, ReactNode } from 'react';

export interface GooeyNavItem {
  label: string;
  href?: string;
  icon?: ReactNode;
  badge?: string;
  title?: string;
}

export interface GooeyNavProps {
  items?: GooeyNavItem[];
  ariaLabel?: string;
  initialActiveIndex?: number;
  activeIndex?: number;
  onChange?: (index: number, item: GooeyNavItem) => void;
  theme?: 'dark' | 'light';
  color?: string;
  activeTextColor?: string;
  colors?: string[];
  size?: 'sm' | 'md' | 'lg';
  frame?: boolean;
  animationTime?: number;
  particleCount?: number;
  spread?: number;
  timeVariance?: number;
  gooeyness?: number;
  wobble?: number;
  hoverEffect?: boolean;
  className?: string;
  style?: CSSProperties;
}

declare function GooeyNav(props: GooeyNavProps): ReactElement | null;

export default GooeyNav;
