import * as THREE from 'three';
import { CONFIG } from '../config.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, CONFIG.camera.height, -CONFIG.camera.distance);
camera.lookAt(0, CONFIG.camera.lookAtHeight, 0);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(10, 20, 5);
scene.add(directional);

// Ground plane — low-poly flat green
const groundGeo = new THREE.PlaneGeometry(CONFIG.world.gridSize, CONFIG.world.gridSize);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x4A7C3F });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Thin grid on top for movement reference
const grid = new THREE.GridHelper(CONFIG.world.gridSize, 100, 0x888888, 0xaaaaaa);
grid.position.y = 0.01; // sedikit di atas ground biar gak z-fight
scene.add(grid);

// Window resize
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

export { scene, renderer, camera };
