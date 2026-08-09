import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getInputVector } from '../input/index.js';
import { getCameraYaw } from './camera.js';
import { getTerrainHeight } from '../world/terrain.js';
import { applyBounds } from '../world/bounds.js';

let character = null;
let camera = null;

// State diekspos ke camera.js buat recentering
let _moveDir = { x: 0, z: 0 };
let _isMoving = false;

export function getMoveDir() {
  return _moveDir;
}

export function isMoving() {
  return _isMoving;
}

export function initController(charMesh, cam) {
  character = charMesh;
  camera = cam;
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

export function updateController(delta) {
  if (!character || !camera) return;

  const input = getInputVector();
  const inputLen = Math.sqrt(input.x * input.x + input.y * input.y);

  if (inputLen < CONFIG.input.deadzone) {
    _isMoving = false;
    _moveDir = { x: 0, z: 0 };
    return;
  }

  _isMoving = true;

  // Normalisasi input
  const normX = input.x / inputLen;
  const normY = input.y / inputLen;

  // Basis gerak dari camYaw (bukan posisi kamera!) — ini yg mutusin loop
  const yaw = getCameraYaw();
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const rightX = -forwardZ;  // rotate forward 90° CCW
  const rightZ = forwardX;

  // Arah gerak
  const moveX = normX * rightX + normY * forwardX;
  const moveZ = normX * rightZ + normY * forwardZ;

  // Simpan buat camera.js
  _moveDir = { x: moveX, z: moveZ };

  // Gerak XZ
  const speed = CONFIG.player.walkSpeed;
  character.position.x += moveX * speed * delta;
  character.position.z += moveZ * speed * delta;

  // Batas dunia — dorongan balik
  applyBounds(character.position, delta);

  // Y mengikuti terrain dengan smoothing
  const targetY = getTerrainHeight(character.position.x, character.position.z);
  const yLerp = Math.min(CONFIG.player.terrainSmooth * delta, 1);
  character.position.y += (targetY - character.position.y) * yLerp;

  // Rotasi karakter — lerp menghadap arah gerak
  const targetAngle = Math.atan2(moveX, moveZ);
  const newAngle = lerpAngle(character.rotation.y, targetAngle, CONFIG.player.turnSpeed * delta);
  character.rotation.y = newAngle;
}
