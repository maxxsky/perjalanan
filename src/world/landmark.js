import * as THREE from 'three';
import { getTerrainHeight } from './terrain.js';

/**
 * Penanda landmark — tiang tipis + bola kecil.
 * Untuk penginapan, pantai, dan POI dari OSM.
 *
 * @param {Array} landmarks — area.landmarks dari journey.json
 * @param {THREE.Scene} scene
 */
export function createLandmarks(landmarks, scene) {
  for (const lm of landmarks) {
    const x = lm.position.x;
    const z = lm.position.z;
    const y = getTerrainHeight(x, z);

    // Tiang
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, y + 1, z);

    // Bola di atas
    const ballGeo = new THREE.SphereGeometry(0.15, 6, 4);
    const ballMat = new THREE.MeshLambertMaterial({ color: 0xE8DCC0 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(x, y + 2.1, z);

    scene.add(pole);
    scene.add(ball);
  }
}
