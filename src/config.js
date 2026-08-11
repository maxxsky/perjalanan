export const CONFIG = {
  player: {
    walkSpeed: 4.0,
    turnSpeed: 8.0,
    partnerOffset: 0.7,
    terrainSmooth: 15,
  },
  camera: {
    distance: 12,
    height: 6,
    lookAtHeight: 1.5,
    followLerp: 3.0,
    fov: 55,
    recenterDot: 0.95,
    idleRecenterLerp: 2.0,
  },
  input: {
    joystickRadius: 60,
    deadzone: 0.15,
  },
  world: {
    pathWidth: 1.5,       // 15 m — sengaja dilebihkan dari asli (6-7 m) agar terbaca dari kamera
    pathYOffset: 0.25,    // 2.6 m — offset vertikal supaya jalur selalu di atas terrain
    bounds: { minX: -95, maxX: 95, minZ: -145, maxZ: 145 },
    boundsPushback: 6.0,
    fogNear: 60,
    fogFar: 220,
    treeCount: 400,
  },
  terrain: {
    segmentsX: 100,
    segmentsZ: 150,
    sizeX: 200,
    sizeZ: 300,
    // 1 unit dunia = 10.25 m secara horizontal (dari data-raw/derived-meta.json).
    // heightScale BUKAN 1/10.25. Nilai di bawah setara pelebaran vertikal sekitar 3x.
    // Ini konvensi visual, bukan representasi metrik.
    // Titik awal untuk disetel Brahma sambil melihat hasilnya.
    heightScale: 0.3,
  },
  moments: {
    showDistance: 8,
    frameWidth: 2.2,
    frameHeight: 2.6,
    photoSize: 1.9,
    standHeight: 1.4,
  },
};
