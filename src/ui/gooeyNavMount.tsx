import { createRoot } from 'react-dom/client';
import type { CSSProperties } from 'react';

import GooeyNav, { type GooeyNavItem } from '../components/GooeyNav/GooeyNav';

const TOP_ITEMS: GooeyNavItem[] = [
  { label: 'Play', href: '#' },
  { label: 'Objects', href: '#' },
  { label: 'Guide', href: '#' }
];

const TOP_LABELS: Record<string, string> = {
  Play: 'Back to play',
  Objects: 'Browse objects',
  Guide: 'Open guide'
};

const COLORS = ['#b8ff5a', '#a9c98a', '#d3c98f'];

const TOP_STYLE = {
  '--gn-frame': 'rgba(12, 18, 28, 0.82)',
  '--gn-frame-edge': 'rgba(255, 255, 255, 0.1)',
  '--gn-frame-highlight': 'rgba(255, 255, 255, 0.06)',
  '--gn-frame-shadow': '0 12px 30px -18px rgba(0, 0, 0, 0.9)',
  '--gn-ink': '#eef4fb',
  '--gn-muted': 'rgba(226, 235, 245, 0.74)'
} as CSSProperties;

export interface GooeyNavOptions {
  items: GooeyNavItem[];
  ariaLabel?: string;
  initialActiveIndex?: number;
  onSelect: (index: number, item: GooeyNavItem) => void;
  className?: string;
  style?: CSSProperties;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  activeTextColor?: string;
  colors?: string[];
  particleCount?: number;
  spread?: number;
  animationTime?: number;
  timeVariance?: number;
  gooeyness?: number;
  wobble?: number;
  cursorLabel?: (item: GooeyNavItem, index: number) => string;
}

export interface GooeyNavController {
  setActive(index: number): void;
  dispose(): void;
}

export function mountGooeyNav(
  container: HTMLElement,
  options: GooeyNavOptions
): GooeyNavController {
  const root = createRoot(container);
  const items = options.items;
  let active = Math.min(items.length - 1, Math.max(0, options.initialActiveIndex ?? 0));
  let disposed = false;

  const draw = () => {
    if (disposed) return;
    root.render(
      <GooeyNav
        items={items}
        ariaLabel={options.ariaLabel}
        initialActiveIndex={active}
        activeIndex={active}
        onChange={(index, item) => {
          active = index;
          draw();
          options.onSelect(index, item);
        }}
        theme="dark"
        color={options.color ?? '#b8ff5a'}
        activeTextColor={options.activeTextColor ?? '#14200a'}
        colors={options.colors ?? COLORS}
        size={options.size ?? 'sm'}
        frame
        particleCount={options.particleCount ?? 12}
        spread={options.spread ?? 42}
        animationTime={options.animationTime ?? 520}
        timeVariance={options.timeVariance ?? 220}
        gooeyness={options.gooeyness ?? 0.55}
        wobble={options.wobble ?? 0.45}
        hoverEffect
        className={options.className ?? ''}
        style={options.style}
      />
    );
  };

  const decorateTargets = () => {
    for (const link of container.querySelectorAll<HTMLElement>('.gooey-nav__link')) {
      const itemHost = link.closest<HTMLElement>('[data-gooey-index]');
      const index = Number(itemHost?.dataset.gooeyIndex ?? -1);
      const item = items[index];
      if (!item) continue;
      link.classList.add('cursor-target');
      link.dataset.cursorLabel = options.cursorLabel?.(item, index) ?? item.label;
      if (item.title) link.title = item.title;
    }
  };

  const targetObserver = new MutationObserver(decorateTargets);
  targetObserver.observe(container, { childList: true, subtree: true });
  draw();
  decorateTargets();

  return {
    setActive(index) {
      const next = Math.min(items.length - 1, Math.max(0, index));
      if (next === active) return;
      active = next;
      draw();
    },
    dispose() {
      disposed = true;
      targetObserver.disconnect();
      root.unmount();
    }
  };
}

export function mountTopNav(
  container: HTMLElement,
  onNavigate: (index: number) => void
): GooeyNavController {
  return mountGooeyNav(container, {
    items: TOP_ITEMS,
    ariaLabel: 'Primary navigation',
    initialActiveIndex: 0,
    onSelect: (index) => onNavigate(index),
    className: 'gooey-nav--topbar',
    style: TOP_STYLE,
    size: 'sm',
    color: '#b8ff5a',
    activeTextColor: '#14200a',
    colors: COLORS,
    particleCount: 12,
    spread: 42,
    animationTime: 520,
    timeVariance: 220,
    gooeyness: 0.55,
    wobble: 0.45,
    cursorLabel: (item) => TOP_LABELS[item.label] ?? item.label
  });
}
