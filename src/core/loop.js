import * as THREE from 'three';

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

/**
 * Start game loop. callback(delta) dipanggil tiap frame.
 */
export function startLoop(callback) {
  getClock(); // init clock, reset delta pertama
  function tick() {
    const delta = Math.min(getDelta(), 0.1); // cap delta supaya gak lompat besar
    callback(delta);
    animFrameId = requestAnimationFrame(tick);
  }
  animFrameId = requestAnimationFrame(tick);
}

export function stopLoop() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}
