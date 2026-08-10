/**
 * build-journey.mjs — Rakit public/data/journey.json dari data geografis asli.
 *
 * Masukan:
 *   data-raw/osm-roads.json        jalan (Overpass, highway=primary)
 *   data-raw/osm-pois.json         POI (Overpass)
 *   data-raw/manual-locations.json lokasi kenangan, koordinat dari Google Maps
 *
 * Keluaran:
 *   public/data/journey.json       dipakai runtime
 *   data-raw/derived-meta.json     bbox, skala, daftar tile DEM — untuk audit
 *
 * TIDAK ada koordinat yang di-hardcode di file ini. bbox dihitung dari
 * lokasi kenangan + POI di sekitarnya, bukan ditentukan sebelumnya.
 */

import fs from 'fs';

// ---------------- Parameter ----------------
const SIZE_X = 200;              // CONFIG.terrain.sizeX
const SIZE_Z = 300;              // CONFIG.terrain.sizeZ
const NEARBY_KM = 2.0;           // POI dalam radius ini dari lokasi kenangan ikut menentukan bbox
const PADDING = 0.35;            // ruang di sekeliling titik terluar
const ZOOM = 13;                 // zoom tile terrarium
const ROUTE_POINTS = 22;

// ---------------- Web Mercator ----------------
const R = 6378137;
const mercX = (lon) => R * (lon * Math.PI) / 180;
const mercY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
const invX = (x) => (x / R) * 180 / Math.PI;
const invY = (y) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;

const metersBetween = (aLat, aLon, bLat, bLon) =>
  Math.hypot(
    (bLat - aLat) * 110574,
    (bLon - aLon) * 111320 * Math.cos((aLat * Math.PI) / 180)
  );

// ---------------- Baca masukan ----------------
const roads = JSON.parse(fs.readFileSync('data-raw/osm-roads.json', 'utf8')).elements;
const pois = JSON.parse(fs.readFileSync('data-raw/osm-pois.json', 'utf8')).elements;
const manualAll = JSON.parse(fs.readFileSync('data-raw/manual-locations.json', 'utf8'));
const manual = manualAll.sekongkang;

if (!manual?.length) {
  console.error('GAGAL: data-raw/manual-locations.json tidak berisi lokasi untuk "sekongkang".');
  process.exit(1);
}

// ---------------- Rangkai jalan ----------------
const ways = roads.filter((e) => e.tags?.highway === 'primary' && e.geometry?.length >= 2);
const key = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;

function chain(list) {
  const pool = list.map((w) => ({ id: w.id, pts: w.geometry.slice() }));
  let line = pool.shift().pts.slice();
  let moved = true;
  while (pool.length && moved) {
    moved = false;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const h = key(line[0]);
      const t = key(line[line.length - 1]);
      const cs = key(c.pts[0]);
      const ce = key(c.pts[c.pts.length - 1]);
      if (t === cs) line = line.concat(c.pts.slice(1));
      else if (t === ce) line = line.concat(c.pts.slice(0, -1).reverse());
      else if (h === ce) line = c.pts.slice(0, -1).concat(line);
      else if (h === cs) line = c.pts.slice(1).reverse().concat(line);
      else continue;
      pool.splice(i, 1);
      moved = true;
      break;
    }
  }
  return { line, unchained: pool.length };
}
const { line: road, unchained } = chain(ways);

// ---------------- Tentukan jangkar bbox ----------------
// Jangkar = semua lokasi kenangan + POI yang berada dalam NEARBY_KM dari salah satunya.
const nearbyPois = pois.filter((p) =>
  manual.some((m) => metersBetween(m.lat, m.lon, p.lat, p.lon) <= NEARBY_KM * 1000)
);
const anchors = [
  ...manual.map((m) => ({ lat: m.lat, lon: m.lon })),
  ...nearbyPois.map((p) => ({ lat: p.lat, lon: p.lon })),
];

let minLat = Math.min(...anchors.map((a) => a.lat));
let maxLat = Math.max(...anchors.map((a) => a.lat));
let minLon = Math.min(...anchors.map((a) => a.lon));
let maxLon = Math.max(...anchors.map((a) => a.lon));
const dLat = (maxLat - minLat) * PADDING;
const dLon = (maxLon - minLon) * PADDING;
minLat -= dLat; maxLat += dLat; minLon -= dLon; maxLon += dLon;

