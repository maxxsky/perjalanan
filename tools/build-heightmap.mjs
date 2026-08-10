/**
 * E2 — Bangun heightmap dari tile DEM Terrarium.
 * Baca tile PNG, dekode elevasi, resample ke grid 101×151.
 * Output: public/data/sekongkang-heightmap.json
 */

import fs from 'fs';
import { PNG } from 'pngjs';

const META_PATH = 'data-raw/derived-meta.json';
const TILE_DIR = 'data-raw/dem-tiles';
const OUT_PATH = 'public/data/sekongkang-heightmap.json';

const OUT_W = 101;  // segmentsX + 1
const OUT_H = 151;  // segmentsZ + 1

// ============================================================
//  Web Mercator (salin dari build-journey.mjs, berdiri sendiri)
// ============================================================

const mercX = (lon) => (6378137 * lon * Math.PI) / 180;
const mercY = (lat) => 6378137 * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));

// ============================================================
//  Baca meta
// ============================================================

const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
const { bbox, zoom, tiles } = meta;

if (!bbox || !zoom || !tiles?.length) {
  console.error('GAGAL: derived-meta.json tidak lengkap.');
  process.exit(1);
}

// ============================================================
//  Muat tile PNG
// ============================================================

const tileMap = {}; // key: "x-y"
for (const t of tiles) {
  const filename = `${TILE_DIR}/${t.z}-${t.x}-${t.y}.png`;
  const buf = fs.readFileSync(filename);
  const png = PNG.sync.read(buf);
  tileMap[`${t.x}-${t.y}`] = png;

  // Simpan metadata tile untuk referensi
  t._pixels = png.width + 'x' + png.height;
}
console.log(`Tile dimuat: ${Object.keys(tileMap).length}`);

// ============================================================
//  Gabungkan tile vertikal
// ============================================================

// Semua tile punya x yang sama. Urutkan berdasarkan y.
const tileYs = tiles.map(t => t.y).sort((a, b) => a - b);
const minTileY = tileYs[0];
const tileX = tiles[0].x;

// Gabungan: width = 256, height = jumlah tile * 256
const mergedW = 256;
const mergedH = tileYs.length * 256;
const merged = new Float64Array(mergedW * mergedH);

for (const t of tiles) {
  const png = tileMap[`${t.x}-${t.y}`];
  const rowOffset = (t.y - minTileY) * 256; // baris di gambar gabungan
  for (let py = 0; py < 256; py++) {
    for (let px = 0; px < 256; px++) {
      const srcIdx = (py * 256 + px) * 4;
      const R = png.data[srcIdx];
      const G = png.data[srcIdx + 1];
      const B = png.data[srcIdx + 2];
      // Dekode Terrarium
      const elev = (R * 256 + G + B / 256) - 32768;
      const dstIdx = (rowOffset + py) * mergedW + px;
      merged[dstIdx] = elev;
    }
  }
}

console.log(`Gabungan: ${mergedW}×${mergedH} piksel`);

// ============================================================
//  Konversi lat/lon → piksel di gambar gabungan
// ============================================================

const n = 2 ** zoom;

function lonToPx(lon) {
  return ((lon + 180) / 360) * n * 256;
}

