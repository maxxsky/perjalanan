import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mulberry32, hashString } from '../util/rng.js';

// ============================================================
//  Heightmap state
// ============================================================

let _grid = null;        // Float32Array, width × height
let _width = 0;
let _height = 0;
let _elevMin = 0;
let _elevMax = 0;

/**
 * Panggil sekali sebelum createTerrain.
 * @param {object} json — isi public/data/sekongkang-heightmap.json
 */
export function initTerrain(json) {
  _width = json.width;
  _height = json.height;
  _elevMin = json.elevationRange.min;
  _elevMax = json.elevationRange.max;
  _grid = new Float32Array(json.data);
}

// ============================================================
//  Height function — bilinear sampling
// ============================================================

/**
 * @param {number} x — koordinat dunia X
 * @param {number} z — koordinat dunia Z
 * @returns {number} tinggi dalam unit dunia (sudah dikali heightScale)
 */
export function getTerrainHeight(x, z) {
  if (!_grid) return 0;

  const { sizeX, sizeZ, heightScale } = CONFIG.terrain;

  // Koordinat dunia → indeks grid pecahan
  // u: 0 di barat (x = -sizeX/2), width-1 di timur (x = +sizeX/2)
  // v: 0 di utara (z = +sizeZ/2, baris 0), height-1 di selatan (z = -sizeZ/2)
  const u = (x / sizeX + 0.5) * (_width - 1);
  const v = (0.5 - z / sizeZ) * (_height - 1);

  // Jepit
  const iu = Math.max(0, Math.min(_width - 2, Math.floor(u)));
  const iv = Math.max(0, Math.min(_height - 2, Math.floor(v)));

  const fu = u - iu;
  const fv = v - iv;

  // Bilinear
  const v00 = _grid[iv * _width + iu];
  const v10 = _grid[iv * _width + iu + 1];
  const v01 = _grid[(iv + 1) * _width + iu];
  const v11 = _grid[(iv + 1) * _width + iu + 1];

  const top = v00 + (v10 - v00) * fu;
  const bot = v01 + (v11 - v01) * fu;
  const meters = top + (bot - top) * fv;

  return meters * heightScale;
}

// ============================================================
//  Warna vertex — dari persentil elevasi aktual
// ============================================================

function darkenHex(hex, factor) {
  const r = Math.floor(((hex >> 16) & 0xff) * factor);
  const g = Math.floor(((hex >> 8) & 0xff) * factor);
  const b = Math.floor((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/**
 * Ambang warna dihitung dari elevationRange di heightmap.
 * Persentil: pasir ~15, hijau ~tengah, gelap ~75.
 */
function getVertexColor(meters, palette, variation) {
  let hex;
  const sandMax = _elevMin + (_elevMax - _elevMin) * 0.15;
  const terrainMax = _elevMin + (_elevMax - _elevMin) * 0.75;

  if (meters < 0) {
    hex = parseInt(palette.water.slice(1), 16);
  } else if (meters < sandMax) {
    hex = parseInt(palette.sand.slice(1), 16);
  } else if (meters < terrainMax) {
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
  if (!_grid) {
    console.error('createTerrain: panggil initTerrain() dulu.');
    return new THREE.Mesh();
  }

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

  // Vertex colors — pakai elevasi meter (sebelum heightScale)
  const colors = new Float32Array(nonIndexed.attributes.position.count * 3);
  const nPositions = nonIndexed.attributes.position;
  const { heightScale } = CONFIG.terrain;

  const colorRng = mulberry32(hashString(palette.terrain));

  for (let i = 0; i < nPositions.count; i++) {
    const ix = i * 3;
    const worldY = nPositions.array[ix + 1]; // tinggi dalam unit dunia
    const meters = worldY / heightScale;     // konversi balik ke meter
    const variation = colorRng() - 0.5;
    const color = getVertexColor(meters, palette, variation);
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
  const { sizeX, sizeZ } = CONFIG.terrain;
  // Cukup menutupi seluruh dunia + margin
  const geo = new THREE.PlaneGeometry(sizeX + 20, sizeZ + 20);
  const mat = new THREE.MeshLambertMaterial({
    color: palette.water,
    transparent: true,
    opacity: 0.85,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0; // permukaan laut = 0
  return water;
}
