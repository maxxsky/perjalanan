import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { CONFIG } from '../config.js';
import { mulberry32, hashString } from '../util/rng.js';

// ============================================================
//  Noise
// ============================================================

const perlin = new ImprovedNoise();

/**
 * Fractal Brownian Motion — tiga oktaf.
 * Amplitudo per oktaf adalah satuan DUNIA, tidak dinormalisasi.
 */
function fbm(x, z) {
  return (
    perlin.noise(x * 0.008, 0, z * 0.008) * 6 +
    perlin.noise(x * 0.03, 0, z * 0.03) * 1.5 +
    perlin.noise(x * 0.1, 0, z * 0.1) * 0.3
  );
}

// ============================================================
//  Profil melintang (cross-section)
// ============================================================

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

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
  if (x <= PROFILE[0].x) return PROFILE[0].y;
  if (x >= PROFILE[PROFILE.length - 1].x) return PROFILE[PROFILE.length - 1].y;

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

function getNoiseDamping(x) {
  if (x < -40) return 0.0;
  if (x < -25) return smoothstep(-40, -25, x) * 0.05;
  if (x < -10) return 0.05 + smoothstep(-25, -10, x) * 0.1;
  if (x < 15)  return 0.08;
  if (x < 30)  return 0.08 + smoothstep(15, 30, x) * 0.92;
  return 1.0;
}

// ============================================================
//  Height function
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
 * Layout array setelah PlaneGeometry + rotateX(-PI/2):
 *   array[ix+0] = world X  (rentang -sizeX/2 .. sizeX/2)
 *   array[ix+1] = world Y  (tinggi, awal 0)
 *   array[ix+2] = world Z  (rentang -sizeZ/2 .. sizeZ/2)
 */
export function createTerrain(palette) {
  const { segmentsX, segmentsZ, sizeX, sizeZ } = CONFIG.terrain;

  const geo = new THREE.PlaneGeometry(sizeX, sizeZ, segmentsX, segmentsZ);
  geo.rotateX(-Math.PI / 2);

  const positions = geo.attributes.position;

  // Displace vertex Y ke terrain height
  for (let i = 0; i < positions.count; i++) {
    const ix = i * 3;
    const worldX = positions.array[ix];
    const worldZ = positions.array[ix + 2];
    positions.array[ix + 1] = getTerrainHeight(worldX, worldZ);
  }

  positions.needsUpdate = true;

  // Non-indexed → flat shading per segitiga
  const nonIndexed = geo.toNonIndexed();
  nonIndexed.computeVertexNormals();

  // Vertex colors
  const colors = new Float32Array(nonIndexed.attributes.position.count * 3);
  const nPositions = nonIndexed.attributes.position;

  // PRNG untuk variasi warna — seed dari area biar deterministik
  const colorRng = mulberry32(hashString(palette.terrain));

  for (let i = 0; i < nPositions.count; i++) {
    const ix = i * 3;
    const worldY = nPositions.array[ix + 1];
    const variation = colorRng() - 0.5; // -0.5 .. 0.5
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

  return new THREE.Mesh(nonIndexed, mat);
}

// ============================================================
//  Air
// ============================================================

/**
 * Plane air hanya di sisi barat (laut), tidak muncul di timur (bukit).
 */
export function createWater(palette) {
  const geo = new THREE.PlaneGeometry(260, 400);
  const mat = new THREE.MeshLambertMaterial({
    color: palette.water,
    transparent: true,
    opacity: 0.85,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-80, 0, 0);
  return water;
}
