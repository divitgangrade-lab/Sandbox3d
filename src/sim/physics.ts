/** Rapier bootstrap. The compatibility build inlines the WASM, so this works in browsers and Node. */

import RAPIER from '@dimforge/rapier3d-compat';

let initPromise: Promise<void> | null = null;

export function initPhysics(): Promise<void> {
  if (!initPromise) {
    initPromise = RAPIER.init().then(() => undefined);
  }
  return initPromise;
}

export function physicsReady(): boolean {
  return initPromise !== null;
}

export { RAPIER };
