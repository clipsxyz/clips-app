/**
 * @format
 * React Native entry point (iOS/Android)
 * This file is NOT used by Vite/web builds - only for React Native
 */

// In-memory storage so shared web code using localStorage does not crash on RN (persist with AsyncStorage later).
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem(k) {
      return mem.has(k) ? mem.get(k) : null;
    },
    setItem(k, v) {
      mem.set(k, String(v));
    },
    removeItem(k) {
      mem.delete(k);
    },
    clear() {
      mem.clear();
    },
    key(i) {
      return [...mem.keys()][i] ?? null;
    },
    get length() {
      return mem.size;
    },
  };
}

import { AppRegistry } from 'react-native';
import './global.css';
import App from './App.native';
import { name as appName } from './app.json';
import { registerBackgroundMessageHandler } from './src/services/notifications';

// Register once at app entry so background notifications can be handled when supported.
registerBackgroundMessageHandler().catch(() => {});

AppRegistry.registerComponent(appName, () => App);
