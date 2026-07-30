/**
 * Optical scale for React Native UI vs mobile web CSS px.
 * Same physical phone size often makes RN density-independent px look smaller.
 */
export const NATIVE_OPTICAL_SCALE = 1.16;

/** Round a layout/type/icon size through the native optical scale. */
export function ox(n: number): number {
  return Math.round(n * NATIVE_OPTICAL_SCALE);
}
