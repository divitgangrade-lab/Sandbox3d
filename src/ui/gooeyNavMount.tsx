import { createRoot } from 'react-dom/client';
import type { CSSProperties } from 'react';

import GooeyNav, { type GooeyNavItem } from '../components/GooeyNav/GooeyNav';

const ITEMS: GooeyNavItem[] = [
  { label: 'Play', href: '#' },
  { label: 'Objects', href: '#' },
  { label: 'Guide', href: '#' }
];

const COLORS = ['#b8ff5a', '#8bf0c0', '#d9ff9a'];

const FRAME_STYLE = {
  '--gn-frame': 'rgba(12, 18, 28, 0.82)',
  '--gn-frame-edge': 'rgba(255, 255, 255, 0.1)',
  '--gn-frame-highlight': 'rgba(255, 255, 255, 0.06)',
  '--gn-frame-shadow': '0 12px 30px -18px rgba(0, 0, 0, 0.9)',
  '--gn-ink': '#eef4fb',
  '--gn-muted': 'rgba(226, 235, 245, 0.58)'
} as CSSProperties;

export interface GooeyNavController {
  setActive(index: number): void;
  dispose(): void;
}

export function mountGooeyNav(
  container: HTMLElement,
  onNavigate: (index: number) => void
): GooeyNavController {
  const root = createRoot(container);
  let active = 0;
  let disposed = false;

  const draw = () => {
    if (disposed) return;
    root.render(
      <GooeyNav
        items={ITEMS}
        initialActiveIndex={0}
        activeIndex={active}
        onChange={(index) => {
          active = index;
          draw();
          onNavigate(index);
        }}
        theme="dark"
        color="#b8ff5a"
        activeTextColor="#14200a"
        colors={COLORS}
        size="sm"
        frame
        particleCount={12}
        spread={42}
        animationTime={520}
        timeVariance={220}
        gooeyness={0.55}
        wobble={0.45}
        hoverEffect
        className="gooey-nav--topbar"
        style={FRAME_STYLE}
      />
    );
  };

  const navLabels: Record<string, string> = {
    Play: 'Back to play',
    Objects: 'Browse objects',
    Guide: 'Open guide'
  };

  const decorateTargets = () => {
    for (const link of container.querySelectorAll<HTMLAnchorElement>('.gooey-nav__link')) {
      const label = link.textContent?.trim() ?? '';
      if (!label) continue;
      link.classList.add('cursor-target');
      link.dataset.cursorLabel = navLabels[label] ?? label;
    }
  };

  const targetObserver = new MutationObserver(decorateTargets);
  targetObserver.observe(container, { childList: true, subtree: true });
  draw();
  decorateTargets();

  return {
    setActive(index) {
      const next = Math.min(ITEMS.length - 1, Math.max(0, index));
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
