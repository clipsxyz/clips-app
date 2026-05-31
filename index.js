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

import { AppRegistry, LogBox, Text, View } from 'react-native';
import 'react-native-reanimated';
// NativeWind global.css can prevent the first paint on some Android builds; styles live in StyleSheet on native screens.
// import './global.css';
import { name as appName } from './app.json';
import { registerBackgroundMessageHandler } from './src/services/notifications';

LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate`']);

function Root() {
  try {
    // Lazy-load so a bad import in the tree is caught and shown instead of a blank screen.
    const App = require('./App.native').default;
    return <App />;
  } catch (err) {
    console.error('App bootstrap failed:', err);
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0711', padding: 20, paddingTop: 48 }}>
        <Text style={{ color: '#f87171', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
          App failed to start
        </Text>
        <Text style={{ color: '#e5e7eb', fontSize: 13 }}>{String(err?.message || err)}</Text>
      </View>
    );
  }
}

// Register once at app entry so background notifications can be handled when supported.
registerBackgroundMessageHandler().catch(() => {});

AppRegistry.registerComponent(appName, () => Root);
