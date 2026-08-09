import * as THREE from 'three';
import { scene, renderer, camera } from './core/scene.js';
import { startLoop } from './core/loop.js';
import { loadJourney } from './data/loader.js';
import { initController, updateController } from './player/controller.js';
import { initFollowCamera, updateFollowCamera } from './player/camera.js';
import { initKeyboard } from './input/keyboard.js';
import { initJoystick } from './input/joystick.js';
import { createTerrain, createWater, getTerrainHeight } from './world/terrain.js';
import { createPath } from './world/path.js';

document.body.appendChild(renderer.domElement);

initKeyboard();
initJoystick();

loadJourney()
  .then((data) => {
    console.log('Journey data loaded:', data);

    // Area pertama = Sekongkang (Fase 2 fokus di sini)
    const area = data.areas[0];
    const palette = area.palette;

    // Scene background + fog dari palette
    scene.background = new THREE.Color(palette.sky);
    scene.fog = new THREE.Fog(palette.fog, CONFIG.world.fogNear, CONFIG.world.fogFar);

    // Terrain + air
    const terrain = createTerrain(palette);
    scene.add(terrain);

    const water = createWater(palette);
    scene.add(water);

    // Jalur dari route
    const path = createPath(area.route, palette);
    scene.add(path);

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

    startLoop((delta) => {
      updateController(delta);
      updateFollowCamera(delta);
      renderer.render(scene, camera);
    });
  })
  .catch((err) => {
    console.error('Failed to load journey data:', err.message);
    document.body.innerHTML = `<p style="color:red;padding:2rem;">Error: ${err.message}</p>`;
  });
