import { createRoot } from 'react-dom/client';

import LiquidChrome from '../components/LiquidChrome/LiquidChrome';

export interface LiquidChromeController {
  dispose(): void;
}

export function mountLiquidChrome(container: HTMLElement): LiquidChromeController {
  const root = createRoot(container);
  let disposed = false;

  root.render(
    <LiquidChrome
      color="#c6f58a"
      speed={0.16}
      amplitude={0.28}
      frequencyX={2.4}
      frequencyY={2.1}
      detail={4}
      thickness={1.05}
      depth={1}
      roughness={0.32}
      exposure={0.9}
      interactive
      rippleStrength={0.8}
      rippleSize={1.25}
      tilt={0.6}
      intro
      lightMode={false}
      maxDevicePixelRatio={1.5}
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
