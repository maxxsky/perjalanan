/**
 * Load dan validasi journey.json.
 * Throw error dengan pesan spesifik kalau struktur data rusak.
 */
export async function loadJourney() {
  const res = await fetch('/data/journey.json');
  if (!res.ok) {
    throw new Error(`Gagal fetch journey.json: HTTP ${res.status}`);
  }

  const data = await res.json();

  // Validasi struktur
  if (!data || typeof data !== 'object') {
    throw new Error('journey.json harus berupa objek JSON');
  }

  if (!Array.isArray(data.areas)) {
    throw new Error('journey.json: "areas" harus berupa array');
  }

  if (data.areas.length === 0) {
    throw new Error('journey.json: "areas" minimal berisi 1 area');
  }

  data.areas.forEach((area, i) => {
    const prefix = `journey.json: areas[${i}]`;

    if (!area.id || typeof area.id !== 'string') {
      throw new Error(`${prefix}: "id" wajib ada (string)`);
    }
    if (!area.spawn || typeof area.spawn.x !== 'number' || typeof area.spawn.z !== 'number') {
      throw new Error(`${prefix}: "spawn" wajib punya x dan z (number)`);
    }
    if (!Array.isArray(area.route)) {
      throw new Error(`${prefix}: "route" wajib array`);
    }
    if (area.route.length < 2) {
      throw new Error(`${prefix}: "route" minimal 2 titik`);
    }
    area.route.forEach((pt, j) => {
      if (typeof pt.x !== 'number' || typeof pt.z !== 'number') {
        throw new Error(`${prefix}: route[${j}] wajib punya x dan z (number)`);
      }
    });
  });

  return data;
}
