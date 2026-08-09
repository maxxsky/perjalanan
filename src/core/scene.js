import * as THREE from 'three';
import { CONFIG } from '../config.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // belum dipakai, explicit off

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, CONFIG.camera.height, CONFIG.camera.distance);
camera.lookAt(0, CONFIG.camera.lookAtHeight, 0);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(10, 20, 5);
scene.add(directional);

// Grid reference
const grid = new THREE.GridHelper(100, 100, 0x888888, 0xcccccc);
scene.add(grid);

// Window resize
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

export { scene, renderer, camera };
