/**
 * Keyboard input — track WASD + arrow keys via Set.
 * Tidak pakai event langsung untuk gerak.
 */

const keys = new Set();

function onKeyDown(e) {
  keys.add(e.code);
  // Cegah scroll/default arrow behavior
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
}

function onKeyUp(e) {
  keys.delete(e.code);
}

export function initKeyboard() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

export function getKeyboardVector() {
  let x = 0;
  let y = 0;

  if (keys.has('KeyW') || keys.has('ArrowUp'))    y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown'))  y -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft'))  x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;

  return { x, y };
}
