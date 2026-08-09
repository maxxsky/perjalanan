import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getInputVector } from '../input/index.js';

let character = null;
let camera = null;

/**
 * Set reference ke character mesh dan camera.
 * Dipanggil dari main.js setelah scene siap.
 */
export function initController(charMesh, cam) {
  character = charMesh;
  camera = cam;
}

/**
 * Normalisasi sudut ke rentang -PI..PI
 */
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/**
 * Lerp sudut dengan wrap-around handling.
 * Tidak akan pernah muter jauh melewati ±π.
 */
function lerpAngle(current, target, t) {
  let diff = normalizeAngle(target - current);
  return current + diff * Math.min(t, 1);
}

const _vec3 = new THREE.Vector3();
const _camDir = new THREE.Vector3();

export function updateController(delta) {
  if (!character || !camera) return;

  const input = getInputVector();
  const inputLen = Math.sqrt(input.x * input.x + input.y * input.y);

  // Deadzone
  if (inputLen < CONFIG.input.deadzone) return;

  // Normalisasi input
  const normX = input.x / inputLen;
  const normY = input.y / inputLen;

  // Arah kamera relatif (XZ plane)
  // forward2D = arah MENJAUHI kamera (Tekan W = jalan menjauhi kamera)
  const charPos = character.position;
  const camPos = camera.position;

  _camDir.set(charPos.x - camPos.x, 0, charPos.z - camPos.z);
  if (_camDir.lengthSq() < 0.001) {
    // Kamera tepat di atas — fallback ke world forward
    _camDir.set(0, 0, -1);
  }
  _camDir.normalize();

  // right2D = rotate forward 90° CCW di XZ plane
  const rightX = -_camDir.z;
  const rightZ = _camDir.x;

  // Arah gerak = input.x * right + input.y * forward
  const moveX = normX * rightX + normY * _camDir.x;
  const moveZ = normX * rightZ + normY * _camDir.z;

  // Gerak — y dikunci 0
  const speed = CONFIG.player.walkSpeed;
  character.position.x += moveX * speed * delta;
  character.position.z += moveZ * speed * delta;

  // Rotasi — lerp menghadap arah gerak
  const targetAngle = Math.atan2(moveX, moveZ);
  const currentAngle = character.rotation.y;
  const newAngle = lerpAngle(currentAngle, targetAngle, CONFIG.player.turnSpeed * delta);
  character.rotation.y = newAngle;
}