// Samakan rasio di ruang Mercator supaya tidak ada distorsi. Selalu memperluas.
let x0 = mercX(minLon), x1 = mercX(maxLon);
let y0 = mercY(minLat), y1 = mercY(maxLat);
const aspect = SIZE_X / SIZE_Z;
let w = x1 - x0, h = y1 - y0;
if (w / h > aspect) { const a = (w / aspect - h) / 2; y0 -= a; y1 += a; }
else { const a = (h * aspect - w) / 2; x0 -= a; x1 += a; }
w = x1 - x0; h = y1 - y0;

const bbox = { minLat: invY(y0), maxLat: invY(y1), minLon: invX(x0), maxLon: invX(x1) };

// ---------------- Proyeksi ----------------
// worldX: barat → timur.  worldZ: selatan → utara.
const toWorld = (lat, lon) => ({
  x: ((mercX(lon) - x0) / w - 0.5) * SIZE_X,
  z: ((mercY(lat) - y0) / h - 0.5) * SIZE_Z,
});
const inBounds = (p) => Math.abs(p.x) <= SIZE_X / 2 && Math.abs(p.z) <= SIZE_Z / 2;

// ---------------- Potong jalan ke dalam bbox ----------------
// Ambil deretan titik menerus terpanjang yang berada di dalam bbox.
const flags = road.map(
  (p) => p.lat >= bbox.minLat && p.lat <= bbox.maxLat && p.lon >= bbox.minLon && p.lon <= bbox.maxLon
);
let best = [], cur = [];
for (let i = 0; i < road.length; i++) {
  if (flags[i]) cur.push(road[i]);
  else { if (cur.length > best.length) best = cur; cur = []; }
}
if (cur.length > best.length) best = cur;
const roadWorld = best.map((p) => toWorld(p.lat, p.lon));

// ---------------- Sederhanakan (Douglas-Peucker) ----------------
function perp(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const L = Math.hypot(dx, dz);
  if (L < 1e-9) return Math.hypot(p.x - a.x, p.z - a.z);
  return Math.abs(dz * p.x - dx * p.z + b.x * a.z - b.z * a.x) / L;
}
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perp(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return dp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(dp(pts.slice(idx), eps));
}
let lo = 0.005, hi = 30, route = roadWorld;
for (let i = 0; i < 50; i++) {
  const mid = (lo + hi) / 2;
  route = dp(roadWorld, mid);
  if (route.length > ROUTE_POINTS) lo = mid; else hi = mid;
}

// ---------------- Moments ----------------
const moments = manual.map((m) => {
  const p = toWorld(m.lat, m.lon);
  return {
    id: m.id,
    title: m.name,
    date: m.date,
    note: m.note ?? '',
    photo: m.photo,
    position: { x: +p.x.toFixed(2), z: +p.z.toFixed(2) },
    _sourceLatLon: { lat: m.lat, lon: m.lon },
  };
});

// Landmark = POI OSM di sekitar. Bukan kenangan, tapi berguna sebagai penanda tempat.
const landmarks = nearbyPois
  .filter((p) => p.tags?.name)
  .map((p) => {
    const q = toWorld(p.lat, p.lon);
    return {
      name: p.tags.name,
      kind: p.tags.tourism || p.tags.place || p.tags.natural || 'unknown',
      position: { x: +q.x.toFixed(2), z: +q.z.toFixed(2) },
    };
  });

// ---------------- Spawn ----------------
// Titik rute terdekat ke lokasi kenangan pertama.
const first = toWorld(manual[0].lat, manual[0].lon);
let spawn = route[0], sBest = Infinity;
for (const p of route) {
  const d = Math.hypot(p.x - first.x, p.z - first.z);
  if (d < sBest) { sBest = d; spawn = p; }
}

