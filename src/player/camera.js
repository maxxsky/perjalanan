import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getMoveDir, isMoving } from './controller.js';

let character = null;
let camera = null;

// camYaw sendiri — BUKAN baca character.rotation.y tiap frame. Ini yg mutusin loop.
let camYaw = 0;

const _UP = new THREE.Vector3(0, 1, 0);
const _targetPos = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

export function getCameraYaw() {
  return camYaw;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function lerpAngle(current, target, t) {
  let diff = normalizeAngle(target - current);
  return current + diff * Math.min(t, 1);
}

/**
 * @param {boolean} snap — true = langsung snap ke target (init only)
 */
export function initFollowCamera(charMesh, cam) {
  character = charMesh;
  camera = cam;
  camYaw = character.rotation.y;
  updateFollowCamera(0.016, true); // snap
}

export function updateFollowCamera(delta, snap = false) {
  if (!character || !camera) return;

  // === Recentering logic ===
  if (isMoving()) {
    const md = getMoveDir();
    const forwardX = Math.sin(camYaw);
    const forwardZ = Math.cos(camYaw);
    const dot = md.x * forwardX + md.z * forwardZ;

    if (dot > CONFIG.camera.recenterDot) {
      // Bergerak SEARAH pandangan → recenter
      camYaw = lerpAngle(camYaw, character.rotation.y, CONFIG.camera.followLerp * delta);
    }
    // else: bergerak menyamping → camYaw DIBIARKAN. Ini yg mutus loop.
  } else {
    // Diam → recenter perlahan
    camYaw = lerpAngle(camYaw, character.rotation.y, CONFIG.camera.idleRecenterLerp * delta);
  }

  // === Posisi kamera dari camYaw ===
  _offset.set(0, CONFIG.camera.height, -CONFIG.camera.distance);
  _offset.applyAxisAngle(_UP, camYaw);

  _targetPos.copy(character.position).add(_offset);

  if (snap) {
    camera.position.copy(_targetPos);
  } else {
    const t = 1 - Math.exp(-CONFIG.camera.followLerp * delta);
    camera.position.lerp(_targetPos, t);
  }

  _lookTarget.copy(character.position);
  _lookTarget.y += CONFIG.camera.lookAtHeight;
  camera.lookAt(_lookTarget);
}
