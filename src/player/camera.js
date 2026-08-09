import * as THREE from 'three';
import { CONFIG } from '../config.js';

let character = null;
let camera = null;

const _targetPos = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

/**
 * Set referensi ke character dan camera.
 */
export function initFollowCamera(charMesh, cam) {
  character = charMesh;
  camera = cam;

  // Posisi awal: langsung snap ke posisi yang benar
  updateFollowCamera(1.0);
}

/**
 * Update posisi kamera tiap frame.
 * @param {number} delta — delta time dari game loop
 */
export function updateFollowCamera(delta) {
  if (!character || !camera) return;

  // Offset kamera relatif ke karakter: di belakang (local -Z), setinggi height
  // Kamera selalu di belakang karakter (berlawanan arah hadap)
  _offset.set(0, CONFIG.camera.height, -CONFIG.camera.distance);

  // Rotasi offset sesuai arah hadap karakter
  _offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), character.rotation.y);

  // Posisi target kamera
  _targetPos.copy(character.position).add(_offset);

  // Lerp posisi kamera ke target
  const t = 1 - Math.exp(-CONFIG.camera.followLerp * delta);
  camera.position.lerp(_targetPos, t);

  // LookAt titik di atas karakter
  _lookTarget.copy(character.position);
  _lookTarget.y += CONFIG.camera.lookAtHeight;
  camera.lookAt(_lookTarget);
}
