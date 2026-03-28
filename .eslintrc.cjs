/* eslint-env node */
/**
 * Light touch: ESLint loads without crashing under "type": "module" (.cjs).
 * TypeScript is the source of truth (`npx tsc --noEmit`). Large pages intentionally
 * disable or relax hook lint locally where needed.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  rules: {
    'react-hooks/rules-of-hooks': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-refresh/only-export-components': 'off',
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'laravel-backend',
    'android',
    'ios',
    'socketio-server',
    'coverage',
  ],
};
