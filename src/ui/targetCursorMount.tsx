import { createRoot } from 'react-dom/client';

import TargetCursor from '../components/TargetCursor/TargetCursor';

export interface TargetCursorController {
  dispose(): void;
}

export function mountTargetCursor(container: HTMLElement): TargetCursorController {
  const root = createRoot(container);
  let disposed = false;

  root.render(
    <TargetCursor
      targetSelector=".cursor-target, .gooey-nav__link"
      cursorColor="#e9eef6"
      cursorColorOnTarget="#b8ff5a"
      spinDuration={2.4}
      hoverDuration={0.2}
      parallaxOn
      hideDefaultCursor
      size={34}
      cornerSize={11}
      thickness={2}
      padding={7}
      matchRadius
      dotSize={3}
      blendMode="difference"
      showLabel
      clickEffect
    />
  );

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      root.unmount();
    }
  };
}
