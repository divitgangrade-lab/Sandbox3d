import { createRoot } from 'react-dom/client';

import ParticleText from '../components/ParticleText/ParticleText';

export interface ParticleTextController {
  dispose(): void;
}

export function mountParticleText(container: HTMLElement): ParticleTextController {
  const root = createRoot(container);
  let disposed = false;

  root.render(
    <ParticleText
      text="Welcome"
      particleSize={1.7}
      density={3}
      color="#e9eef6"
      highlightColor="#b8ff5a"
      highlightMode="motion"
      shape="circle"
      intro="gather"
      scatter={90}
      gatherDuration={900}
      stagger={180}
      clickBurst
      burstStrength={0.8}
      pointerRepel={26}
      repelRadius={90}
      idleDrift={0.35}
      trigger="hover"
      fontSize="clamp(2.4rem, 8vw, 3.6rem)"
      fontWeight={800}
      fontFamily="inherit"
      glow
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
