/**
 * Device type detection — collapsed to two types after the 2026-05-04 redesign.
 * - lcd-panel: 1920x440 Pi LCD or any short-and-wide display
 * - desktop:   everything else (including phones and tablets, which get
 *              a letterboxed desktop layout in v1)
 */
export type DeviceType = 'lcd-panel' | 'desktop';

const LCD_MIN_ASPECT = 2.5;
const LCD_MAX_HEIGHT = 600;

export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'lcd-panel';
  const w = window.innerWidth;
  const h = window.innerHeight || 1;
  if ((w / h) >= LCD_MIN_ASPECT && h <= LCD_MAX_HEIGHT) {
    return 'lcd-panel';
  }
  return 'desktop';
}
