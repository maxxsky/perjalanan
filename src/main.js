import * as THREE from 'three';
import { CONFIG } from './config.js';
import { scene, renderer, camera } from './core/scene.js';
import { startLoop } from './core/loop.js';
import { loadJourney } from './data/loader.js';
import { initController, updateController } from './player/controller.js';
import { initFollowCamera, updateFollowCamera } from './player/camera.js';
import { initKeyboard } from './input/keyboard.js';
import { initJoystick } from './input/joystick.js';
import { createTerrain, createWater, getTerrainHeight, initTerrain } from './world/terrain.js';
import { createPath } from './world/path.js';
import { createVegetation } from './world/vegetation.js';
import { createPolaroids, updatePolaroids } from './world/polaroid.js';
import { createLandmarks } from './world/landmark.js';

document.body.appendChild(renderer.domElement);

initKeyboard();
initJoystick();

loadJourney()
  .then(async (data) => {
    console.log('Journey data loaded:', data);

    const area = data.areas[0];
    const palette = area.palette;

    // Load heightmap dari geo.heightmap
    const hmPath = area.geo?.heightmap || 'data/sekongkang-heightmap.json';
    const hmRes = await fetch(`/${hmPath}`);
    if (!hmRes.ok) throw new Error(`Gagal load heightmap: ${hmPath} (HTTP ${hmRes.status})`);
    const heightmap = await hmRes.json();
    initTerrain(heightmap);
    console.log(`Heightmap loaded: ${heightmap.width}×${heightmap.height}, elevasi ${heightmap.elevationRange.min}..${heightmap.elevationRange.max}m`);

    // Scene background + fog
    scene.background = new THREE.Color(palette.sky);
    scene.fog = new THREE.Fog(palette.fog, CONFIG.world.fogNear, CONFIG.world.fogFar);

    // Terrain + air
    scene.add(createTerrain(palette));
    scene.add(createWater(palette));

    // Jalur + vegetasi
    const { mesh: pathMesh, curve: pathCurve } = createPath(area.route, palette);
    scene.add(pathMesh);
    scene.add(createVegetation(area.id, pathCurve));

    const spawn = area.spawn;

    // Placeholder karakter
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.6, 0.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;

    const markerGeo = new THREE.BoxGeometry(0.2, 0.3, 0.15);
    const markerMat = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0, 0, 0.28);
    body.add(marker);

    const character = new THREE.Group();
    character.add(body);
    character.position.set(spawn.x, getTerrainHeight(spawn.x, spawn.z), spawn.z);
    scene.add(character);

    initController(character, camera);
    initFollowCamera(character, camera);

    // Polaroid dari moments
    const polaroids = createPolaroids(area.moments || [], scene);
    console.log(`Polaroids: ${polaroids.length}`);

    // Landmark dari OSM (penginapan, pantai)
    createLandmarks(area.landmarks || [], scene);
    console.log(`Landmarks: ${(area.landmarks || []).length}`);

    // Panel caption HTML
    const caption = document.createElement('div');
    caption.style.cssText = `
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.75); color: #eee; padding: 12px 20px;
      border-radius: 8px; font-family: sans-serif; text-align: center;
      opacity: 0; transition: opacity 200ms; pointer-events: none; z-index: 200;
      max-width: 90vw;
    `;
    caption.innerHTML = '<div id="cap-title" style="font-weight:bold;font-size:16px"></div><div id="cap-date" style="font-size:12px;opacity:0.7;margin-top:2px"></div><div id="cap-note" style="font-size:13px;margin-top:4px"></div>';
    document.body.appendChild(caption);

    const capTitle = caption.querySelector('#cap-title');
    const capDate = caption.querySelector('#cap-date');
    const capNote = caption.querySelector('#cap-note');
    let activeMoment = null;

    startLoop((delta) => {
      updateController(delta);
      updateFollowCamera(delta);
      updatePolaroids(polaroids, camera);

      // Deteksi kedekatan
      let closest = null, closestDist = Infinity;
      const charPos = character.position;
      for (const { mesh, moment } of polaroids) {
        const dx = charPos.x - mesh.position.x;
        const dz = charPos.z - mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < CONFIG.moments.showDistance && dist < closestDist) {
          closest = moment;
          closestDist = dist;
        }
      }

      if (closest !== activeMoment) {
        activeMoment = closest;
        if (closest) {
          capTitle.textContent = closest.title || '';
          capDate.textContent = closest.date || '';
          capDate.style.display = closest.date ? '' : 'none';
          capNote.textContent = closest.note || '';
          caption.style.opacity = '1';
        } else {
          caption.style.opacity = '0';
        }
      }

      renderer.render(scene, camera);
    });
  })
  .catch((err) => {
    console.error('Failed to load:', err.message);
    document.body.innerHTML = `<p style="color:red;padding:2rem;">Error: ${err.message}</p>`;
  });
