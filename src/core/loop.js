import { CONFIG } from '../config.js';

// Game loop — akan dipakai mulai T1.2
let clock = null;
let animFrameId = null;

export function getClock() {
  if (!clock) {
    clock = new THREE.Clock();
  }
  return clock;
}

export function getDelta() {
  return getClock().getDelta();
}

export { clock, animFrameId };
