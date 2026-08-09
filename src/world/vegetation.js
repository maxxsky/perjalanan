import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getTerrainHeight } from './terrain.js';

// ============================================================
//  Seeded PRNG (mulberry32)
// ============================================================

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
//  Merge dua BufferGeometry jadi satu
// ============================================================

function mergeGeometries(geos) {
  let totalVerts = 0;
  let totalIdx = 0;
  const hasIndex = geos.some(g => g.index);

  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : g.attributes.position.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = hasIndex ? new Uint32Array(totalIdx) : null;

  let vertOffset = 0;
  let idxOffset = 0;
  let idxVertOffset = 0;

  for (const g of geos) {
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal ? g.attributes.normal.array : null;
    const count = g.attributes.position.count;

    positions.set(pos, vertOffset * 3);
    if (nor) normals.set(nor, vertOffset * 3);
    else {
      // No normals — generate flat
      for (let i = 0; i < count; i++) {
        normals[(vertOffset + i) * 3 + 1] = 1;
      }
    }

    if (g.index) {
      const idx = g.index.array;
      for (let i = 0; i < g.index.count; i++) {
        indices[idxOffset + i] = idx[i] + idxVertOffset;
      }
      idxOffset += g.index.count;
    } else {
      // Non-indexed: generate sequential indices
      for (let i = 0; i < count; i++) {
        indices[idxOffset + i] = idxVertOffset + i;
      }
      idxOffset += count;
    }

    idxVertOffset += count;
    vertOffset += count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (hasIndex) merged.setIndex(new THREE.BufferAttribute(indices, 1));

  return merged;
}

// ============================================================
//  Geometri pohon low-poly
// ============================================================

function createTreeGeo(type) {
  // Batang: CylinderGeometry(0.15, 0.22, 2.5, 5)
  const trunk = new THREE.CylinderGeometry(0.15, 0.22, 2.5, 5);
  const tPos = trunk.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    tPos.array[i * 3 + 1] += 1.25; // geser tengah batang ke atas
  }

  // Daun
  let leaves;
  if (type === 0) {
    leaves = new THREE.ConeGeometry(1.2, 2.8, 6);
  } else {
    leaves = new THREE.IcosahedronGeometry(1.2, 0);
  }
  const lPos = leaves.attributes.position;
  for (let i = 0; i < lPos.count; i++) {
    lPos.array[i * 3 + 1] += 3.5; // di atas batang
  }

  return mergeGeometries([trunk, leaves]);
}

// ============================================================
//  Placeholder pohon
// ============================================================

/**
 * Buat vegetasi dengan InstancedMesh.
 * @param {string} areaId — seed untuk PRNG
 * @param {THREE.CatmullRomCurve3|null} pathCurve — untuk cek radius jalur
 * @returns {THREE.Group}
 */
export function createVegetation(areaId, pathCurve) {
  const rng = mulberry32(hashString(areaId));
  const group = new THREE.Group();
  const count = CONFIG.world.treeCount;

  const treeGeo0 = createTreeGeo(0);
  const treeGeo1 = createTreeGeo(1);
  const barkMat = new THREE.MeshLambertMaterial({ color: 0x8B5E3C });
  const leavesMat = new THREE.MeshLambertMaterial({ color: 0x3D7A3D });

  // Karena pohon digabung jadi satu geo, pakai material array
  // Tapi mergeGeometries gabungin semuanya jadi satu material...
  // Simplifikasi: semua warna coklat (override di mesh)
  const mat0 = new THREE.MeshLambertMaterial({ color: 0x3D7A3D, flatShading: true });

  const mesh0 = new THREE.InstancedMesh(treeGeo0, mat0, Math.floor(count / 2));
  const mesh1 = new THREE.InstancedMesh(treeGeo1, mat0, Math.ceil(count / 2));

  const dummy = new THREE.Object3D();
  const { segmentsX, segmentsZ, sizeX, sizeZ } = CONFIG.terrain;
  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;
  const pathClearRadius = 4;

  let i0 = 0, i1 = 0;
  let attempts = 0;
  const maxAttempts = count * 20;

  while ((i0 + i1) < count && attempts < maxAttempts) {
    attempts++;

    // Generate candidate
    const wx = (rng() - 0.5) * sizeX;
    const wz = (rng() - 0.5) * sizeZ;
    const wy = getTerrainHeight(wx, wz);

    // Cek: tidak di air
    if (wy < 0.3) continue;

    // Cek: tidak di jalur — sample kurva manual
    if (pathCurve) {
      let minDist = Infinity;
      for (let s = 0; s <= 50; s++) {
        const pt = pathCurve.getPointAt(s / 50);
        const dx = wx - pt.x;
        const dz = wz - pt.z;
        const d = dx * dx + dz * dz;
        if (d < minDist) minDist = d;
      }
      if (Math.sqrt(minDist) < pathClearRadius) continue;
    }

    // Kerapatan naik seiring X (bukit lebih lebat)
    const density = Math.min(1, Math.max(0.05, (wx + 30) / 60)); // 0.05 di pantai, 1 di bukit
    if (rng() > density) continue;

    // Penempatan
    const variant = rng() < 0.5 ? 0 : 1;
    const scale = 0.8 + rng() * 0.6; // 0.8–1.4
    const rotationY = rng() * Math.PI * 2;

    dummy.position.set(wx, wy, wz);
    dummy.rotation.set(0, rotationY, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();

    if (variant === 0 && i0 < Math.floor(count / 2)) {
      mesh0.setMatrixAt(i0, dummy.matrix);
      i0++;
    } else if (variant === 1 && i1 < Math.ceil(count / 2)) {
      mesh1.setMatrixAt(i1, dummy.matrix);
      i1++;
    }
  }

  mesh0.count = i0;
  mesh1.count = i1;
  mesh0.instanceMatrix.needsUpdate = true;
  mesh1.instanceMatrix.needsUpdate = true;

  if (i0 > 0) group.add(mesh0);
  if (i1 > 0) group.add(mesh1);

  return group;
}

/**
 * Hash string ke integer untuk seed PRNG.
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
