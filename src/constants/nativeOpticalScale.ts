/**
 * Optical scale for React Native UI vs mobile web CSS px.
 * Keep at 1 so native icon/type sizes match the webapp (CSS px 1:1).
 * A >1 bump was tried for small-screen phones but overshoots on typical DPIs.
 */
export const NATIVE_OPTICAL_SCALE = 1;

/** Round a layout/type/icon size through the native optical scale. */
export function ox(n: number): number {
  return Math.round(n * NATIVE_OPTICAL_SCALE);
}
