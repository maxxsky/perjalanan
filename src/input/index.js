import { getKeyboardVector } from './keyboard.js';
import { getJoystickVector } from './joystick.js';

/**
 * Gabungkan semua input source jadi satu vektor {x, y} dengan range -1..1.
 * Controller tidak perlu tahu input dari mana.
 */
export function getInputVector() {
  const kb = getKeyboardVector();
  const js = getJoystickVector();

  // Prioritaskan joystick kalau aktif, kalau tidak pakai keyboard
  const jsLen = Math.sqrt(js.x * js.x + js.y * js.y);
  if (jsLen > 0) return js;

  return kb;
}
