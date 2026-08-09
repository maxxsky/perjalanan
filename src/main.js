import * as THREE from 'three';
import { scene, renderer, camera } from './core/scene.js';
import { loadJourney } from './data/loader.js';

document.body.appendChild(renderer.domElement);

loadJourney()
  .then((data) => {
    console.log('Journey data loaded:', data);

    const spawn = data.areas[0].spawn;

    // Placeholder karakter: badan (merah)
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.6, 0.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8; // setengah tinggi, relatif dalam group

    // Penanda arah hadap (kuning) — nempel di sisi depan (z+)
    const markerGeo = new THREE.BoxGeometry(0.2, 0.3, 0.15);
    const markerMat = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0, 0, 0.28);
    body.add(marker);

    // Group untuk karakter
    const character = new THREE.Group();
    character.add(body);
    character.position.set(spawn.x, 0, spawn.z);
    scene.add(character);

    // Expose buat controller nanti
    window.__character = character;

    renderer.render(scene, camera);
  })
  .catch((err) => {
    console.error('Failed to load journey data:', err.message);
    document.body.innerHTML = `<p style="color:red;padding:2rem;">Error: ${err.message}</p>`;
  });
