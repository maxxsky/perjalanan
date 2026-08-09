import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getTerrainHeight } from './terrain.js';
import { mulberry32, hashString } from '../util/rng.js';

// ============================================================
//  Merge BufferGeometry — dengan groups untuk multi-material
// ============================================================

/**
 * @param {THREE.BufferGeometry[]} geos
 * @param {number[]} materialIndices — material index per geometri sumber
 * @returns {THREE.BufferGeometry}
 */
function mergeGeometries(geos, materialIndices) {
  let totalVerts = 0;
  let totalIdx = 0;

  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : g.attributes.position.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIdx);

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
  merged.setIndex(new THREE.BufferAttribute(indices, 1));

  // Groups untuk multi-material (batang=0, daun=1)
  let groupStart = 0;
  for (let i = 0; i < geos.length; i++) {
    const count = geos[i].index ? geos[i].index.count : geos[i].attributes.position.count;
    merged.addGroup(groupStart, count, materialIndices[i]);
    groupStart += count;
  }

  return merged;
}

// ============================================================
//  Geometri pohon low-poly
// ============================================================

function createTreeGeo(type) {
  const trunk = new THREE.CylinderGeometry(0.15, 0.22, 2.5, 5);
  const tPos = trunk.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    tPos.array[i * 3 + 1] += 1.25;
  }

  let leaves;
  if (type === 0) {
    leaves = new THREE.ConeGeometry(1.2, 2.8, 6);
  } else {
    leaves = new THREE.IcosahedronGeometry(1.2, 0);
  }
  const lPos = leaves.attributes.position;
  for (let i = 0; i < lPos.count; i++) {
    lPos.array[i * 3 + 1] += 3.5;
  }

  // materialIndex: batang=0, daun=1
  return mergeGeometries([trunk, leaves], [0, 1]);
}

// ============================================================
//  Vegetasi
// ============================================================

export function createVegetation(areaId, pathCurve) {
  const rng = mulberry32(hashString(areaId));
  const group = new THREE.Group();
  const count = CONFIG.world.treeCount;

  const barkMat = new THREE.MeshLambertMaterial({ color: 0x8B5E3C, flatShading: true });
  const leavesMat = new THREE.MeshLambertMaterial({ color: 0x3D7A3D, flatShading: true });

  const treeGeo0 = createTreeGeo(0);
  const treeGeo1 = createTreeGeo(1);

  const mesh0 = new THREE.InstancedMesh(treeGeo0, [barkMat, leavesMat], Math.floor(count / 2));
  const mesh1 = new THREE.InstancedMesh(treeGeo1, [barkMat, leavesMat], Math.ceil(count / 2));

  const dummy = new THREE.Object3D();
  const { sizeX, sizeZ } = CONFIG.terrain;
  const pathClearRadius = 4;

  let i0 = 0, i1 = 0;
  let attempts = 0;
  const maxAttempts = count * 20;

  while ((i0 + i1) < count && attempts < maxAttempts) {
    attempts++;

    const wx = (rng() - 0.5) * sizeX;
    const wz = (rng() - 0.5) * sizeZ;
    const wy = getTerrainHeight(wx, wz);

    if (wy < 0.3) continue;

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

    const density = Math.min(1, Math.max(0.05, (wx + 30) / 60));
    if (rng() > density) continue;

    const variant = rng() < 0.5 ? 0 : 1;
    const scale = 0.8 + rng() * 0.6;
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
