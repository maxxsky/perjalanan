import { CONFIG } from '../config.js';

/**
 * Soft pushback di batas dunia.
 * Dorongan menguat bertahap — bukan pantulan keras.
 * Dipanggil dari controller tiap frame.
 *
 * @param {THREE.Vector3} position — posisi karakter (dimutasi langsung)
 * @param {number} delta
 */
export function applyBounds(position, delta) {
  const { minX, maxX, minZ, maxZ } = CONFIG.world.bounds;
  const force = CONFIG.world.boundsPushback;

  // X bounds
  if (position.x < minX) {
    position.x += (minX - position.x) * force * delta;
  } else if (position.x > maxX) {
    position.x += (maxX - position.x) * force * delta;
  }

  // Z bounds
  if (position.z < minZ) {
    position.z += (minZ - position.z) * force * delta;
  } else if (position.z > maxZ) {
    position.z += (maxZ - position.z) * force * delta;
  }
}
