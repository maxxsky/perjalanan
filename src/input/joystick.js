import { CONFIG } from '../config.js';

let activeTouchId = null;
let originX = 0;
let originY = 0;
let currentX = 0;
let currentY = 0;

let baseEl = null;
let knobEl = null;
let visible = false;

/**
 * Bikin elemen DOM joystick (hidden by default).
 */
function createUI() {
  // Base — lingkaran luar
  baseEl = document.createElement('div');
  baseEl.style.cssText = `
    position: fixed;
    width: ${CONFIG.input.joystickRadius * 2}px;
    height: ${CONFIG.input.joystickRadius * 2}px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    border: 2px solid rgba(255,255,255,0.4);
    transform: translate(-50%, -50%);
    pointer-events: none;
    display: none;
    z-index: 100;
  `;
  document.body.appendChild(baseEl);

  // Knob — lingkaran dalam
  knobEl = document.createElement('div');
  knobEl.style.cssText = `
    position: fixed;
    width: ${CONFIG.input.joystickRadius * 0.8}px;
    height: ${CONFIG.input.joystickRadius * 0.8}px;
    border-radius: 50%;
    background: rgba(255,255,255,0.5);
    transform: translate(-50%, -50%);
    pointer-events: none;
    display: none;
    z-index: 101;
  `;
  document.body.appendChild(knobEl);
}

function showAt(x, y) {
  originX = x;
  originY = y;
  baseEl.style.left = x + 'px';
  baseEl.style.top = y + 'px';
  baseEl.style.display = 'block';
  knobEl.style.left = x + 'px';
  knobEl.style.top = y + 'px';
  knobEl.style.display = 'block';
  visible = true;
}

function hide() {
  baseEl.style.display = 'none';
  knobEl.style.display = 'none';
  visible = false;
}

function updateKnob(dx, dy) {
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = CONFIG.input.joystickRadius;
  let clampedDx = dx;
  let clampedDy = dy;

  if (dist > maxR) {
    clampedDx = (dx / dist) * maxR;
    clampedDy = (dy / dist) * maxR;
  }

  knobEl.style.left = (originX + clampedDx) + 'px';
  knobEl.style.top = (originY + clampedDy) + 'px';

  // Return normalized -1..1
  currentX = clampedDx / maxR;
  currentY = -clampedDy / maxR; // Y dibalik: swipe ke atas = positif
}

function onTouchStart(e) {
  for (const touch of e.changedTouches) {
    // Hanya di setengah kiri layar
    if (touch.clientX < window.innerWidth / 2 && activeTouchId === null) {
      activeTouchId = touch.identifier;
      showAt(touch.clientX, touch.clientY);
      e.preventDefault();
      break;
    }
  }
}

function onTouchMove(e) {
  if (activeTouchId === null) return;

  for (const touch of e.changedTouches) {
    if (touch.identifier === activeTouchId) {
      const dx = touch.clientX - originX;
      const dy = touch.clientY - originY;
      updateKnob(dx, dy);
      e.preventDefault();
      break;
    }
  }
}

function onTouchEnd(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === activeTouchId) {
      activeTouchId = null;
      hide();
      currentX = 0;
      currentY = 0;
      e.preventDefault();
      break;
    }
  }
}

/**
 * Init joystick — pasang event listener.
 */
export function initJoystick() {
  createUI();

  window.addEventListener('touchstart', onTouchStart, { passive: false });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: false });
  window.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

/**
 * Return vektor input joystick {x, y} dengan range -1..1.
 */
export function getJoystickVector() {
  if (!visible) return { x: 0, y: 0 };

  const len = Math.sqrt(currentX * currentX + currentY * currentY);
  if (len < CONFIG.input.deadzone) return { x: 0, y: 0 };

  return { x: currentX, y: currentY };
}
