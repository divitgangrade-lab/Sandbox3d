import './style.css';
import { SandboxGame } from './game/SandboxGame';
import { VISIBLE_OBJECT_COUNT } from './catalog';

const boot = document.getElementById('boot');
const bootBar = document.getElementById('boot-bar');
const bootStatus = document.getElementById('boot-status');
const fatal = document.getElementById('fatal');
const fatalMessage = document.getElementById('fatal-message');

function showFatal(error: unknown): void {
  console.error('[Sandbox3D]', error);
  boot?.classList.add('is-hidden');
  if (fatal) fatal.hidden = false;
  if (fatalMessage) {
    fatalMessage.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function start(): Promise<void> {
  try {
    if (bootStatus) bootStatus.textContent = 'Loading the physics engine…';
    if (bootBar) bootBar.style.width = '16%';

    const game = new SandboxGame();
    await game.init();

    if (bootStatus) bootStatus.textContent = 'Warming up the playground…';
    if (bootBar) bootBar.style.width = '84%';
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    game.start();
    if (import.meta.env.DEV) {
      (window as Window & { __sandbox3d?: SandboxGame }).__sandbox3d = game;
    }
    if (bootBar) bootBar.style.width = '100%';
    if (bootStatus) bootStatus.textContent = 'Ready';
    console.info(`Sandbox3D ready · ${VISIBLE_OBJECT_COUNT} objects · Rapier + Three.js`);

    window.setTimeout(() => {
      boot?.classList.add('is-hidden');
      window.setTimeout(() => boot?.remove(), 500);
    }, 160);

    window.addEventListener('error', (event) => {
      console.error('[Sandbox3D] Uncaught error:', event.error ?? event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Sandbox3D] Unhandled rejection:', event.reason);
    });
  } catch (error) {
    showFatal(error);
  }
}

void start();
