import { scene, renderer, camera } from './core/scene.js';

document.body.appendChild(renderer.domElement);

// Single render — no animation loop yet (Fase 0)
renderer.render(scene, camera);
