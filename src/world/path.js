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
 * Buat ribbon mesh dari route area.
 *
 * @param {Array} route — area.route dari journey.json
 * @param {string} palette — warna (pakai sand, lebih terang)
 * @returns {{ mesh: THREE.Mesh, curve: THREE.CatmullRomCurve3 }}
 */
export function createPath(route, palette) {
  const curve = createPathCurve(route);
  const pathWidth = CONFIG.world.pathWidth;
  const halfWidth = pathWidth / 2;
  const samples = 200;
  const yOffset = 0.08;

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

    // Perpendicular di XZ: rotate 90° CCW
    const px = -nz;
    const pz = nx;

    const lx = pt.x + px * halfWidth;
    const lz = pt.z + pz * halfWidth;
    const ly = getTerrainHeight(lx, lz) + yOffset;

    const rx = pt.x - px * halfWidth;
    const rz = pt.z - pz * halfWidth;
    const ry = getTerrainHeight(rx, rz) + yOffset;

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

  const sandHex = parseInt(palette.sand.slice(1), 16);
  const r = Math.min(255, ((sandHex >> 16) & 0xff) + 30);
  const g = Math.min(255, ((sandHex >> 8) & 0xff) + 30);
  const b = Math.min(255, (sandHex & 0xff) + 30);
  const color = new THREE.Color(r / 255, g / 255, b / 255);

  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);

  return { mesh, curve };
}
