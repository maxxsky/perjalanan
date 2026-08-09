import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { CONFIG } from '../config.js';

// ============================================================
//  Noise
// ============================================================

const perlin = new ImprovedNoise();

function fbm(x, z) {
  let val = 0;
  let amp = 1;
  let freq = 1;
  let total = 0;

  // Tiga oktaf
  const octaves = [
    { scale: 0.008, amplitude: 6 },
    { scale: 0.03,  amplitude: 1.5 },
    { scale: 0.1,   amplitude: 0.3 },
  ];

  for (const o of octaves) {
    val += perlin.noise(x * o.scale, 0, z * o.scale) * o.amplitude * amp;
    total += o.amplitude * amp;
    amp *= 0.5;
  }

  return val / total;
}

// ============================================================
//  Profil melintang (cross-section)
// ============================================================

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Key points untuk profil melintang (fungsi dari X).
 * Antar titik di-smoothstep.
 */
const PROFILE = [
  { x: -100, y: -8 },    // laut dalam
  { x: -65,  y: -8 },    // mulai landai
  { x: -30,  y: -0.8 },  // akhir lereng bawah laut
  { x: -18,  y: -0.3 },  // awal pantai
  { x: -5,   y: 0.5 },   // pantai atas
  { x: 12,   y: 1.0 },   // jalur datar
  { x: 25,   y: 1.5 },   // awal kaki bukit
  { x: 50,   y: 14 },    // bukit
  { x: 80,   y: 28 },    // bukit tinggi
  { x: 100,  y: 35 },    // puncak
];

function getBaseHeight(x) {
  // Di bawah titik pertama
  if (x <= PROFILE[0].x) return PROFILE[0].y;
  // Di atas titik terakhir
  if (x >= PROFILE[PROFILE.length - 1].x) return PROFILE[PROFILE.length - 1].y;

  // Cari segmen
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i];
    const b = PROFILE[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = smoothstep(a.x, b.x, x);
      return a.y + (b.y - a.y) * t;
    }
  }

  return 0;
}

/**
 * Damping noise berdasarkan zona.
 * Jalur & laut = hampir nol, bukit = penuh.
 */
function getNoiseDamping(x) {
  if (x < -40) return 0.0;
  if (x < -25) return smoothstep(-40, -25, x) * 0.05;
  if (x < -10) return 0.05 + smoothstep(-25, -10, x) * 0.1;
  if (x < 15)  return 0.08;  // jalur: hampir datar
  if (x < 30)  return 0.08 + smoothstep(15, 30, x) * 0.92;
  return 1.0;  // bukit: noise penuh
}

// ============================================================
//  Height function — EKSPOR, sumber kebenaran tunggal
// ============================================================

export function getTerrainHeight(x, z) {
  const base = getBaseHeight(x);
  const noise = fbm(x, z);
  const damp = getNoiseDamping(x);
  return base + noise * damp;
}

// ============================================================
//  Warna vertex dari tinggi
// ============================================================

function darkenHex(hex, factor) {
  const r = Math.floor(((hex >> 16) & 0xff) * factor);
  const g = Math.floor(((hex >> 8) & 0xff) * factor);
  const b = Math.floor((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function getVertexColor(y, palette, variation) {
  let hex;

  if (y < -1) {
    hex = parseInt(palette.water.slice(1), 16);
  } else if (y < 1.2) {
    hex = parseInt(palette.sand.slice(1), 16);
  } else if (y < 10) {
    hex = parseInt(palette.terrain.slice(1), 16);
  } else {
    hex = darkenHex(parseInt(palette.terrain.slice(1), 16), 0.75);
  }

  // Variasi acak ±3% per segitiga
  const v = 1 + variation * 0.06;
  const r = Math.min(255, Math.floor(((hex >> 16) & 0xff) * v));
  const g = Math.min(255, Math.floor(((hex >> 8) & 0xff) * v));
  const b = Math.min(255, Math.floor((hex & 0xff) * v));

  return new THREE.Color(r / 255, g / 255, b / 255);
}

// ============================================================
//  Mesh terrain
// ============================================================

/**
 * Buat terrain mesh dari PlaneGeometry + vertex displacement.
 * @param {object} palette — warna dari area
 * @returns {THREE.Mesh}
 */
export function createTerrain(palette) {
  const { segmentsX, segmentsZ, sizeX, sizeZ } = CONFIG.terrain;

  const geo = new THREE.PlaneGeometry(sizeX, sizeZ, segmentsX, segmentsZ);
  geo.rotateX(-Math.PI / 2);

  const positions = geo.attributes.position;
  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;

  // Displace vertex Y ke terrain height
  for (let i = 0; i < positions.count; i++) {
    const ix = i * 3;
    const wx = positions.getX(i); // world X (nilai geometri sebelum rotate: ini jadi X dunia)
    const wz = positions.getY(i); // nilai Z geometri (sebelum rotate, ini sumbu Y geometri)
    // Setelah rotateX(-PI/2), sumbu Y → -Z, sumbu Z → Y
    // Tapi kita pakai PlaneGeometry yg sudah di-rotate, posisi vertex-nya:
    // getX = world X, getY = world Z (karena rotate -PI/2), getZ = world Y (negatif)
    // Cara lebih aman: baca dari array
    const worldX = positions.array[ix];
    const worldZ = positions.array[ix + 1];
    positions.array[ix + 2] = getTerrainHeight(worldX, worldZ);
  }

  positions.needsUpdate = true;
  geo.computeVertexNormals();

  // Non-indexed → flat shading per segitiga
  const nonIndexed = geo.toNonIndexed();

  // Vertex colors
  const colors = new Float32Array(nonIndexed.attributes.position.count * 3);
  const nPositions = nonIndexed.attributes.position;

  // Variasi acak per segitiga (setiap 3 vertex = 1 segitiga di non-indexed)
  const triCount = nPositions.count / 3;

  for (let i = 0; i < nPositions.count; i++) {
    const ix = i * 3;
    const worldX = nPositions.array[ix];
    const worldZ = nPositions.array[ix + 1];
    const worldY = nPositions.array[ix + 2];
    const triIdx = Math.floor(i / 3);
    const variation = (triIdx * 7 + triIdx * triIdx * 13) % 100 / 100 - 0.5; // deterministic "random"
    const color = getVertexColor(worldY, palette, variation);
    colors[ix] = color.r;
    colors[ix + 1] = color.g;
    colors[ix + 2] = color.b;
  }

  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(nonIndexed, mat);
  mesh.receiveShadow = true;

  return mesh;
}

// ============================================================
//  Air
// ============================================================

/**
 * Plane datar untuk permukaan air.
 */
export function createWater(palette) {
  const geo = new THREE.PlaneGeometry(400, 400);
  const mat = new THREE.MeshLambertMaterial({
    color: palette.water,
    transparent: true,
    opacity: 0.85,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  return water;
}
