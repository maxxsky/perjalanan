import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getTerrainHeight } from './terrain.js';

const textureLoader = new THREE.TextureLoader();

/**
 * Kumpulan polaroid yang dibuat dari moments di journey.json.
 * @param {Array} moments — area.moments
 * @param {THREE.Scene} scene
 * @returns {Array<{ mesh: THREE.Group, moment: object }>}
 */
export function createPolaroids(moments, scene) {
  const polaroids = [];

  for (const moment of moments) {
    const group = new THREE.Group();
    const { frameWidth, frameHeight, photoSize, standHeight } = CONFIG.moments;
    const photoMargin = (frameWidth - photoSize) / 2;
    const bottomMargin = frameHeight - photoSize - photoMargin;

    // Bingkai — putih krem
    const frameGeo = new THREE.PlaneGeometry(frameWidth, frameHeight);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xF2EFE6 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    group.add(frame);

    // Foto — ditempel di depan bingkai dengan offset kecil
    const photoGeo = new THREE.PlaneGeometry(photoSize, photoSize);
    let photoMat;

    if (moment.photo) {
      // Coba load tekstur
      const tex = textureLoader.load(
        `photos/${moment.photo}`,
        undefined, // onProgress
        undefined, // onError — tidak crash, biarkan fallback
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;

      // Cek apakah load gagal (tekstur akan tetap putih 1x1)
      photoMat = new THREE.MeshLambertMaterial({ map: tex });

      // Fallback: kalau tekstur gagal, ganti abu
      textureLoader.load(
        `photos/${moment.photo}`,
        (t) => {
          photoMat.map = t;
          photoMat.color.set(0xffffff);
          photoMat.needsUpdate = true;
        },
        undefined,
        () => {
          // Error — fallback ke abu
          photoMat.map = null;
          photoMat.color.set(0xB8B4AC);
          photoMat.needsUpdate = true;
        },
      );
      // Mulai dengan abu dulu sampai load selesai
      photoMat.color.set(0xB8B4AC);
    } else {
      // Tidak ada foto — abu
      photoMat = new THREE.MeshLambertMaterial({ color: 0xB8B4AC });
    }

    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.set(0, bottomMargin - photoMargin, 0.005); // di depan bingkai
    group.add(photo);

    // Posisi dunia
    const x = moment.position.x;
    const z = moment.position.z;
    const y = getTerrainHeight(x, z) + standHeight;
    group.position.set(x, y, z);

    // Simpan referensi moment
    group.userData = { moment, isPolaroid: true };

    scene.add(group);
    polaroids.push({ mesh: group, moment });
  }

  return polaroids;
}

/**
 * Billboard: putar polaroid mengikuti kamera (sumbu Y saja).
 * Dipanggil tiap frame.
 */
export function updatePolaroids(polaroids, camera) {
  const camPos = camera.position;

  for (const { mesh } of polaroids) {
    const dx = camPos.x - mesh.position.x;
    const dz = camPos.z - mesh.position.z;
    const angle = Math.atan2(dx, dz);
    mesh.rotation.y = angle;
  }
}
