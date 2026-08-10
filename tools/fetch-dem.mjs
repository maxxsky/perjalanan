/**
 * E1 — Unduh tile DEM dari AWS Terrain Tiles (format Terrarium).
 * Baca URL tile dari data-raw/derived-meta.json.
 *
 * Validasi wajib: HTTP 200, PNG signature, >1000 byte, 256×256.
 * Kalau gagal → hapus file, lapor, berhenti.
 */

import fs from 'fs';
import { createHash } from 'crypto';

const META_PATH = 'data-raw/derived-meta.json';
const OUT_DIR = 'data-raw/dem-tiles';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// ============================================================
//  Baca tile dari derived-meta.json
// ============================================================

const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
const tiles = meta.tiles;

if (!tiles?.length) {
  console.error('GAGAL: derived-meta.json tidak berisi daftar tile.');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// ============================================================
//  Unduh + validasi tiap tile
// ============================================================

let totalBytes = 0;

for (const tile of tiles) {
  const { url, z, x, y } = tile;
  const filename = `${z}-${x}-${y}.png`;
  const outPath = `${OUT_DIR}/${filename}`;

  console.log(`\nMengunduh ${url}`);

  const res = await fetch(url);

  if (res.status !== 200) {
    console.error(`GAGAL: HTTP ${res.status} — ${url}`);
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());

  // Cek signature PNG
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    const preview = buf.subarray(0, Math.min(20, buf.length)).toString('hex');
    console.error(`GAGAL: Bukan PNG. ${buf.length} byte, signature: ${preview}`);
    console.error(`URL: ${url}`);
    console.error('Isi kemungkinan halaman error XML/HTML.');
    process.exit(1);
  }

  // Cek ukuran
  if (buf.length < 1000) {
    console.error(`GAGAL: File terlalu kecil (${buf.length} byte).`);
    process.exit(1);
  }

  // Cek dimensi dari IHDR chunk (byte 16-23: width 4B, height 4B)
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  if (width !== 256 || height !== 256) {
    console.error(`GAGAL: Dimensi ${width}×${height}, seharusnya 256×256.`);
    process.exit(1);
  }

  // Simpan
  fs.writeFileSync(outPath, buf);
  totalBytes += buf.length;

  console.log(`  ✓ HTTP 200, ${buf.length} byte, PNG 256×256, signature valid`);
  console.log(`  → ${outPath}`);
}

console.log(`\nSelesai. ${tiles.length} tile, ${totalBytes.toLocaleString()} byte total.`);