function latToPy(lat) {
  return ((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2) * n * 256;
}

// Offset agar koordinat relatif terhadap tile pertama
const px0 = tileX * 256;
const py0 = minTileY * 256;

// ============================================================
//  Crop + resample ke grid output
// ============================================================

const pxMin = lonToPx(bbox.minLon) - px0;
const pxMax = lonToPx(bbox.maxLon) - px0;
const pyMin = latToPy(bbox.maxLat) - py0; // maxLat = utara = baris lebih kecil
const pyMax = latToPy(bbox.minLat) - py0; // minLat = selatan = baris lebih besar

const data = new Float32Array(OUT_W * OUT_H);
let elevMin = Infinity, elevMax = -Infinity;
let negCount = 0, zeroCount = 0;

for (let row = 0; row < OUT_H; row++) {
  for (let col = 0; col < OUT_W; col++) {
    // t = 0..1 di dalam grid output
    const tCol = col / (OUT_W - 1);
    const tRow = row / (OUT_H - 1);

    // Koordinat di gambar gabungan (pecahan)
    const srcX = pxMin + tCol * (pxMax - pxMin);
    const srcY = pyMin + tRow * (pyMax - pyMin); // utara (row 0) = pyMin

    // Interpolasi bilinear
    const ix = Math.floor(srcX);
    const iy = Math.floor(srcY);
    const fx = srcX - ix;
    const fy = srcY - iy;

    const x0 = Math.max(0, Math.min(mergedW - 1, ix));
    const x1 = Math.max(0, Math.min(mergedW - 1, ix + 1));
    const y0 = Math.max(0, Math.min(mergedH - 1, iy));
    const y1 = Math.max(0, Math.min(mergedH - 1, iy + 1));

    const v00 = merged[y0 * mergedW + x0];
    const v10 = merged[y0 * mergedW + x1];
    const v01 = merged[y1 * mergedW + x0];
    const v11 = merged[y1 * mergedW + x1];

    const top = v00 + (v10 - v00) * fx;
    const bot = v01 + (v11 - v01) * fx;
    const val = top + (bot - top) * fy;

    data[row * OUT_W + col] = val;

    if (val < elevMin) elevMin = val;
    if (val > elevMax) elevMax = val;
    if (val < 0) negCount++;
    if (val === 0) zeroCount++;
  }
}

const totalPixels = OUT_W * OUT_H;
const elevAvg = data.reduce((a, b) => a + b, 0) / totalPixels;

// ============================================================
//  Elevasi di Villa Surga
// ============================================================

const manualAll = JSON.parse(fs.readFileSync('data-raw/manual-locations.json', 'utf8'));
const villaSurga = manualAll.sekongkang.find(m => m.id === 'villa-surga');

let villaElev = null;
if (villaSurga) {
  const vsPx = lonToPx(villaSurga.lon) - px0;
  const vsPy = latToPy(villaSurga.lat) - py0;
  const vix = Math.max(0, Math.min(mergedW - 1, Math.round(vsPx)));
  const viy = Math.max(0, Math.min(mergedH - 1, Math.round(vsPy)));
  villaElev = merged[viy * mergedW + vix];
}

// ============================================================
//  Tulis heightmap
// ============================================================

const heightmap = {
  source: `AWS Terrain Tiles terrarium zoom ${zoom}, tile ${tileX}/${minTileY} dan ${tileX}/${minTileY + 1}`,
  sourceFiles: tiles.map(t => `data-raw/dem-tiles/${t.z}-${t.x}-${t.y}.png`),
  builtAt: new Date().toISOString(),
  bbox,
  width: OUT_W,
  height: OUT_H,
  rowOrder: 'baris 0 = lintang tertinggi (utara)',
  unit: 'meter',
  elevationRange: { min: +elevMin.toFixed(2), max: +elevMax.toFixed(2) },
  data: Array.from(data).map(v => +v.toFixed(2)),
};

fs.writeFileSync(OUT_PATH, JSON.stringify(heightmap));
console.log(`\nDitulis: ${OUT_PATH} (${JSON.stringify(heightmap).length.toLocaleString()} byte)`);

// ============================================================
//  Laporan
// ============================================================

console.log(`\n=== VERIFIKASI ELEVASI ===`);
console.log(`Rentang elevasi     : ${elevMin.toFixed(1)} m sampai ${elevMax.toFixed(1)} m`);
console.log(`Persentase < 0      : ${(negCount / totalPixels * 100).toFixed(1)}%`);
console.log(`Persentase = 0      : ${(zeroCount / totalPixels * 100).toFixed(1)}%`);
console.log(`Elevasi rata-rata   : ${elevAvg.toFixed(1)} m`);

if (villaSurga && villaElev !== null) {
  console.log(`Elevasi Villa Surga : ${villaElev.toFixed(1)} m (${villaSurga.lat}, ${villaSurga.lon})`);
}

// Validasi
if (elevMin === elevMax) {
  console.error('\nGAGAL: Seluruh grid bernilai sama. Dekode kemungkinan salah.');
  process.exit(1);
}
if (elevMax <= 0) {
  console.error('\nGAGAL: Semua elevasi ≤ 0. Area ini tidak mungkin seluruhnya laut.');
  process.exit(1);
}
if (villaElev !== null && villaElev <= 0) {
  console.error('\nGAGAL: Villa Surga di bawah air. Proyeksi atau bbox terbalik.');
  process.exit(1);
}

console.log('\n✓ Heightmap valid.');
