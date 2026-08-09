import { scene, renderer, camera } from './core/scene.js';
import { loadJourney } from './data/loader.js';

document.body.appendChild(renderer.domElement);

// Load data, render scene
loadJourney()
  .then((data) => {
    console.log('Journey data loaded:', data);
    renderer.render(scene, camera);
  })
  .catch((err) => {
    console.error('Failed to load journey data:', err.message);
    document.body.innerHTML = `<p style="color:red;padding:2rem;">Error: ${err.message}</p>`;
  });
