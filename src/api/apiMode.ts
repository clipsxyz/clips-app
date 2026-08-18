import { isMockMode } from '../config/runtimeEnv';

/**
 * When true, the API client keeps local mock data and does not call Laravel.
 * Flip via `.env`: EXPO_PUBLIC_USE_MOCK=true|false
 *
 * Prefer `isMockMode()` (evaluated at call time) so Metro/babel env inlining
 * and runtime reads stay consistent after `.env` changes + cache reset.
 */
export { isMockMode };

/** @deprecated Use `isMockMode()` — kept as a call-time alias, not a frozen const. */
export function getIsMock(): boolean {
  return isMockMode();
}
