/**
 * G2 — Proses foto di photos-src/ → public/photos/<name>.webp
 *
 * - Baca orientasi EXIF, putar otomatis
 * - Crop 1:1 (attention)
 * - Resize 512×512
 * - WebP q82
 * - HAPUS semua metadata EXIF
 * - Tulis data/photo-manifest.json
 * - Tulis public/photos/review.html
 *
 * File yang sudah diproses (sourceHash sama) dilewati.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

const SRC_DIR = 'photos-src';
const OUT_DIR = 'public/photos';
const MANIFEST_PATH = 'data/photo-manifest.json';
const REVIEW_PATH = 'public/photos/review.html';

const TARGET_SIZE = 512;
const WEBP_QUALITY = 82;

// ============================================================
//  Baca manifes lama (kalau ada)
// ============================================================

let oldManifest = { photos: [] };
try {
  oldManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch {}

const oldByFile = {};
for (const p of oldManifest.photos) {
  oldByFile[p.file] = p;
}

// ============================================================
//  Proses
// ============================================================

fs.mkdirSync(OUT_DIR, { recursive: true });

const srcFiles = fs.readdirSync(SRC_DIR).filter(f => {
  const ext = path.extname(f).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(ext);
});

console.log(`Foto ditemukan   : ${srcFiles.length}`);

const results = [];
let processed = 0, skipped = 0, failed = 0;
let totalBytes = 0, maxBytes = 0;
let exifRemaining = 0;

for (const srcFile of srcFiles) {
  const srcPath = path.join(SRC_DIR, srcFile);
  const srcBuf = fs.readFileSync(srcPath);
  const hash = crypto.createHash('sha256').update(srcBuf).digest('hex').slice(0, 8);
  const outName = path.basename(srcFile, path.extname(srcFile)) + '.webp';
  const outPath = path.join(OUT_DIR, outName);

  // Cek apakah sudah diproses
  const existing = oldByFile[outName];
  if (existing && existing.sourceHash === hash) {
    skipped++;
    results.push(existing);
    totalBytes += existing.bytes;
    if (existing.bytes > maxBytes) maxBytes = existing.bytes;
    console.log(`  ⏭ ${srcFile} → ${outName} (sama, dilewati)`);
    continue;
  }

  try {
    let pipeline = sharp(srcBuf).rotate(); // auto-orient dari EXIF

    // Crop 1:1 attention
    const meta = await pipeline.metadata();
    const size = Math.min(meta.width || TARGET_SIZE, meta.height || TARGET_SIZE);
    pipeline = pipeline.resize(TARGET_SIZE, TARGET_SIZE, {
      fit: sharp.fit.cover,
      position: sharp.strategy.attention,
    });

    const outBuf = await pipeline
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // Verifikasi EXIF: baca ulang dengan sharp, cek metadata
    const outMeta = await sharp(outBuf).metadata();
    const hasExif = !!(outMeta.exif || outMeta.icc || outMeta.iptc || outMeta.xmp);
    if (hasExif) {
      exifRemaining++;
      console.error(`  ⚠ EXIF tersisa di ${outName}`);
    }

    fs.writeFileSync(outPath, outBuf);

    const entry = {
      file: outName,
      width: TARGET_SIZE,
      height: TARGET_SIZE,
      bytes: outBuf.length,
      sourceHash: hash,
    };
    results.push(entry);
    totalBytes += outBuf.length;
    if (outBuf.length > maxBytes) maxBytes = outBuf.length;
    processed++;
    console.log(`  ✓ ${srcFile} → ${outName} (${(outBuf.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${srcFile}: ${err.message}`);
  }
}

// ============================================================
//  Tulis manifes
// ============================================================

const manifest = {
  generatedAt: new Date().toISOString(),
  photos: results,
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

// ============================================================
//  Halaman review
// ============================================================

const reviewHtml = `<!doctype html>
<html><head><meta charset="UTF-8"><title>Photo Review — Perjalanan</title>
<style>
  body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .card { background: #16213e; border-radius: 8px; overflow: hidden; }
  .card img { width: 100%; display: block; }
  .card .name { padding: 6px 10px; font-size: 11px; word-break: break-all; }
</style></head><body>
<h2>Photo Review</h2>
<p>${results.length} foto — ${new Date().toISOString()}</p>
<div class="grid">
${results.map(p => `
  <div class="card">
    <img src="${p.file}" alt="${p.file}" loading="lazy">
    <div class="name">${p.file}<br>${(p.bytes / 1024).toFixed(1)} KB</div>
  </div>`).join('\n')}
</div>
</body></html>`;

fs.writeFileSync(REVIEW_PATH, reviewHtml);

// ============================================================
//  Laporan
// ============================================================

console.log(`\n=== LAPORAN ===`);
console.log(`Diolah           : ${processed}`);
console.log(`Dilewati (sama)  : ${skipped}`);
console.log(`Gagal            : ${failed}`);
if (results.length > 0) {
  const avgKB = totalBytes / results.length / 1024;
  console.log(`Ukuran rata-rata : ${avgKB.toFixed(1)} KB`);
  console.log(`Ukuran terbesar  : ${(maxBytes / 1024).toFixed(1)} KB`);
}
console.log(`EXIF tersisa     : ${exifRemaining}`);
console.log(`Manifes          : ${MANIFEST_PATH}`);
console.log(`Review           : ${REVIEW_PATH}`);

if (exifRemaining > 0) {
  console.error('\nGAGAL: Ada file dengan EXIF tersisa. Periksa keluaran sharp.');
  process.exit(1);
}

if (failed > 0) {
  console.error(`\nPERINGATAN: ${failed} file gagal diolah.`);
}
