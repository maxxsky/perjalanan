import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getTerrainHeight } from './terrain.js';

/**
 * Buat CatmullRomCurve3 dari route (dengan Y dari terrain).
 */
export function createPathCurve(route) {
  const points = route.map(pt => {
    const y = getTerrainHeight(pt.x, pt.z);
    return new THREE.Vector3(pt.x, y, pt.z);
  });
  return new THREE.CatmullRomCurve3(points);
}

/**
 * Buat ribbon mesh dari route.
 *
 * @param {Array} route — area.route
 * @param {object} palette — warna area, termasuk palette.path
 * @returns {{ mesh: THREE.Mesh, curve: THREE.CatmullRomCurve3 }}
 */
export function createPath(route, palette) {
  const curve = createPathCurve(route);
  const { pathWidth, pathYOffset } = CONFIG.world;
  const halfWidth = pathWidth / 2;
  const samples = 200;

  const vertices = [];
  const indices = [];
  const samplePoints = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);

    const tx = tangent.x;
    const tz = tangent.z;
    const len = Math.sqrt(tx * tx + tz * tz);
    if (len < 0.001) continue;

    const nx = tx / len;
    const nz = tz / len;

    const px = -nz;
    const pz = nx;

    const lx = pt.x + px * halfWidth;
    const lz = pt.z + pz * halfWidth;
    const ly = getTerrainHeight(lx, lz) + pathYOffset;

    const rx = pt.x - px * halfWidth;
    const rz = pt.z - pz * halfWidth;
    const ry = getTerrainHeight(rx, rz) + pathYOffset;

    vertices.push(lx, ly, lz, rx, ry, rz);
    samplePoints.push({ lx, ly, lz, rx, ry, rz });
  }

  for (let i = 0; i < samplePoints.length - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Warna jalur: dari palette.path, default #4A443C (aspal gelap)
  const pathColor = palette.path || '#4A443C';
  const color = new THREE.Color(pathColor);
  const mat = new THREE.MeshLambertMaterial({ color });

  const mesh = new THREE.Mesh(geo, mat);

  return { mesh, curve };
}
