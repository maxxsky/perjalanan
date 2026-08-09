import { getKeyboardVector } from './keyboard.js';
// import { getJoystickVector } from './joystick.js'; // T1.4

/**
 * Gabungkan semua input source jadi satu vektor {x, y} dengan range -1..1.
 * Controller tidak perlu tahu input dari mana.
 */
export function getInputVector() {
  const kb = getKeyboardVector();

  // TODO T1.4: gabungkan joystick
  // const js = getJoystickVector();
  // return { x: kb.x || js.x, y: kb.y || js.y };

  return kb;
}
