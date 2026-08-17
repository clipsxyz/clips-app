import { getRuntimeEnv } from '../config/runtimeEnv';

/**
 * When true, the API client keeps local mock data and does not call Laravel.
 * Flip via `.env`: EXPO_PUBLIC_USE_MOCK=true|false
 *
 * `getRuntimeEnv` covers Vite (`import.meta.env`); `process.env` covers Metro inlining.
 */
export const IS_MOCK =
  process.env.EXPO_PUBLIC_USE_MOCK === 'true' ||
  getRuntimeEnv('EXPO_PUBLIC_USE_MOCK') === 'true';
