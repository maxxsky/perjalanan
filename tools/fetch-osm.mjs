/**
 * D1 — Fetch OSM data untuk Kecamatan Sekongkang.
 * Output: data-raw/osm-sekongkang.json
 *
 * Usage: node tools/fetch-osm.mjs
 */

import { writeFileSync } from 'fs';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Query: cari batas admin "Sekongkang", lalu semua fitur di dalamnya
const QUERY = `
[out:json][timeout:60];

// Cari relasi batas administratif bernama Sekongkang
rel["name"="Sekongkang"]["boundary"="administrative"];
map_to_area -> .sekongkang;

// Kumpulkan semua fitur dalam area
(
  // Garis pantai
  way["natural"="coastline"](area.sekongkang);

  // Jalan utama
  way["highway"~"primary|secondary|tertiary|unclassified"](area.sekongkang);

  // Desa
  node["place"="village"](area.sekongkang);

  // Pantai
  node["natural"="beach"](area.sekongkang);
  way["natural"="beach"](area.sekongkang);
  node["place"~"beach|locality"](area.sekongkang);
);

out body;
>;
out skel qt;
`;

async function main() {
  console.log('Fetching OSM data for Sekongkang...');
  console.log('URL:', OVERPASS_URL);

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass API returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  // Simpan mentah
  const outPath = 'data-raw/osm-sekongkang.json';
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\nSaved: ${outPath} (${JSON.stringify(data).length.toLocaleString()} bytes)`);

  // Analisis
  const elements = data.elements || [];
  console.log(`\nTotal elements: ${elements.length}`);

  // Cari bbox dari relasi batas
  const boundaryRel = elements.find(e => e.type === 'relation' && e.tags?.boundary === 'administrative');
  if (boundaryRel && boundaryRel.bounds) {
    const b = boundaryRel.bounds;
    console.log(`\n=== BBOX KECAMATAN ===`);
    console.log(`minLat: ${b.minlat.toFixed(6)}`);
    console.log(`minLon: ${b.minlon.toFixed(6)}`);
    console.log(`maxLat: ${b.maxlat.toFixed(6)}`);
    console.log(`maxLon: ${b.maxlon.toFixed(6)}`);
    console.log(`admin_level: ${boundaryRel.tags?.admin_level || 'tidak diketahui'}`);
  } else {
    console.log('\n⚠️  Relasi batas administratif TIDAK ditemukan!');
    // Coba cari semua relasi sebagai fallback
    const rels = elements.filter(e => e.type === 'relation');
    console.log(`Relasi ditemukan: ${rels.length}`);
    for (const r of rels) {
      console.log(`  - ${r.tags?.name || '(tanpa nama)'} (${Object.keys(r.tags || {}).join(', ')})`);
    }
  }

  // Garis pantai
  const coastlines = elements.filter(e => e.type === 'way' && e.tags?.natural === 'coastline');
  const coastPoints = coastlines.reduce((sum, w) => sum + (w.nodes?.length || 0), 0);
  console.log(`\n=== GARIS PANTAI ===`);
  console.log(`Way: ${coastlines.length}, total titik: ${coastPoints}`);

  // Jalan
  const roads = elements.filter(e => e.type === 'way' && e.tags?.highway);
  console.log(`\n=== JALAN (${roads.length}) ===`);
  const roadNames = new Set();
  for (const r of roads) {
    const name = r.tags?.name || `(tanpa nama, ${r.tags?.highway})`;
    roadNames.add(name);
  }
  for (const name of [...roadNames].sort()) {
    console.log(`  - ${name}`);
  }

  // Desa
  const villages = elements.filter(e => e.tags?.place === 'village');
  console.log(`\n=== DESA (${villages.length}) ===`);
  for (const v of villages) {
    console.log(`  - ${v.tags?.name || '(tanpa nama)'} (${v.lat?.toFixed(4)}, ${v.lon?.toFixed(4)})`);
  }

  // Pantai & POI
  const beaches = elements.filter(e =>
    e.tags?.natural === 'beach' || e.tags?.place === 'beach' || e.tags?.name?.toLowerCase?.().includes('pantai')
  );
  const localities = elements.filter(e =>
    e.tags?.place === 'locality' || (e.type === 'node' && e.tags?.name && !e.tags?.place && !e.tags?.highway && !e.tags?.natural)
  );
  console.log(`\n=== PANTAI & POI (${beaches.length + localities.length}) ===`);
  for (const b of beaches) {
    console.log(`  - ${b.tags?.name || '(pantai tanpa nama)'} (${b.lat?.toFixed(4) || 'way'}, ${b.lon?.toFixed(4) || 'way'})`);
  }
  for (const l of localities.slice(0, 20)) {
    if (l.tags?.name && !l.tags?.place) {
      console.log(`  - ${l.tags.name} (${l.lat?.toFixed(4) || 'way'}, ${l.lon?.toFixed(4) || 'way'})`);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
