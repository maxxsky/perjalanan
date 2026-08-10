import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { CONFIG } from '../config.js';
import { mulberry32, hashString } from '../util/rng.js';

// ============================================================
//  Noise
// ============================================================

const perlin = new ImprovedNoise();

function fbm(x, z) {
  return (
    perlin.noise(x * 0.008, 0, z * 0.008) * 6 +
    perlin.noise(x * 0.03, 0, z * 0.03) * 1.5 +
    perlin.noise(x * 0.1, 0, z * 0.1) * 0.3
  );
}

// ============================================================
//  Profil melintang — Sekongkang
// ============================================================
// Data: pantai sempit, pesisir landai 0-80m dalam ~5km,
// bukit mulai naik setelah 2-3km dari pantai, max ~400m di viewpoint.

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Profil Sekongkang — berdasarkan SRTM 30m
// Skala game: 1 unit ≈ 50m, terrain 100 unit = 5km
// Data: pantai 5m, 400m datar, bukit 150m @1.5km, puncak 279m @3km

const PROFILE = [
  { x: -100, y: -8 },    // laut dalam
  { x: -40,  y: -4 },    // shelf
  { x: -22,  y: -1 },    // dekat pantai
  { x: -16,  y: 0.1 },   // PANTAI — garis air
  { x: -10,  y: 0.3 },   // dataran pesisir (~400m)
  { x: 0,    y: 1.5 },   // mulai tanjakan
  { x: 12,   y: 3.5 },   // bukit pertama (~150m)
  { x: 28,   y: 6.0 },   // puncak (~280m @3km)
  { x: 45,   y: 3.0 },   // turun ke lembah
  { x: 60,   y: 8.0 },   // bukit berikutnya
  { x: 100,  y: 12.0 },  // pedalaman
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
  if (x < -22) return 0.0;
  if (x < -16) return smoothstep(-22, -16, x) * 0.03;
  if (x < -10) return 0.03 + smoothstep(-16, -10, x) * 0.05;
  if (x < 5)   return 0.08;
  if (x < 20)  return 0.08 + smoothstep(5, 20, x) * 0.92;
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
  } else if (y < 1.0) {
    hex = parseInt(palette.sand.slice(1), 16);
  } else if (y < 6) {
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

export function createTerrain(palette) {
  const { segmentsX, segmentsZ, sizeX, sizeZ } = CONFIG.terrain;

  const geo = new THREE.PlaneGeometry(sizeX, sizeZ, segmentsX, segmentsZ);
  geo.rotateX(-Math.PI / 2);

  const positions = geo.attributes.position;

  for (let i = 0; i < positions.count; i++) {
    const ix = i * 3;
    const worldX = positions.array[ix];
    const worldZ = positions.array[ix + 2];
    positions.array[ix + 1] = getTerrainHeight(worldX, worldZ);
  }

  positions.needsUpdate = true;

  const nonIndexed = geo.toNonIndexed();
  nonIndexed.computeVertexNormals();

  const colors = new Float32Array(nonIndexed.attributes.position.count * 3);
  const nPositions = nonIndexed.attributes.position;

  const colorRng = mulberry32(hashString(palette.terrain));

  for (let i = 0; i < nPositions.count; i++) {
    const ix = i * 3;
    const worldY = nPositions.array[ix + 1];
    const variation = colorRng() - 0.5;
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