// ---------------- Tile DEM ----------------
const n = 2 ** ZOOM;
const tX = (lon) => Math.floor(((lon + 180) / 360) * n);
const tY = (lat) => Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
const tiles = [];
for (let tx = tX(bbox.minLon); tx <= tX(bbox.maxLon); tx++)
  for (let ty = tY(bbox.maxLat); ty <= tY(bbox.minLat); ty++)
    tiles.push({ z: ZOOM, x: tx, y: ty, url: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tx}/${ty}.png` });

// ---------------- Skala ----------------
const midLat = (bbox.minLat + bbox.maxLat) / 2;
const widthM = (bbox.maxLon - bbox.minLon) * 111320 * Math.cos((midLat * Math.PI) / 180);
const heightM = (bbox.maxLat - bbox.minLat) * 110574;

// ---------------- Tulis journey.json ----------------
const existing = JSON.parse(fs.readFileSync('public/data/journey.json', 'utf8'));
const palette = existing.areas?.find((a) => a.id === 'sekongkang')?.palette ?? {
  sky: '#8FBCD4', fog: '#A8C5D6', terrain: '#4A7C3F', sand: '#E8DCC0', water: '#1E4D6B',
};

const journey = {
  meta: { title: 'Perjalanan', version: 2, generatedBy: 'tools/build-journey.mjs', generatedAt: new Date().toISOString() },
  areas: [
    {
      id: 'sekongkang',
      name: 'Sekongkang',
      order: 1,
      palette,
      geo: {
        bbox,
        zoom: ZOOM,
        heightmap: 'data/sekongkang-heightmap.json',
        realExtentMeters: { width: Math.round(widthM), height: Math.round(heightM) },
        metersPerUnit: +(heightM / SIZE_Z).toFixed(2),
      },
      spawn: { x: +spawn.x.toFixed(2), y: 0, z: +spawn.z.toFixed(2) },
      route: route.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) })),
      moments,
      landmarks,
    },
  ],
};
fs.writeFileSync('public/data/journey.json', JSON.stringify(journey, null, 2));

fs.writeFileSync('data-raw/derived-meta.json', JSON.stringify({
  builtAt: new Date().toISOString(),
  sources: ['data-raw/osm-roads.json', 'data-raw/osm-pois.json', 'data-raw/manual-locations.json'],
  bbox, zoom: ZOOM, tiles,
  worldSize: { sizeX: SIZE_X, sizeZ: SIZE_Z },
  realExtentMeters: { width: Math.round(widthM), height: Math.round(heightM) },
  metersPerUnit: { x: +(widthM / SIZE_X).toFixed(2), z: +(heightM / SIZE_Z).toFixed(2) },
}, null, 2));

// ---------------- Laporan & verifikasi ----------------
const outRoute = route.filter((p) => !inBounds(p));
const outMoments = moments.filter((m) => !inBounds(m.position));
const distortion = Math.abs(widthM / SIZE_X - heightM / SIZE_Z) / (heightM / SIZE_Z) * 100;

console.log(`Jalan dirangkai      : ${ways.length - unchained}/${ways.length} way, ${road.length} titik`);
console.log(`Titik di dalam bbox  : ${best.length} → disederhanakan ${route.length}`);
console.log(`Lokasi kenangan      : ${manual.length}`);
console.log(`POI dalam ${NEARBY_KM} km    : ${nearbyPois.length} (jadi jangkar bbox + landmark)`);
console.log(`bbox lat             : ${bbox.minLat.toFixed(5)} .. ${bbox.maxLat.toFixed(5)}`);
console.log(`bbox lon             : ${bbox.minLon.toFixed(5)} .. ${bbox.maxLon.toFixed(5)}`);
console.log(`Luas nyata           : ${(widthM / 1000).toFixed(2)} x ${(heightM / 1000).toFixed(2)} km`);
console.log(`Skala                : ${(heightM / SIZE_Z).toFixed(1)} m/unit   (distorsi ${distortion.toFixed(2)}%)`);
console.log(`Tile DEM zoom ${ZOOM}     : ${tiles.length}`);
console.log(`Spawn                : (${spawn.x.toFixed(1)}, ${spawn.z.toFixed(1)}), ${sBest.toFixed(1)} unit dari ${manual[0].name}`);
console.log('');
console.log(`Rute di luar batas   : ${outRoute.length} ${outRoute.length ? '✗' : '✓'}`);
console.log(`Moment di luar batas : ${outMoments.length} ${outMoments.length ? '✗' : '✓'}`);
console.log(`Distorsi skala < 1%  : ${distortion < 1 ? '✓' : '✗'}`);
if (unchained) console.log(`PERINGATAN: ${unchained} way tidak tersambung ke rantai jalan.`);
